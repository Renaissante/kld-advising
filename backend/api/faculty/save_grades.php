<?php
// Include CORS headers
include_once '../../config/cors.php';
require_once "../audit/log_activity.php";
// Set headers for content type
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS request (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    exit(0);
}

// Start session to check for logged in user
session_start();

// Include database configuration
include_once '../../config/database.php';

// Check connection
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in save_grades.php.");
    echo json_encode(array("success" => false, "message" => "Database connection failed."));
    exit();
}

// Get faculty ID - check query parameter first (for testing), then session
$facultyId = isset($_GET['faculty_id']) ? $_GET['faculty_id'] : null;

// If no query parameter, check session
if (!$facultyId && isset($_SESSION['user_id'])) {
    $facultyId = $_SESSION['user_id'];

    // Also verify role if available
    if (isset($_SESSION['user_roles'])) {
        if (!in_array('faculty', $_SESSION['user_roles'])) {
            http_response_code(403);
            echo json_encode(array("success" => false, "message" => "Forbidden: User is not a faculty member"));
            exit();
        }
    }
} else if (!$facultyId) { // If facultyId is still null after checking session
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Unauthorized: You must be logged in as faculty"));
    exit();
}

// Get request body
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "No data provided"));
    exit();
}

// Extract required information
$courseId = isset($data['course_id']) ? intval($data['course_id']) : null;
$sectionId = isset($data['section_id']) ? intval($data['section_id']) : null;
$academicYearId = isset($data['academic_year_id']) ? $data['academic_year_id'] : null; // Keep as string/int based on frontend
$semesterId = isset($data['semester_id']) ? $data['semester_id'] : null; // Keep as string/int based on frontend
$action = isset($data['action']) ? $data['action'] : 'save'; // 'save' or 'submit'
$students = isset($data['students']) ? $data['students'] : [];

// Validate required data
if (!$courseId || !$sectionId || !$academicYearId || !$semesterId || empty($students)) {
    http_response_code(400);
    echo json_encode(array(
        "success" => false,
        "message" => "Missing required data: course_id, section_id, academic_year_id, semester_id, or students"
    ));
    exit();
}

// Function to get remarks based on transmutation (5-point grading scale)
function getRemarksFromTransmutation($transmutation) {
    if ($transmutation === null || $transmutation === "") return null;

    // Check for non-numeric special grades first
    $lowerTransmutation = strtolower($transmutation);
    if ($lowerTransmutation === 'inc') return 'Incomplete';
    if ($lowerTransmutation === 'ud') return 'Unofficially Dropped';
    if ($lowerTransmutation === 'od') return 'Officially Dropped';

    $numTransmutation = floatval($transmutation);

    if (is_nan($numTransmutation)) {
        return null; // It's not a known text grade or a valid number
    }

    // 5-point grading scale: 1.00-3.00 is Passed, 3.25-5.00 is Failed
    if ($numTransmutation >= 1.00 && $numTransmutation <= 3.00) return "Passed";
    if ($numTransmutation >= 3.25 && $numTransmutation <= 5.00) return "Failed";
    return null; // Should not happen with valid input range
}

