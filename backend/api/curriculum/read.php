<?php
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php-error.log'); // You might want to define a specific log file path
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

try {
    $query = "SELECT c.curriculum_id as id, c.name, c.program_id, p.name as program, 
              c.academic_year_id, COALESCE(ay.academic_year_name, '') as academicYear, c.status 
              FROM curriculums c
              INNER JOIN programs p ON c.program_id = p.id
              LEFT JOIN academic_years ay ON c.academic_year_id = ay.academic_year_id
              ORDER BY c.name ASC";
    $stmt = $conn->prepare($query);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $curriculums = array();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $curriculum = array(
                "id" => $row['id'],
                "name" => $row['name'],
                "program_id" => $row['program_id'],
                "program" => $row['program'],
                "academic_year_id" => $row['academic_year_id'],
                "academicYear" => $row['academicYear'] ?? '', // Safe access
                "status" => $row['status']
            );
            array_push($curriculums, $curriculum);
        }

        http_response_code(200);
        echo json_encode($curriculums);
    } else {
        http_response_code(404);
        echo json_encode(array("message" => "No curriculums found."));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?> 