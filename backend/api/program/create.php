<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->name)) {
    try {
        // Check for duplicate program name
        $check_query = "SELECT COUNT(*) FROM programs WHERE name = :name";
        $check_stmt = $conn->prepare($check_query);
        $check_stmt->bindParam(":name", $data->name);
        $check_stmt->execute();
        
        if ($check_stmt->fetchColumn() > 0) {
            http_response_code(400);
            echo json_encode(array("message" => "Program with this name already exists."));
            exit();
        }

        // Prepare SQL query
        $query = "INSERT INTO programs (name, department_id, created_at) VALUES (:name, :department_id, NOW())";
        $stmt = $conn->prepare($query);

        // Sanitize and bind data
        $name = htmlspecialchars(strip_tags($data->name));
        
        // If department_id is not provided, it will be NULL (which is allowed according to the schema)
        $department_id = null;
        if (!empty($data->department_id)) {
            $department_id = htmlspecialchars(strip_tags($data->department_id));
        }

        $stmt->bindParam(":name", $name);
        $stmt->bindParam(":department_id", $department_id);

        if ($stmt->execute()) {
            // Get the newly created record
            $new_id = $conn->lastInsertId();
            
            // Query to get the department name if applicable
            $select_query = "SELECT p.id, p.name, p.department_id, d.name as department_name 
                            FROM programs p
                            LEFT JOIN departments d ON p.department_id = d.id
                            WHERE p.id = :id";
            $select_stmt = $conn->prepare($select_query);
            $select_stmt->bindParam(":id", $new_id);
            $select_stmt->execute();
            $new_record = $select_stmt->fetch(PDO::FETCH_ASSOC);

            http_response_code(201);
            echo json_encode(array(
                "message" => "Program was created successfully.",
                "program" => array(
                    "id" => $new_record['id'],
                    "name" => $new_record['name'],
                    "department_id" => $new_record['department_id'],
                    "department_name" => $new_record['department_name']
                )
            ));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to create program."));
        }
    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to create program. Program name is required."));
}
?> 