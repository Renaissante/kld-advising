<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';

// Start session to check for logged in user
session_start();

$data = json_decode(file_get_contents("php://input"));

if (!isset($data->student_id) || !isset($data->section_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data. Provide student_id and section_id."));
    exit();
}

// // Check if user is logged in and is an admin
// if (!isset($_SESSION['user_id']) || !in_array('admin', $_SESSION['user_roles'])) {
//     http_response_code(403);
//     echo json_encode(array("message" => "Forbidden: You do not have permission to unassign students from sections."));
//     exit();
// }

$student_id_raw = $data->student_id;
$section_id = (int)$data->section_id; // Ensure section_id is an integer

$is_irregular_student = false;
$irregular_enrollment_id = null;
$student_db_id = null;

// Check if student_id is a composite string for irregular students
if (strpos($student_id_raw, 'irregular-') === 0) {
    $is_irregular_student = true;
    $parts = explode('-', $student_id_raw);
    if (count($parts) >= 3 && is_numeric($parts[1]) && is_numeric($parts[2])) {
        $student_db_id = (int)$parts[1];
        $irregular_enrollment_id = (int)$parts[2];
    } else {
        http_response_code(400);
        echo json_encode(array("message" => "Invalid irregular student ID format."));
        exit();
    }
} else if (strpos($student_id_raw, 'regular-') === 0) { // Handle regular students
    $is_irregular_student = false;
    $parts = explode('-', $student_id_raw);
    if (count($parts) >= 3 && is_numeric($parts[1]) && is_numeric($parts[2])) {
        $student_db_id = (int)$parts[1];
        // $sse_id = (int)$parts[2]; // Not needed for deletion here
    } else {
        http_response_code(400);
        echo json_encode(array("message" => "Invalid regular student ID format."));
        exit();
    }
} else {
    // Fallback or error if format is unknown (e.g., direct student_db_id without prefix)
    http_response_code(400);
    echo json_encode(array("message" => "Unknown student ID format."));
    exit();
}

$conn->beginTransaction();

try {
    if ($is_irregular_student) {
        // For irregular students, delete from irregular_course_enrollments
        $delete_irregular_enrollment_query = "DELETE FROM irregular_course_enrollments WHERE id = :irregular_enrollment_id AND section_id = :section_id";
        $delete_irregular_enrollment_stmt = $conn->prepare($delete_irregular_enrollment_query);
        $delete_irregular_enrollment_stmt->bindParam(':irregular_enrollment_id', $irregular_enrollment_id, PDO::PARAM_INT);
        $delete_irregular_enrollment_stmt->bindParam(':section_id', $section_id, PDO::PARAM_INT);
        $delete_irregular_enrollment_stmt->execute();

        // Check if any row was deleted
        if ($delete_irregular_enrollment_stmt->rowCount() === 0) {
            throw new Exception("Irregular student enrollment not found or already unassigned.");
        }
    } else {
        // For regular students, update students table and delete from student_section_enrollments
        $update_student_query = "UPDATE students SET section_id = NULL WHERE id = :student_db_id";
        $update_student_stmt = $conn->prepare($update_student_query);
        $update_student_stmt->bindParam(':student_db_id', $student_db_id, PDO::PARAM_INT);
        $update_student_stmt->execute();

        $delete_enrollment_query = "DELETE FROM student_section_enrollments WHERE student_id = :student_db_id AND section_id = :section_id";
        $delete_enrollment_stmt = $conn->prepare($delete_enrollment_query);
        $delete_enrollment_stmt->bindParam(':student_db_id', $student_db_id, PDO::PARAM_INT);
        $delete_enrollment_stmt->bindParam(':section_id', $section_id, PDO::PARAM_INT);
        $delete_enrollment_stmt->execute();
        
        if ($delete_enrollment_stmt->rowCount() === 0) {
            throw new Exception("Regular student enrollment not found or already unassigned.");
        }
    }

    $conn->commit();

    http_response_code(200);
    echo json_encode(array("message" => "Student unassigned successfully."));

} catch (Exception $e) {
    $conn->rollBack();
    http_response_code(503);
    echo json_encode(array("message" => "Unable to unassign student: " . $e->getMessage()));
}
?>