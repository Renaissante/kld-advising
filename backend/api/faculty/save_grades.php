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

// Before processing individual students, fetch their current grades for this course
$studentIds = array_column($students, 'student_id');
$existingGrades = [];
if (!empty($studentIds)) {
    $placeholders = implode(',', array_fill(0, count($studentIds), '?'));
    $getExistingGradesQuery = "SELECT student_id, remarks FROM course_grades
                               WHERE student_id IN ($placeholders) AND course_id = ?";
    $getExistingGradesStmt = $conn->prepare($getExistingGradesQuery);
    $getExistingGradesStmt->execute(array_merge($studentIds, [$courseId]));
    while ($row = $getExistingGradesStmt->fetch(PDO::FETCH_ASSOC)) {
        $existingGrades[$row['student_id']] = $row['remarks'];
    }
}

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
    $warnings = []; // Initialize warnings array
    $studentsToUpdateStatus = []; // Array to store student_ids that need status update

    // Arrays to hold data for batch operations
    $gradesToInsertOrUpdate = [];
    $studentStatusChanges = [];

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

        $gradesToInsertOrUpdate[] = [
            'student_id' => $studentId,
            'course_id' => $courseId,
            'transmutation' => $transmutation,
            'remarks' => $remarks
        ];

        // Capture previous remarks if available to determine status changes
        $oldRemarks = isset($existingGrades[$studentId]) ? $existingGrades[$studentId] : null;

        // Logic to set student to 'Irregular' if a current course is failed and has un-passed prerequisites
        if ($remarks === "Failed") {
            // We need to check if this failed course is a prerequisite for other courses
            // This check still requires a database query. We'll collect student IDs here.
            $studentStatusChanges[$studentId] = 'Irregular'; // Tentatively mark as irregular
        }
        // Logic to set student back to 'Regular' if grade changes from Failed to Passed
        else if ($oldRemarks === "Failed" && $remarks === "Passed") {
            // This also requires further checks, collecting student IDs here
            $studentStatusChanges[$studentId] = 'Regular_Check'; // Mark for further check to become Regular
        }
    }

    // Batch Insert/Update for course_grades
    if (!empty($gradesToInsertOrUpdate)) {
        $insertValues = [];
        $updateAssignments = [];
        $params = [];
        $paramIndex = 0;

        foreach ($gradesToInsertOrUpdate as $gradeEntry) {
            $insertValues[] = "(:p" . $paramIndex . ", :p" . ($paramIndex + 1) . ", :p" . ($paramIndex + 2) . ", :p" . ($paramIndex + 3) . ")";
            $params[":p" . $paramIndex] = $gradeEntry['student_id'];
            $params[":p" . ($paramIndex + 1)] = $gradeEntry['course_id'];
            $params[":p" . ($paramIndex + 2)] = $gradeEntry['transmutation'];
            $params[":p" . ($paramIndex + 3)] = $gradeEntry['remarks'];
            $paramIndex += 4;
        }

        // The ON CONFLICT DO UPDATE clause will ensure existing rows are updated and new rows are inserted.
        // We're using EXCLUDED.column to refer to the values that would have been inserted.
        $batchInsertUpdateQuery = "INSERT INTO course_grades (student_id, course_id, transmutation, remarks) VALUES " .
                                  implode(", ", $insertValues) .
                                  " ON CONFLICT (student_id, course_id) DO UPDATE SET " .
                                  "transmutation = EXCLUDED.transmutation, " .
                                  "remarks = EXCLUDED.remarks, " .
                                  "updated_at = NOW()";

        $batchStmt = $conn->prepare($batchInsertUpdateQuery);
        $batchStmt->execute($params);
        $successCount = $batchStmt->rowCount(); // This will be the number of rows affected (inserted or updated)
    }

    // Process student status changes based on collected data
    $studentsToSetIrregular = [];
    $studentsToPossiblySetRegular = [];

    foreach ($studentStatusChanges as $sId => $statusAction) {
        if ($statusAction === 'Irregular') {
            $studentsToSetIrregular[] = $sId;
        } else if ($statusAction === 'Regular_Check') {
            $studentsToPossiblySetRegular[] = $sId;
        }
    }

    // Optimized check for students to become 'Irregular'
    if (!empty($studentsToSetIrregular)) {
        $placeholders = implode(',', array_fill(0, count($studentsToSetIrregular), '?'));
        // Query to check if the *failed course* for any of these students is a prerequisite for *any other course*.
        $prereqCheckQuery = "SELECT DISTINCT s.student_id
                             FROM students s
                             JOIN course_grades cg ON s.student_id = cg.student_id
                             JOIN course_prerequisites cp ON cg.course_id = cp.prerequisite_course_id
                             WHERE s.student_id IN ($placeholders)
                               AND cg.remarks = 'Failed'";

        $prereqCheckStmt = $conn->prepare($prereqCheckQuery);
        $prereqCheckStmt->execute($studentsToSetIrregular);
        $actualIrregularStudents = $prereqCheckStmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($actualIrregularStudents as $sid) {
            $studentsToUpdateStatus[] = ['id' => $sid, 'status' => 'Irregular'];
            $warnings[] = "Student ID: {$sid} has been marked Irregular due to failing a prerequisite course.";
        }
    }

    // Optimized check for students to become 'Regular'
    if (!empty($studentsToPossiblySetRegular)) {
        $placeholders = implode(',', array_fill(0, count($studentsToPossiblySetRegular), '?'));
        // Find students who have *no outstanding failed prerequisites* for any course they are enrolled in or need to take.
        // This means, for any course a student is NOT passed in, if that course has prerequisites, all those prerequisites must be passed.
        $studentsWithOutstandingFailedPrereqsQuery = "SELECT DISTINCT s.student_id
                                                      FROM students s
                                                      JOIN student_course_enrollments sce ON s.student_id = sce.student_id
                                                      JOIN courses c_main ON sce.course_id = c_main.id
                                                      LEFT JOIN course_prerequisites cp ON c_main.id = cp.course_id
                                                      LEFT JOIN course_grades cg_prereq ON s.student_id = cg_prereq.student_id AND cp.prerequisite_course_id = cg_prereq.course_id
                                                      WHERE s.student_id IN ($placeholders)
                                                        AND (
                                                                (cg_prereq.remarks = 'Failed') OR 
                                                                (cp.prerequisite_course_id IS NOT NULL AND cg_prereq.remarks IS NULL)
                                                            )";
        $studentsWithOutstandingFailedPrereqsStmt = $conn->prepare($studentsWithOutstandingFailedPrereqsQuery);
        $studentsWithOutstandingFailedPrereqsStmt->execute($studentsToPossiblySetRegular);
        $studentsWithRemainingFailedPrereqs = $studentsWithOutstandingFailedPrereqsStmt->fetchAll(PDO::FETCH_COLUMN);

        $studentsWhoCanBeRegular = array_diff($studentsToPossiblySetRegular, $studentsWithRemainingFailedPrereqs);

        foreach ($studentsWhoCanBeRegular as $sid) {
            $studentsToUpdateStatus[] = ['id' => $sid, 'status' => 'Regular'];
        }
    }


    // Commit or rollback transaction based on success
    if (empty($errors)) { // Commit only if there are no errors
        // Update student enrollment status for those who failed a prerequisite
        if (!empty($studentsToUpdateStatus)) {
            $updateStudentStatusQueries = [];
            $updateStudentStatusParams = [];

            foreach ($studentsToUpdateStatus as $studentUpdate) {
                $studentIdToUpdate = is_array($studentUpdate) ? $studentUpdate['id'] : $studentUpdate;
                $newStatus = is_array($studentUpdate) ? $studentUpdate['status'] : 'Irregular';

                $updateStudentStatusQueries[] = "UPDATE students SET enrollment_status = ? WHERE student_id = ? AND enrollment_status != ?";
                $updateStudentStatusParams[] = $newStatus;
                $updateStudentStatusParams[] = $studentIdToUpdate;
                $updateStudentStatusParams[] = $newStatus;
            }
            
            // Execute all student status updates in a single transaction (already in a transaction)
            foreach ($updateStudentStatusQueries as $idx => $query) {
                $stmt = $conn->prepare($query);
                // Assuming parameters are in order: new_status, student_id, new_status
                $stmt->execute([$updateStudentStatusParams[$idx * 3], $updateStudentStatusParams[$idx * 3 + 1], $updateStudentStatusParams[$idx * 3 + 2]]);
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
                $client = new WebSocket\Client("ws://192.168.18.6:8080");

              
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
            "count" => $successCount,
            "warnings" => $warnings // Include warnings in the response
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