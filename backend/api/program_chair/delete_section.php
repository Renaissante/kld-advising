<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

// Validate input
if (!isset($data->section_id) || empty($data->section_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Section ID is required."));
    exit();
}

$section_id = $data->section_id;

try {
    // Delete section
    $query = "DELETE FROM sections WHERE id = :section_id";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':section_id', $section_id);

    if ($stmt->execute()) {
        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode(array("message" => "Section deleted successfully."));
        } else {
            http_response_code(404);
            echo json_encode(array("message" => "Section not found."));
        }
    } else {
        http_response_code(503);
        echo json_encode(array("message" => "Unable to delete section."));
    }

} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>
