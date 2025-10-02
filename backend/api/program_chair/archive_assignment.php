<?php
// Include CORS headers (like in read.php)
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
// Removed: header("Access-Control-Allow-Methods: POST"); 
// Removed: header("Access-Control-Max-Age: 3600");
// Removed: header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';
// Removed: include_once '../../middleware/auth.php';

// Removed: if ($_SERVER['REQUEST_METHOD'] !== 'POST') { ... } block

// Authenticate and get user ID (if auth.php was included, otherwise this part is removed/handled elsewhere)
// For consistency with curriculum/delete.php, we'll assume authentication is not handled here.
// $user = authenticate(['program_chair']); // Only program chairs can archive assignments

// if (!isset($user['id'])) {
//     http_response_code(401);
//     echo json_encode(["message" => "Unauthorized: Invalid or missing token.", "success" => false]);
//     exit();
// }

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Validate input
if (!isset($data->assignment_id)) {
    http_response_code(400);
    echo json_encode(["message" => "Bad Request: Missing assignment_id.", "success" => false]);
    exit();
}

$assignment_id = $data->assignment_id;

try {
    // Prepare an update statement to set status to 'archived'
    $query = "UPDATE section_faculty SET status = 'archived' WHERE id = :assignment_id";
    $stmt = $conn->prepare($query);

    // Bind the ID
    $stmt->bindParam(':assignment_id', $assignment_id, PDO::PARAM_INT);

    // Execute query
    if ($stmt->execute()) {
        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode(["message" => "Assignment archived successfully.", "success" => true]);
        } else {
            http_response_code(404);
            echo json_encode(["message" => "No assignment found with the provided ID.", "success" => false]);
        }
    } else {
        http_response_code(500);
        echo json_encode(["message" => "Internal Server Error: Failed to archive assignment.", "success" => false]);
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(["message" => "Database error: " . $e->getMessage(), "success" => false]);
}
?>
