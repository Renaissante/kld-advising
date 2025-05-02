<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->name)) {
    try {
        $query = "INSERT INTO year_levels(level) VALUES(:level)";
        $stmt = $conn->prepare($query);
        
        // Sanitize and bind
        $level = htmlspecialchars(strip_tags($data->name));
        $stmt->bindParam(":level", $level);
        
        if ($stmt->execute()) {
            $id = $conn->lastInsertId();
            
            http_response_code(201);
            echo json_encode(array(
                "message" => "Year level was created successfully.",
                "year_level" => array(
                    "id" => $id,
                    "name" => $level
                )
            ));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to create year level."));
        }
    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to create year level. Data is incomplete."));
}
?> 