try {
    // First, verify this faculty is assigned to the given course and section
    $verifyQuery = "SELECT COUNT(*) as count
                   FROM section_faculty
                   WHERE faculty_id = :faculty_id
                   AND course_id = :course_id
                   AND section_id = :section_id";

    $verifyStmt = $conn->prepare($verifyQuery);
    $verifyStmt->bindParam(':faculty_id', $facultyId);
    $verifyStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
    $verifyStmt->bindParam(':section_id', $sectionId, PDO::PARAM_INT);
    $verifyStmt->execute();

    $result = $verifyStmt->fetch(PDO::FETCH_ASSOC);

    if ($result['count'] == 0) {
        http_response_code(403);
        echo json_encode(array(
            "success" => false,
            "message" => "Faculty not assigned to this course and section"
        ));
        exit();
    }

    // Begin transaction
    $conn->beginTransaction();

    // Loop through students and save/update grades
    $successCount = 0;
    $totalCount = count($students);
    $errors = [];
    $studentsToUpdateStatus = []; // Array to store student_ids that need status update

    foreach ($students as $student) {
        // Extract student data
        $studentId = isset($student['student_id']) ? $student['student_id'] : null;
        $transmutation = isset($student['transmutation']) && $student['transmutation'] !== "" ? $student['transmutation'] : null;
        
        // Calculate remarks based on transmutation
        $remarks = getRemarksFromTransmutation($transmutation);

        // For submission, validate all required fields
        if ($action === 'submit') {
            // Check if transmutation is present and valid
            $isValidForSubmission = ($transmutation !== null && $remarks !== null); // Transmutation should exist and be valid to derive remarks

            if (!$isValidForSubmission) {
                 $errors[] = "Missing or invalid transmutation grade for student ID: $studentId.";
                 continue; // Skip saving for this student if validation fails on submit
            }
        }


        // Check if an entry already exists
        $checkQuery = "SELECT id, remarks FROM course_grades
                       WHERE student_id = :student_id
                       AND course_id = :course_id";

        $checkStmt = $conn->prepare($checkQuery);
        $checkStmt->bindParam(':student_id', $studentId);
        $checkStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
        $checkStmt->execute();
        $existingGrade = $checkStmt->fetch(PDO::FETCH_ASSOC);
        $oldRemarks = $existingGrade ? $existingGrade['remarks'] : null;

        if ($existingGrade) {
            // Update existing entry
            $updateQuery = "UPDATE course_grades
                           SET transmutation = :transmutation,
                               remarks = :remarks,
                               updated_at = NOW()
                           WHERE student_id = :student_id
                           AND course_id = :course_id";

            $updateStmt = $conn->prepare($updateQuery);
            $updateStmt->bindParam(':transmutation', $transmutation);
            $updateStmt->bindParam(':remarks', $remarks);
            $updateStmt->bindParam(':student_id', $studentId);
            $updateStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);

            if ($updateStmt->execute()) {
                $successCount++;
            } else {
                $errors[] = "Failed to update grades for student ID: $studentId";
            }
        } else {
            // Insert new entry
            $insertQuery = "INSERT INTO course_grades (
                              student_id, course_id, transmutation, remarks
                           ) VALUES (
                              :student_id, :course_id, :transmutation, :remarks
                           )";

            $insertStmt = $conn->prepare($insertQuery);
            $insertStmt->bindParam(':student_id', $studentId);
            $insertStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
            $insertStmt->bindParam(':transmutation', $transmutation);
            $insertStmt->bindParam(':remarks', $remarks);

            if ($insertStmt->execute()) {
                $successCount++;
            } else {
                $errors[] = "Failed to save grades for student ID: $studentId";
            }
        }

        // Logic to set student to 'Irregular' if a current course is failed and has un-passed prerequisites
        if ($remarks === "Failed") {
            $prereqQuery = "SELECT course_id FROM course_prerequisites WHERE prerequisite_course_id = :course_id";
            $prereqStmt = $conn->prepare($prereqQuery);
            $prereqStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
            $prereqStmt->execute();
            $coursesHavingThisAsPrereq = $prereqStmt->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($coursesHavingThisAsPrereq)) {
                // If this course is a prerequisite for other courses, and the student failed it,
                // they should be set to irregular (if not already).
                $studentsToUpdateStatus[] = $studentId;
            }
        }
        // Logic to set student back to 'Regular' if grade changes from Failed to Passed
        // and no other failed prerequisites exist.
        else if ($oldRemarks === "Failed" && $remarks === "Passed") {
            // Check if the student has any other failed courses that have un-passed prerequisites
            $anyOtherFailedPrereqs = false;
            
            $failedCoursesQuery = "SELECT cg.course_id FROM course_grades cg
                                  JOIN course_prerequisites cp ON cg.course_id = cp.prerequisite_course_id
                                  WHERE cg.student_id = :student_id
                                  AND cg.remarks = 'Failed'";
            $failedCoursesStmt = $conn->prepare($failedCoursesQuery);
            $failedCoursesStmt->bindParam(':student_id', $studentId);
            $failedCoursesStmt->execute();
            $failedPrereqCourses = $failedCoursesStmt->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($failedPrereqCourses)) {
                foreach ($failedPrereqCourses as $failedPrereqCourseId) {
                    // For each failed prerequisite course, check if there are other courses that require it
                    $checkIfRequiredQuery = "SELECT course_id FROM course_prerequisites WHERE prerequisite_course_id = :failed_prereq_course_id";
                    $checkIfRequiredStmt = $conn->prepare($checkIfRequiredQuery);
                    $checkIfRequiredStmt->bindParam(':failed_prereq_course_id', $failedPrereqCourseId, PDO::PARAM_INT);
                    $checkIfRequiredStmt->execute();
                    $isStillRequired = $checkIfRequiredStmt->fetch(PDO::FETCH_COLUMN);

                    if ($isStillRequired) {
                        $anyOtherFailedPrereqs = true;
                        break; // Found another failed prerequisite, no need to check further
                    }
                }
            }

            if (!$anyOtherFailedPrereqs) {
                // If no other failed prerequisites, add student to list to be set to Regular
                $studentsToUpdateStatus[] = ['id' => $studentId, 'status' => 'Regular'];
            }
        }
    }

    // Commit or rollback transaction based on success
    if (empty($errors)) { // Commit only if there are no errors
        // Update student enrollment status for those who failed a prerequisite
        if (!empty($studentsToUpdateStatus)) {
            foreach ($studentsToUpdateStatus as $studentUpdate) {
                $studentIdToUpdate = is_array($studentUpdate) ? $studentUpdate['id'] : $studentUpdate;
                $newStatus = is_array($studentUpdate) ? $studentUpdate['status'] : 'Irregular';

                $updateStudentStatusQuery = "UPDATE students SET enrollment_status = :new_status WHERE student_id = :student_id AND enrollment_status != :new_status";
                $updateStudentStatusStmt = $conn->prepare($updateStudentStatusQuery);
                $updateStudentStatusStmt->bindParam(':new_status', $newStatus);
                $updateStudentStatusStmt->bindParam(':student_id', $studentIdToUpdate);
                $updateStudentStatusStmt->execute();
            }
        }

        $conn->commit();

        // --- WebSocket Notification for Advisor ---
        $advisorEmployeeId = null;
      
        $sqlGetAdvisor = "SELECT advisor_id FROM section_advisors WHERE section_id = :section_id LIMIT 1";
        $stmtGetAdvisor = $conn->prepare($sqlGetAdvisor);
        $stmtGetAdvisor->bindParam(':section_id', $sectionId, PDO::PARAM_INT);
        $stmtGetAdvisor->execute();
        $advisorRow = $stmtGetAdvisor->fetch(PDO::FETCH_ASSOC);

        

        if ($advisorRow && !empty($advisorRow['advisor_id'])) {
            $advisorEmployeeId = $advisorRow['advisor_id'];
            

            require dirname(__DIR__, 3) . '/vendor/autoload.php'; 

            try {
                $client = new WebSocket\Client("ws://192.168.1.11:8080");

              
                $sqlDetails = "SELECT c.course_code, c.course_title AS course_name, s.name as section_name
                               FROM section_faculty sf
                               JOIN courses c ON sf.course_id = c.id
                               JOIN sections s ON sf.section_id = s.id
                               WHERE sf.course_id = :course_id AND sf.section_id = :section_id LIMIT 1";
                $stmtDetails = $conn->prepare($sqlDetails);
                $stmtDetails->bindParam(':course_id', $courseId, PDO::PARAM_INT);
                $stmtDetails->bindParam(':section_id', $sectionId, PDO::PARAM_INT);
                $stmtDetails->execute();
                $detailsRow = $stmtDetails->fetch(PDO::FETCH_ASSOC);

                $courseInfo = $detailsRow ? "{$detailsRow['course_code']} - {$detailsRow['course_name']}" : "a course";
                $sectionInfo = $detailsRow ? "Section {$detailsRow['section_name']}" : "a section";


                $wsMessage = json_encode([
                    'type' => 'backend_event', // Changed from 'notification' to 'backend_event'
                    'payload' => [
                        'event' => 'grades_saved_notification', // Specific event type
                        'recipientId' => $advisorEmployeeId, // Target advisor
                        'message' => "Grades for {$courseInfo} in {$sectionInfo} have been " . ($action === 'submit' ? "submitted" : "saved") . ".",
                        'courseId' => $courseId,
                        'sectionId' => $sectionId,
                        'academicYearId' => $academicYearId,
                        'semesterId' => $semesterId,
                        'action' => $action
                    ]
                ]);

                // Log to PHP error log before sending message
                // error_log("PHP Log: Attempting to send WebSocket message: " . $wsMessage);
                $client->send($wsMessage);
                $client->close();
                // error_log("WebSocket message sent to advisor {$advisorEmployeeId}: " . $wsMessage.");

            } catch (Exception $e) {
                // Log WebSocket error to PHP error log
                error_log("PHP Log: WebSocket error sending grades notification: " . $e->getMessage());
            }
        } else {
             // Log "No advisor found" to PHP error log
             // error_log("PHP Log: No advisor found for section ID: " . $sectionId . " or advisor_employee_id is null.");
        }
        // --- End WebSocket Notification ---


        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => ($action === 'submit') ? "Grades submitted successfully" : "Grades saved successfully",
            "count" => $successCount
        ));
    } else {
        $conn->rollBack();
        http_response_code(400); // Use 400 for client-side validation errors on submit
        echo json_encode(array(
            "success" => false,
            "message" => "Failed to " . ($action === 'submit' ? "submit" : "save") . " grades. Some entries had errors.",
            "count" => $successCount,
            "total" => $totalCount,
            "errors" => $errors
        ));
    }

} catch (PDOException $e) {
    // Roll back the transaction if something failed
    if ($conn) {
        $conn->rollBack();
    }

    http_response_code(503);
    error_log("Database error in save_grades.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ));
} catch (Exception $e) {
    // Roll back the transaction if something failed
    if ($conn) {
        $conn->rollBack();
    }

    http_response_code(500);
    error_log("General error in save_grades.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ));
}
?>