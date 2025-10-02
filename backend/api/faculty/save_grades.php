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
    } else {
        http_response_code(403);
        echo json_encode(array("success" => false, "message" => "Forbidden: User roles not found in session"));
        exit();
    }
}

// Validate required parameters
if (!$facultyId) {
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

// Function to calculate transmutation
function calculateTransmutation($average) {
    if ($average === null || $average === "") return null;

    $numAverage = floatval($average);

    if (is_nan($numAverage)) return null;

    if ($numAverage >= 97) return "1.00";
    if ($numAverage >= 94) return "1.25";
    if ($numAverage >= 91) return "1.50";
    if ($numAverage >= 88) return "1.75";
    if ($numAverage >= 85) return "2.00";
    if ($numAverage >= 82) return "2.25";
    if ($numAverage >= 79) return "2.50";
    if ($numAverage >= 76) return "2.75";
    if ($numAverage >= 70) return "3.00";
    if ($numAverage >= 65) return "5.00";
    return "5.00"; // Failing grade
  }

// Function to get remarks based on transmutation
function getDefaultRemarks($transmutation) {
    if ($transmutation === null || $transmutation === "") return null;
    if ($transmutation === "5.00") return "Failed";
    return "Passed";
}

// Determine status based on action (This status is for the grade entry itself, not the student's course status)
// $status = ($action === 'submit') ? 'submitted' : 'draft'; // This status field doesn't seem to exist in the schema based on get_students.php

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

    foreach ($students as $student) {
        // Extract student data
        $studentId = isset($student['student_id']) ? $student['student_id'] : null;
        // Numeric grades (can be null)
        $midterm = isset($student['midterm']) && $student['midterm'] !== "" ? floatval($student['midterm']) : null;
        $final = isset($student['final']) && $student['final'] !== "" ? floatval($student['final']) : null;
        // Status grades (can be null, 'UD', or 'OD')
        $midtermStatus = isset($student['midterm_status']) && $student['midterm_status'] !== "" ? $student['midterm_status'] : null;
        $finalStatus = isset($student['final_status']) && $student['final_status'] !== "" ? $student['final_status'] : null;

        // Calculate average, transmutation, and remarks based on status first
        $calculatedAverage = null;
        $transmutedGrade = null;
        $remarks = null;

        if ($midtermStatus === 'UD' || $midtermStatus === 'OD') {
            // If midterm status is set, final status should also be set to the same value
            $finalStatus = $midtermStatus; // Ensure consistency
            $calculatedAverage = 0.00; // Average is 0 for dropped
            $transmutedGrade = 0.00; // Transmutation is 0 for dropped
            $remarks = $midtermStatus === 'UD' ? "Unofficially Dropped" : "Officially Dropped";
        } else {
            // No midterm status, calculate based on numeric grades if available
            $isMidtermNumericValid = $midterm !== null && $midterm >= 0 && $midterm <= 100;
            $isFinalNumericValid = $final !== null && $final >= 0 && $final <= 100;

            if ($isMidtermNumericValid && $isFinalNumericValid) {
                $calculatedAverage = ($midterm + $final) / 2;
                $transmutedGrade = calculateTransmutation($calculatedAverage);
                $remarks = getDefaultRemarks($transmutedGrade);
            }
            // If not both numeric valid, average, transmutation, and remarks remain null
        }

        // For submission, validate all required fields
        if ($action === 'submit') {
            // Check if either status is set OR both numeric grades are valid
            $isValidForSubmission = ($midtermStatus === 'UD' || $midtermStatus === 'OD') || ($isMidtermNumericValid && $isFinalNumericValid);

            if (!$isValidForSubmission) {
                 $errors[] = "Missing or invalid grades for student ID: $studentId. Must have valid numeric grades or a valid status (UD/OD).";
                 continue; // Skip saving for this student if validation fails on submit
            }
        }


        // Check if an entry already exists
        $checkQuery = "SELECT id FROM course_grades
                       WHERE student_id = :student_id
                       AND course_id = :course_id";

        $checkStmt = $conn->prepare($checkQuery);
        $checkStmt->bindParam(':student_id', $studentId);
        $checkStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
        $checkStmt->execute();

        if ($checkStmt->rowCount() > 0) {
            // Update existing entry
            $updateQuery = "UPDATE course_grades
                           SET midterm = :midterm,
                               final = :final,
                               midterm_status = :midterm_status,
                               final_status = :final_status,
                               average = :average,
                               transmutation = :transmutation,
                               remarks = :remarks,
                               updated_at = NOW()
                           WHERE student_id = :student_id
                           AND course_id = :course_id";

            $updateStmt = $conn->prepare($updateQuery);
            $updateStmt->bindParam(':midterm', $midterm);
            $updateStmt->bindParam(':final', $final);
            $updateStmt->bindParam(':midterm_status', $midtermStatus);
            $updateStmt->bindParam(':final_status', $finalStatus);
            $updateStmt->bindParam(':average', $calculatedAverage);
            $updateStmt->bindParam(':transmutation', $transmutedGrade);
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
                              student_id, course_id, midterm, final, midterm_status, final_status, average, transmutation, remarks
                           ) VALUES (
                              :student_id, :course_id, :midterm, :final, :midterm_status, :final_status, :average, :transmutation, :remarks
                           )";

            $insertStmt = $conn->prepare($insertQuery);
            $insertStmt->bindParam(':student_id', $studentId);
            $insertStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
            $insertStmt->bindParam(':midterm', $midterm);
            $insertStmt->bindParam(':final', $final);
            $insertStmt->bindParam(':midterm_status', $midtermStatus);
            $insertStmt->bindParam(':final_status', $finalStatus);
            $insertStmt->bindParam(':average', $calculatedAverage);
            $insertStmt->bindParam(':transmutation', $transmutedGrade);
            $insertStmt->bindParam(':remarks', $remarks);

            if ($insertStmt->execute()) {
                $successCount++;
            } else {
                $errors[] = "Failed to save grades for student ID: $studentId";
            }
        }
    }

    // Commit or rollback transaction based on success
    if (empty($errors)) { // Commit only if there are no errors
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
                // error_log("WebSocket message sent to advisor {$advisorEmployeeId}: " . $wsMessage);

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