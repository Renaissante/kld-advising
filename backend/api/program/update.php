<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id) && !empty($data->name)) {
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

        // Check for duplicate program name (excluding the current record)
        $check_query = "SELECT COUNT(*) FROM programs WHERE name = :name AND id != :id";
        $check_stmt = $conn->prepare($check_query);
        $check_stmt->bindParam(":name", $data->name);
        $check_stmt->bindParam(":id", $data->id);
        $check_stmt->execute();
        
        if ($check_stmt->fetchColumn() > 0) {
            http_response_code(400);
            echo json_encode(array("message" => "Program with this name already exists."));
            exit();
        }

        // Prepare SQL query
        $query = "UPDATE programs 
                 SET name = :name, 
                     department_id = :department_id
                 WHERE id = :id";

        $stmt = $conn->prepare($query);

        // Sanitize and bind data
        $id = htmlspecialchars(strip_tags($data->id));
        $name = htmlspecialchars(strip_tags($data->name));
        
        // If department_id is not provided, it will be NULL
        $department_id = null;
        if (!empty($data->department_id)) {
            $department_id = htmlspecialchars(strip_tags($data->department_id));
        }

        $stmt->bindParam(":id", $id);
        $stmt->bindParam(":name", $name);
        $stmt->bindParam(":department_id", $department_id);

        if ($stmt->execute()) {
            // Get the updated record with department name
            $select_query = "SELECT p.id, p.name, p.department_id, d.name as department_name 
                            FROM programs p
                            LEFT JOIN departments d ON p.department_id = d.id
                            WHERE p.id = :id";
            $select_stmt = $conn->prepare($select_query);
            $select_stmt->bindParam(":id", $id);
            $select_stmt->execute();
            $updated_record = $select_stmt->fetch(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode(array(
                "message" => "Program was updated successfully.",
                "program" => array(
                    "id" => $updated_record['id'],
                    "name" => $updated_record['name'],
                    "department_id" => $updated_record['department_id'],
                    "department_name" => $updated_record['department_name']
                )
            ));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to update program."));
        }
    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to update program. ID and name are required."));
}
?> 