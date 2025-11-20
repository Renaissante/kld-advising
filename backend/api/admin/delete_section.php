<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';
include_once '../audit/log_activity.php';

// Start session to check for logged in user
session_start();

$data = json_decode(file_get_contents("php://input"));

// Validate input
if (!isset($data->section_id) || empty($data->section_id) ||
    !isset($data->user_id) || empty($data->user_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Section ID and User ID are required."));
    exit();
}

// // Check if user is logged in and is an admin
// if (!isset($_SESSION['user_id']) || $_SESSION['user_id'] != $data->user_id || !in_array('admin', $_SESSION['user_roles'])) {
//     http_response_code(403);
//     echo json_encode(array("message" => "Forbidden: You do not have permission to delete sections."));
//     exit();
// }

$section_id = $data->section_id;
$user_id = $data->user_id;

try {
    // Before deleting, get section details for logging
    $get_section_query = "SELECT name FROM sections WHERE id = :section_id LIMIT 1";
    $get_section_stmt = $conn->prepare($get_section_query);
    $get_section_stmt->bindParam(':section_id', $section_id);
    $get_section_stmt->execute();
    $section_details = $get_section_stmt->fetch(PDO::FETCH_ASSOC);

    $section_name = $section_details ? $section_details['name'] : 'Unknown Section';

    // Delete section
    $query = "DELETE FROM sections WHERE id = :section_id";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':section_id', $section_id);

    if ($stmt->execute()) {
        if ($stmt->rowCount() > 0) {
            // Log the activity
            $ipAddress = $_SERVER['REMOTE_ADDR'];
            logActivity($user_id, 'delete_section', "Deleted section: {$section_name}", 'Section', $section_id, null, null, $ipAddress);

            http_response_code(200);
            echo json_encode(array("message" => "Section deleted successfully."));
        } else {
            http_response_code(404);
            echo json_encode(array("message" => "Section not found."));
        }
    } else {
        http_response_code(503);
        echo json_encode(array("message" => "Unable to delete section."));
    }

} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>
