<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id)) {
    try {
        // Check if academic year exists
        $check_query = "SELECT COUNT(*) FROM academic_years WHERE academic_year_id = :id";
        $check_stmt = $conn->prepare($check_query);
        $check_stmt->bindParam(":id", $data->id);
        $check_stmt->execute();
        
        if ($check_stmt->fetchColumn() == 0) {
            http_response_code(404);
            echo json_encode(array("message" => "Academic year not found."));
            exit();
        }

        // Check if academic year is being used in curriculums
        // $check_usage_query = "SELECT COUNT(*) FROM curriculums WHERE academic_year_id = :id";
        // $check_usage_stmt = $conn->prepare($check_usage_query);
        // $check_usage_stmt->bindParam(":id", $data->id);
        // $check_usage_stmt->execute();
        
        // if ($check_usage_stmt->fetchColumn() > 0) {
        //     http_response_code(400);
        //     echo json_encode(array("message" => "Cannot delete academic year. It is being used in curriculums."));
        //     exit();
        // }

        $query = "DELETE FROM academic_years WHERE academic_year_id = :id";
        $stmt = $conn->prepare($query);

        // Sanitize and bind data
        $id = htmlspecialchars(strip_tags($data->id));
        $stmt->bindParam(":id", $id);

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(array("message" => "Academic year was deleted."));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to delete academic year."));
        }
    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to delete academic year. ID is required."));
}
?> 