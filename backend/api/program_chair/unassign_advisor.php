<?php
// Include CORS headers
include_once '../../config/cors.php';

// Set headers for content type
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS request (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header("Access-Control-Allow-Methods: POST, DELETE, OPTIONS"); // Allow POST and DELETE for this endpoint
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    exit(0);
}

// Include database configuration (provides $conn)
include_once '../../config/database.php';

// Check if faculty_id and section_id are set in the request body
$data = json_decode(file_get_contents("php://input"));

if (!isset($data->faculty_id) || !isset($data->section_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Missing faculty_id or section_id."));
    exit();
}

$faculty_id = $data->faculty_id;
$section_id = $data->section_id;

// Prepare the DELETE statement
$query = "DELETE FROM section_advisors WHERE advisor_id = :faculty_id AND section_id = :section_id";
$stmt = $conn->prepare($query);

// Bind parameters
$stmt->bindParam(':faculty_id', $faculty_id);
$stmt->bindParam(':section_id', $section_id);

// Execute the query
if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode(array("message" => "Advisor unassigned from section."));
} else {
    http_response_code(500);
    echo json_encode(array("message" => "Failed to unassign advisor from section."));
}

// TODO: Add authorization checks
?>

