<?php
session_start();
include_once '../../config/cors.php';
require_once "../../config/database.php";
require_once "../audit/log_activity.php";
// Clear previous output to prevent header issues
if (ob_get_length()) ob_end_clean();

// Set proper CORS headers
// header("Access-Control-Allow-Origin: *"); // Must match frontend URL exactly
// header("Access-Control-Allow-Credentials: true");
// header("Access-Control-Allow-Methods: POST, OPTIONS");
// header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header("Content-Type: application/json");

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
$userId = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;
if ($userId) {
    logActivity($userId, 'logout', 'User logged out successfully', 'user', $userId, null, null, $ipAddress);
}
// Destroy the session
$_SESSION = [];
session_destroy();


// Return success response
echo json_encode(["message" => "Logged out successfully"]);
?>
