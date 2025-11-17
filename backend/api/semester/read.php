<?php
// Include CORS headers
include_once '../../config/cors.php';

// header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

try {
    $query = "SELECT * FROM semesters ORDER BY semester_id ASC";
    $stmt = $conn->prepare($query);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $semesters = array();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $semester = array(
                "id" => $row['semester_id'],
                "name" => $row['semester_name'],
                "status" => $row['status'],
                "is_current" => (bool)$row['is_current']
            );
            array_push($semesters, $semester);
        }

        http_response_code(200);
        echo json_encode($semesters);
    } else {
        http_response_code(404);
        echo json_encode(array("message" => "No semesters found."));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?> 