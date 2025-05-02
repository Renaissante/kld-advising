<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id)) {
    try {
        // Check if the provided ID exists
        $check_id_query = "SELECT COUNT(*) FROM programs WHERE id = :id";
        $check_id_stmt = $conn->prepare($check_id_query);
        $check_id_stmt->bindParam(":id", $data->id);
        $check_id_stmt->execute();
        
        if ($check_id_stmt->fetchColumn() == 0) {
            http_response_code(404);
            echo json_encode(array("message" => "Program not found."));
            exit();
        }

        // Check if the program is referenced in curriculums or other tables
        // Comment this out if you don't have a curriculums table yet or adjust as needed
        // $check_usage_query = "SELECT COUNT(*) FROM curriculums WHERE program_id = :id";
        // $check_usage_stmt = $conn->prepare($check_usage_query);
        // $check_usage_stmt->bindParam(":id", $data->id);
        // $check_usage_stmt->execute();
        
        // if ($check_usage_stmt->fetchColumn() > 0) {
        //     http_response_code(400);
        //     echo json_encode(array("message" => "Cannot delete program. It is being used in curriculums."));
        //     exit();
        // }

        // Delete the program
        $query = "DELETE FROM programs WHERE id = :id";
        $stmt = $conn->prepare($query);
        
        // Sanitize and bind data
        $id = htmlspecialchars(strip_tags($data->id));
        $stmt->bindParam(":id", $id);

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(array("message" => "Program was deleted successfully."));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to delete program."));
        }
    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to delete program. Program ID is required."));
}
?> 