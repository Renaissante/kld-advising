<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// Get data from request
$data = json_decode(file_get_contents("php://input"));

// Check if course ID is provided
if (!isset($data->course_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Course ID is required", "success" => false));
    exit();
}

$course_id = $data->course_id;

try {
    // Delete the course
    $query = "DELETE FROM courses WHERE id = :course_id";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':course_id', $course_id);
    
    if ($stmt->execute() && $stmt->rowCount() > 0) {
        http_response_code(200);
        echo json_encode(array(
            "message" => "Course deleted successfully",
            "success" => true
        ));
    } else {
        http_response_code(404);
        echo json_encode(array(
            "message" => "Course not found or already deleted",
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