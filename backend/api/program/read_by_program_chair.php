<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// Check if program chair ID is provided
if (!isset($_GET['id']) || empty($_GET['id'])) {
    http_response_code(400);
    echo json_encode(array("message" => "Program chair ID is required."));
    exit();
}

$programChairId = $_GET['id'];

try {
    // Query to get programs assigned to this program chair
    $query = "SELECT p.id, p.name, p.department_id, d.name as department_name 
              FROM programs p
              INNER JOIN program_chairs pc ON p.id = pc.program
              LEFT JOIN departments d ON p.department_id = d.id
              WHERE pc.employee_id = :program_chair_id
              ORDER BY p.name ASC";
    
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':program_chair_id', $programChairId);
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
        echo json_encode(array("message" => "No programs found for this program chair."));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?> 