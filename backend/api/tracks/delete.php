<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Validate input
if (!isset($data->id) || empty($data->id)) {
    http_response_code(400);
    echo json_encode(array(
        "success" => false,
        "message" => "Track ID is required."
    ));
    exit();
}

try {
    // First check if track exists
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

    // Start transaction
    $conn->beginTransaction();

    try {
        // First get all course IDs associated with this track
        $get_courses_query = "SELECT course_id FROM elective_courses WHERE track_id = :track_id";
        $get_courses_stmt = $conn->prepare($get_courses_query);
        $get_courses_stmt->bindParam(':track_id', $data->id);
        $get_courses_stmt->execute();
        $course_ids = $get_courses_stmt->fetchAll(PDO::FETCH_COLUMN);

        // Delete from elective_courses first (due to foreign key constraint)
        $delete_electives_query = "DELETE FROM elective_courses WHERE track_id = :track_id";
        $delete_electives_stmt = $conn->prepare($delete_electives_query);
        $delete_electives_stmt->bindParam(':track_id', $data->id);
        $delete_electives_stmt->execute();

        // Delete the associated courses
        if (!empty($course_ids)) {
            $placeholders = str_repeat('?,', count($course_ids) - 1) . '?';
            $delete_courses_query = "DELETE FROM courses WHERE id IN ($placeholders)";
            $delete_courses_stmt = $conn->prepare($delete_courses_query);
            $delete_courses_stmt->execute($course_ids);
        }

        // Finally delete the track
        $delete_track_query = "DELETE FROM tracks WHERE id = :id";
        $delete_track_stmt = $conn->prepare($delete_track_query);
        $delete_track_stmt->bindParam(':id', $data->id);
        $delete_track_stmt->execute();

        // Commit transaction
        $conn->commit();

        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Track and associated courses deleted successfully."
        ));
    } catch (PDOException $e) {
        // Rollback transaction on error
        $conn->rollBack();
        throw $e;
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array(
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ));
}
?>