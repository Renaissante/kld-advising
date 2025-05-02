<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

try {
    $query = "SELECT p.id, p.name, p.department_id, d.name as department_name 
              FROM programs p
              LEFT JOIN departments d ON p.department_id = d.id
              ORDER BY p.name ASC";
    $stmt = $conn->prepare($query);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $programs = array();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $program = array(
                "id" => $row['id'],
                "name" => $row['name'],
                "department_id" => $row['department_id'],
                "department_name" => $row['department_name']
            );
            array_push($programs, $program);
        }

        http_response_code(200);
        echo json_encode($programs);
    } else {
        http_response_code(404);
        echo json_encode(array("message" => "No programs found."));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?> 