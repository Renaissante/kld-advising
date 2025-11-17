<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

try {
    $query = "SELECT * FROM academic_years ORDER BY academic_year_id DESC";
    $stmt = $conn->prepare($query);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $academic_years = array();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $academic_year = array(
                "id" => $row['academic_year_id'],
                "year" => $row['academic_year_name'],
                "startDate" => $row['start_date'],
                "endDate" => $row['end_date'],
                "status" => $row['status'],
                "is_current" => (bool)$row['is_current']
            );
            array_push($academic_years, $academic_year);
        }

        http_response_code(200);
        echo json_encode($academic_years);
    } else {
        http_response_code(404);
        echo json_encode(array("message" => "No academic years found."));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?> 