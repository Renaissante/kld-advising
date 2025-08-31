<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!isset($data->student_id) || !isset($data->section_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data. Provide student_id and section_id."));
    exit();
}

$student_id = $data->student_id;
$section_id = $data->section_id;

$conn->beginTransaction();

try {
    // 1. Update students table to set section_id to NULL
    $update_student_query = "UPDATE students SET section_id = NULL WHERE id = :student_id";
    $update_student_stmt = $conn->prepare($update_student_query);
    $update_student_stmt->bindParam(':student_id', $student_id);
    $update_student_stmt->execute();

    // 2. Update student_section_enrollments to set enrollment_status to 'removed' and completed_at
    $update_enrollment_query = "DELETE FROM student_section_enrollments
                                WHERE student_id = :student_id AND section_id = :section_id";
    $update_enrollment_stmt = $conn->prepare($update_enrollment_query);
    $update_enrollment_stmt->bindParam(':student_id', $student_id);
    $update_enrollment_stmt->bindParam(':section_id', $section_id);
    $update_enrollment_stmt->execute();

    $conn->commit();

    http_response_code(200);
    echo json_encode(array("message" => "Student unassigned successfully."));

} catch (Exception $e) {
    $conn->rollBack();
    http_response_code(503);
    echo json_encode(array("message" => "Unable to unassign student: " . $e->getMessage()));
}
?>