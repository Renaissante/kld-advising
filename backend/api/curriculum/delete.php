<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// Get data from request
$data = json_decode(file_get_contents("php://input"));

// Check if curriculum ID is provided
if (!isset($data->curriculum_id) || empty($data->curriculum_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Curriculum ID is required"));
    exit();
}

$curriculum_id = $data->curriculum_id;

try {
    // Delete the curriculum directly without handling courses
    $delete_query = "DELETE FROM curriculums WHERE curriculum_id = :curriculum_id";
    $delete_stmt = $conn->prepare($delete_query);
    $delete_stmt->bindParam(':curriculum_id', $curriculum_id);
    
    if ($delete_stmt->execute() && $delete_stmt->rowCount() > 0) {
        http_response_code(200);
        echo json_encode(array(
            "message" => "Curriculum deleted successfully",
            "success" => true
        ));
    } else {
        http_response_code(404);
        echo json_encode(array(
            "message" => "No curriculum found with the given ID",
            "success" => false
        ));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array(
        "message" => "Database error: " . $e->getMessage(),
        "success" => false
    ));
}
?> 