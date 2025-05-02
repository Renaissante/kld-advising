<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Validate input
if (!isset($data->track_name) || !isset($data->program_id) || 
    empty(trim($data->track_name)) || empty($data->program_id)) {
    http_response_code(400);
    echo json_encode(array(
        "success" => false,
        "message" => "Track name and program ID are required."
    ));
    exit();
}

try {
    // Check if track name already exists for this program
    $check_query = "SELECT id FROM tracks 
                   WHERE track_name = :track_name 
                   AND program_id = :program_id";
    
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(':track_name', $data->track_name);
    $check_stmt->bindParam(':program_id', $data->program_id);
    $check_stmt->execute();

    if ($check_stmt->rowCount() > 0) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "A track with this name already exists for this program."
        ));
        exit();
    }

    // Insert the new track
    $query = "INSERT INTO tracks (track_name, program_id) 
              VALUES (:track_name, :program_id)";
    
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':track_name', $data->track_name);
    $stmt->bindParam(':program_id', $data->program_id);

    if ($stmt->execute()) {
        $track_id = $conn->lastInsertId();
        
        // Fetch the created track with program name
        $fetch_query = "SELECT t.id, t.track_name, t.program_id, p.name as program_name 
                       FROM tracks t
                       LEFT JOIN programs p ON t.program_id = p.id
                       WHERE t.id = :track_id";
        
        $fetch_stmt = $conn->prepare($fetch_query);
        $fetch_stmt->bindParam(':track_id', $track_id);
        $fetch_stmt->execute();
        
        $new_track = $fetch_stmt->fetch(PDO::FETCH_ASSOC);

        http_response_code(201);
        echo json_encode(array(
            "success" => true,
            "message" => "Track created successfully.",
            "track" => array(
                "id" => $new_track['id'],
                "track_name" => $new_track['track_name'],
                "program_id" => $new_track['program_id'],
                "program_name" => $new_track['program_name'],
                "electives" => []
            )
        ));
    } else {
        http_response_code(503);
        echo json_encode(array(
            "success" => false,
            "message" => "Unable to create track."
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