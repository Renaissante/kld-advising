<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// Check if track ID is provided
if (!isset($_GET['track_id'])) {
    http_response_code(400);
    echo json_encode(array(
        "success" => false,
        "message" => "Track ID is required."
    ));
    exit();
}

try {
    $track_id = $_GET['track_id'];

    // Query to get elective courses with course details
    $query = "SELECT ec.id, ec.course_id, ec.track_id,
                     c.course_code, c.course_title, 
                     c.unit_lec, c.unit_lab,
                     c.hour_lec, c.hour_lab
              FROM elective_courses ec
              JOIN courses c ON ec.course_id = c.id
              WHERE ec.track_id = :track_id
              ORDER BY c.id";
    
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':track_id', $track_id);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $electives = array();
        
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $total_units = $row['unit_lec'] + $row['unit_lab'];
            
            $elective = array(
                "id" => $row['id'],
                "course_id" => $row['course_id'],
                "track_id" => $row['track_id'],
                "course_code" => $row['course_code'],
                "course_title" => $row['course_title'],
                "units" => $total_units,
                "unit_lec" => $row['unit_lec'],
                "unit_lab" => $row['unit_lab'],
                "hour_lec" => $row['hour_lec'],
                "hour_lab" => $row['hour_lab']
            );
            array_push($electives, $elective);
        }

        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "electives" => $electives
        ));
    } else {
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "electives" => []
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