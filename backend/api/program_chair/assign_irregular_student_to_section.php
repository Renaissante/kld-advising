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
    error_log("Database connection failed in assign_irregular_student_to_section.php.");
    echo json_encode(array("success" => false, "message" => "Database connection failed."));
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
$studentDbId = isset($data['student_id']) ? intval($data['student_id']) : null; // This is students.id
$sectionId = isset($data['section_id']) ? intval($data['section_id']) : null;
$courseIdToRetake = isset($data['course_id_to_retake']) ? intval($data['course_id_to_retake']) : null;

if (!$studentDbId || !$sectionId || !$courseIdToRetake) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Missing required data: student_id, section_id, or course_id_to_retake"));
    exit();
}

try {
    $conn->beginTransaction();

    // Get the course code for the selected course to retake
    $getCourseCodeQuery = "SELECT course_code FROM courses WHERE id = :course_id";
    $getCourseCodeStmt = $conn->prepare($getCourseCodeQuery);
    $getCourseCodeStmt->bindParam(':course_id', $courseIdToRetake, PDO::PARAM_INT);
    $getCourseCodeStmt->execute();
    $courseCodeToRetake = $getCourseCodeStmt->fetchColumn();

    if (!$courseCodeToRetake) {
        $conn->rollBack();
        http_response_code(400); // Bad Request
        echo json_encode(array("success" => false, "message" => "Invalid course selected for retake."));
        exit();
    }

    // Verify the student has actually failed this course (using course_code)
    $verifyFailedQuery = "SELECT cg.id FROM course_grades cg
                          JOIN courses c ON cg.course_id = c.id
                          WHERE cg.student_id = (SELECT student_id FROM students WHERE id = :student_db_id)
                          AND c.course_code = :course_code_to_retake
                          AND cg.remarks = 'Failed'";
    $verifyFailedStmt = $conn->prepare($verifyFailedQuery);
    $verifyFailedStmt->bindParam(':student_db_id', $studentDbId, PDO::PARAM_INT);
    $verifyFailedStmt->bindParam(':course_code_to_retake', $courseCodeToRetake, PDO::PARAM_STR);
    $verifyFailedStmt->execute();

    if ($verifyFailedStmt->rowCount() === 0) {
        $conn->rollBack();
        http_response_code(400); // Bad Request
        echo json_encode(array("success" => false, "message" => "Student has not failed a course with this code, or already passed it."));
        exit();
    }

    // Check if the student is already enrolled in this section for this course as a retake
    $checkQuery = "SELECT id FROM irregular_course_enrollments
                   WHERE student_id = :student_id
                   AND section_id = :section_id
                   AND course_id = :course_id
                   AND enrollment_type = 'Retake'";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bindParam(':student_id', $studentDbId, PDO::PARAM_INT);
    $checkStmt->bindParam(':section_id', $sectionId, PDO::PARAM_INT);
    $checkStmt->bindParam(':course_id', $courseIdToRetake, PDO::PARAM_INT);
    $checkStmt->execute();

    if ($checkStmt->rowCount() > 0) {
        $conn->rollBack();
        http_response_code(409); // Conflict
        echo json_encode(array("success" => false, "message" => "Student is already enrolled in this retake course for this section."));
        exit();
    }

    // Insert new entry into irregular_course_enrollments
    $insertQuery = "INSERT INTO irregular_course_enrollments (
                        student_id, section_id, course_id, enrollment_type
                    ) VALUES (
                        :student_id, :section_id, :course_id, 'Retake'
                    )";
    $insertStmt = $conn->prepare($insertQuery);
    $insertStmt->bindParam(':student_id', $studentDbId, PDO::PARAM_INT);
    $insertStmt->bindParam(':section_id', $sectionId, PDO::PARAM_INT);
    $insertStmt->bindParam(':course_id', $courseIdToRetake, PDO::PARAM_INT);

    if (!$insertStmt->execute()) {
        $conn->rollBack();
        throw new Exception("Failed to enroll irregular student in retake course.");
    }

    $conn->commit();
    http_response_code(201); // Created
    echo json_encode(array("success" => true, "message" => "Irregular student assigned to retake course successfully."));

} catch (PDOException $e) {
    if ($conn->inTransaction()) { $conn->rollBack(); }
    http_response_code(503);
    error_log("Database error in assign_irregular_student_to_section.php: " . $e->getMessage());
    echo json_encode(array("success" => false, "message" => "Database error: " . $e->getMessage()));
} catch (Exception $e) {
    if ($conn->inTransaction()) { $conn->rollBack(); }
    http_response_code(500);
    error_log("General error in assign_irregular_student_to_section.php: " . $e->getMessage());
    echo json_encode(array("success" => false, "message" => "Server error: " . $e->getMessage()));
}

?>
