<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id)) {
    try {
        $query = "DELETE FROM year_levels WHERE id = :id";
        $stmt = $conn->prepare($query);
        
        // Sanitize and bind
        $id = htmlspecialchars(strip_tags($data->id));
        $stmt->bindParam(":id", $id);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(array("message" => "Year level was deleted successfully."));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to delete year level."));
        }
    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to delete year level. Data is incomplete."));
}
?> 