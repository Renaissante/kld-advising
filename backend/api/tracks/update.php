<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Validate input
if (!isset($data->id) || !isset($data->track_name) || !isset($data->program_id) || 
    empty($data->id) || empty(trim($data->track_name)) || empty($data->program_id)) {
    http_response_code(400);
    echo json_encode(array(
        "success" => false,
        "message" => "Track ID, name, and program ID are required."
    ));
    exit();
}

try {
    // Check if track exists
    $check_query = "SELECT id FROM tracks WHERE id = :id";
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(':id', $data->id);
    $check_stmt->execute();

    if ($check_stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array(
            "success" => false,
            "message" => "Track not found."
        ));
        exit();
    }

    // Check if track name already exists for this program (excluding current track)
    $duplicate_check = "SELECT id FROM tracks 
                       WHERE track_name = :track_name 
                       AND program_id = :program_id 
                       AND id != :id";
    
    $dup_stmt = $conn->prepare($duplicate_check);
    $dup_stmt->bindParam(':track_name', $data->track_name);
    $dup_stmt->bindParam(':program_id', $data->program_id);
    $dup_stmt->bindParam(':id', $data->id);
    $dup_stmt->execute();

    if ($dup_stmt->rowCount() > 0) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "A track with this name already exists for this program."
        ));
        exit();
    }

    // Update the track
    $query = "UPDATE tracks 
              SET track_name = :track_name, 
                  program_id = :program_id 
              WHERE id = :id";
    
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':track_name', $data->track_name);
    $stmt->bindParam(':program_id', $data->program_id);
    $stmt->bindParam(':id', $data->id);

    if ($stmt->execute()) {
        // Fetch the updated track with program name
        $fetch_query = "SELECT t.id, t.track_name, t.program_id, p.name as program_name 
                       FROM tracks t
                       LEFT JOIN programs p ON t.program_id = p.id
                       WHERE t.id = :id";
        
        $fetch_stmt = $conn->prepare($fetch_query);
        $fetch_stmt->bindParam(':id', $data->id);
        $fetch_stmt->execute();
        
        $updated_track = $fetch_stmt->fetch(PDO::FETCH_ASSOC);

        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Track updated successfully.",
            "track" => array(
                "id" => $updated_track['id'],
                "track_name" => $updated_track['track_name'],
                "program_id" => $updated_track['program_id'],
                "program_name" => $updated_track['program_name'],
                "electives" => []
            )
        ));
    } else {
        http_response_code(503);
        echo json_encode(array(
            "success" => false,
            "message" => "Unable to update track."
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