<?php

session_start();
require_once "../../config/database.php";
include_once '../../config/cors.php';
require_once "../audit/log_activity.php";

// header("Access-Control-Allow-Origin: *");
// header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
// header("Access-Control-Allow-Headers: Content-Type, Authorization");
// header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

$rawData = file_get_contents("php://input");
$data = json_decode($rawData, true);

$email = isset($data["email"]) ? trim($data["email"]) : "";
$password = isset($data["password"]) ? trim($data["password"]) : "";

try {
    // ✅ Fetch user details and include employee_id (if exists)
    $query = "
        SELECT u.id, u.email, u.password_hash, u.role, e.employee_id, s.student_id
        FROM users u
        LEFT JOIN employees e ON u.id = e.employee_id
        LEFT JOIN students s ON u.id = s.student_id
        WHERE u.email = :email
    ";

    $stmt = $conn->prepare($query);
    $stmt->bindParam(":email", $email, PDO::PARAM_STR);
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // --- INSECURE PASSWORD COMPARISON (FOR TESTING ONLY) ---
    if ($user && $password === $user['password_hash']) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['role'] = $user['role'];
        // Log successful login
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
        logActivity($user['id'], 'login', 'User logged in successfully', 'user', $user['id'], null, null, $ipAddress);
        echo json_encode([
            "success" => true,
            "id" => $user['id'],
            "email" => $user['email'],
            "role" => $user['role'],
            "employee_id" => $user['employee_id'], // ✅ Include employee_id
            "student_id" => $user['student_id'] // ✅ Include student_id
        ]);
    } else {
        
        if (!$user) {
          
            echo json_encode([
                "success" => false,
                "error" => "User not found"
            ]);
        } else {
         
            echo json_encode([
                "success" => false,
                "error" => "Invalid password"
            ]);
        }
    }   
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Database error: " . $e->getMessage()
    ]);
}
?>
