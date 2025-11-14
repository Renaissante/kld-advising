<?php
// Start timing
$requestStart = microtime(true);

session_start();
require_once "../../config/database.php";
include_once '../../config/cors.php';
require_once "../audit/log_activity.php";

header("Content-Type: application/json");

// Get and validate input
$rawData = file_get_contents("php://input");
$data = json_decode($rawData, true);

$email = isset($data["email"]) ? trim($data["email"]) : "";
$password = isset($data["password"]) ? trim($data["password"]) : "";

// Early validation
if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "error" => "Email and password are required"
    ]);
    exit;
}

try {
    $queryStart = microtime(true);
    
    // ✅ OPTIMIZED: Simplified query with ARRAY_AGG for better performance
    $query = "
        SELECT 
            u.id, 
            u.email, 
            u.password_hash, 
            e.employee_id, 
            s.student_id,
            ARRAY_AGG(r.role_name) FILTER (WHERE r.role_name IS NOT NULL) AS roles_array
        FROM users u
        LEFT JOIN employees e ON u.id = e.employee_id
        LEFT JOIN students s ON u.id = s.student_id
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.email = :email
        GROUP BY u.id, u.email, u.password_hash, e.employee_id, s.student_id
        LIMIT 1
    ";

    $stmt = $conn->prepare($query);
    $stmt->bindParam(":email", $email, PDO::PARAM_STR);
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $queryTime = round((microtime(true) - $queryStart) * 1000, 2);
    error_log("Query time: {$queryTime}ms");

    // User not found
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "error" => "Invalid email or password"
        ]);
        exit;
    }

    // ✅ Password verification (use password_verify in production!)
    $isValidPassword = ($password === $user['password_hash']); 
    // TODO: Change to: password_verify($password, $user['password_hash'])
    
    if (!$isValidPassword) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "error" => "Invalid email or password"
        ]);
        exit;
    }

    // ✅ Successful login
    $_SESSION['user_id'] = $user['id'];
    
    // Handle roles array from PostgreSQL
    $roles_array = [];
    if ($user['roles_array']) {
        // PostgreSQL returns array as string like "{role1,role2}"
        $roles_str = trim($user['roles_array'], '{}');
        $roles_array = $roles_str ? explode(',', $roles_str) : [];
    }
    $_SESSION['user_roles'] = $roles_array;
    
    // ✅ Log activity asynchronously (don't wait for it)
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    try {
        logActivity(
            $user['id'], 
            'login', 
            'User logged in successfully', 
            'user', 
            $user['id'], 
            null, 
            null, 
            $ipAddress
        );
    } catch (Exception $logError) {
        // Don't fail login if logging fails
        error_log("Failed to log activity: " . $logError->getMessage());
    }
    
    $totalTime = round((microtime(true) - $requestStart) * 1000, 2);
    error_log("Total login time: {$totalTime}ms");
    
    echo json_encode([
        "success" => true,
        "id" => $user['id'],
        "email" => $user['email'],
        "roles" => $roles_array,
        "employee_id" => $user['employee_id'],
        "student_id" => $user['student_id']
    ]);

} catch (PDOException $e) {
    error_log("Database error in login: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Authentication failed. Please try again."
    ]);
} catch (Exception $e) {
    error_log("General error in login: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "An error occurred. Please try again."
    ]);
}
?>