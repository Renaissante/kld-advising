<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Validate input
if (!isset($data->id) || empty($data->id)) {
    http_response_code(400);
    echo json_encode(array(
        "success" => false,
        "message" => "Elective course ID is required."
    ));
    exit();
}

try {
    // First check if elective course exists
    $check_query = "SELECT id, course_id FROM elective_courses WHERE id = :id";
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(':id', $data->id);
    $check_stmt->execute();

    if ($check_stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array(
            "success" => false,
            "message" => "Elective course not found."
        ));
        exit();
    }

    // Get the course_id before deletion
    $elective = $check_stmt->fetch(PDO::FETCH_ASSOC);
    $course_id = $elective['course_id'];

    // Start transaction
    $conn->beginTransaction();

    try {
        // First delete from elective_courses
        $delete_elective_query = "DELETE FROM elective_courses WHERE id = :id";
        $delete_elective_stmt = $conn->prepare($delete_elective_query);
        $delete_elective_stmt->bindParam(':id', $data->id);
        $delete_elective_stmt->execute();

        // Then delete from courses
        $delete_course_query = "DELETE FROM courses WHERE id = :course_id";
        $delete_course_stmt = $conn->prepare($delete_course_query);
        $delete_course_stmt->bindParam(':course_id', $course_id);
        $delete_course_stmt->execute();

        // Commit transaction
        $conn->commit();

        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Elective course deleted successfully."
        ));
    } catch (PDOException $e) {
        // Rollback transaction on error
        $conn->rollBack();
        throw $e;
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array(
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ));
}
?>