<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

try {
    $query = "SELECT y.id, y.level 
              FROM year_levels y
              ORDER BY y.level ASC";
    $stmt = $conn->prepare($query);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $year_levels = array();
        $year_levels_arr = array();
        $year_levels_arr["records"] = array();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $year_level = array(
                "id" => $row['id'],
                "name" => $row['level']
            );
            array_push($year_levels_arr["records"], $year_level);
        }

        http_response_code(200);
        echo json_encode($year_levels_arr);
    } else {
        http_response_code(404);
        echo json_encode(array("message" => "No year levels found."));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?> 