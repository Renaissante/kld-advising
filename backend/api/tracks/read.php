<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

try {
    // Query to get tracks with program information
    $query = "SELECT t.id, t.track_name, t.program_id, p.name as program_name 
              FROM tracks t
              LEFT JOIN programs p ON t.program_id = p.id
              ORDER BY t.id ASC";
    
    $stmt = $conn->prepare($query);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $tracks_arr = array();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $track = array(
                "id" => $row['id'],
                "track_name" => $row['track_name'],
                "program_id" => $row['program_id'],
                "program_name" => $row['program_name'],
                "electives" => [] // Adding empty electives array as placeholder
            );
            array_push($tracks_arr, $track);
        }

        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "tracks" => $tracks_arr
        ));
    } else {
        http_response_code(200); // Still return 200 for empty results
        echo json_encode(array(
            "success" => true,
            "tracks" => []
        ));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array(
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ));
}
?>