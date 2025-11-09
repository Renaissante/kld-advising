<?php

header("Content-Type: application/json");
// header("Access-Control-Allow-Origin: *");
// header("Access-Control-Allow-Methods: POST, OPTIONS");
// header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
include_once '../../config/cors.php';
// if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
//     http_response_code(204);
//     exit;
// }


require_once "../../config/database.php";
require_once "../../config/email_config.php"; // Include email configuration
require_once "../../utils/send_email.php";     // Include email utility


error_reporting(E_ALL);
ini_set('display_errors', 1);


if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method Not Allowed"]);
    exit;
}


$data = json_decode(file_get_contents("php://input"));


if (
    empty($data->firstName) || 
    empty($data->lastName) || 
    empty($data->email) || 
    empty($data->department) || 
    empty($data->role) ||
    empty($data->employeeId) ||
    empty($data->password) // Add password to required fields
) {
    http_response_code(400);
    echo json_encode(["message" => "All required fields must be filled."]);
    exit;
}

try {
 
    $fullName = trim($data->firstName . ' ' . ($data->middleName ? $data->middleName . ' ' : '') . $data->lastName);

    $conn->beginTransaction();

 
    $sql = "INSERT INTO users (id, email, password_hash, created_at) 
            VALUES (:id, :email, :password_hash, NOW())";
    $stmt = $conn->prepare($sql);

    $hashedPassword = password_hash($data->password, PASSWORD_DEFAULT); // Hash the temporary password

    $userId = isset($data->employeeId) ? $data->employeeId : uniqid(); 
    $stmt->bindParam(':id', $userId);
    $stmt->bindParam(':email', $data->email);
    $stmt->bindParam(':password_hash', $hashedPassword); // Use the hashed password
    // $stmt->bindParam(':role', $data->role); // Removed as role is now in user_roles
    $stmt->execute();

    // Get the role_id for 'dean'
    $sqlGetRoleId = "SELECT id FROM roles WHERE role_name = :role_name";
    $stmtGetRoleId = $conn->prepare($sqlGetRoleId);
    $roleName = 'dean'; // Assuming the role for this file is always 'dean'
    $stmtGetRoleId->bindParam(':role_name', $roleName);
    $stmtGetRoleId->execute();
    $roleRow = $stmtGetRoleId->fetch(PDO::FETCH_ASSOC);

    if (!$roleRow) {
        throw new Exception("Role 'dean' not found in roles table.");
    }
    $roleId = $roleRow['id'];

    // Insert into user_roles table
    $sqlUserRole = "INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)";
    $stmtUserRole = $conn->prepare($sqlUserRole);
    $stmtUserRole->bindParam(':user_id', $userId);
    $stmtUserRole->bindParam(':role_id', $roleId);
    $stmtUserRole->execute();

  
    $sql = "SELECT id FROM departments WHERE name = :department";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':department', $data->department);
    $stmt->execute();
    $departmentRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$departmentRow) {
        throw new Exception("Invalid department selected.");
    }

    $departmentId = $departmentRow['id'];

  
    $sql = "INSERT INTO employees (employee_id, name, dob, department_id, created_at) 
            VALUES (:employee_id, :name, :dob, :department_id, NOW())";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':employee_id', $data->employeeId);  
    $stmt->bindParam(':name', $fullName);
    $stmt->bindParam(':dob', $data->dob); 
    $stmt->bindParam(':department_id', $departmentId);
    $stmt->execute();

 
    $sql = "INSERT INTO deans (employee_id, department) 
            VALUES (:employee_id, :department)";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':employee_id', $data->employeeId);  
    $stmt->bindParam(':department', $departmentId);
    $stmt->execute();

   
    $conn->commit();

    // Send temporary password to user's email
    $subject = "Your New Account Credentials for KLD Advising System";
    $body = "Hello " . $data->firstName . ",<br><br>";
    $body .= "Your account for the KLD Advising System has been successfully created.<br>";
    $body .= "Your username is: <b>" . $data->email . "</b><br>";
    $body .= "Your temporary password is: <b>" . $data->password . "</b><br><br>";
    $body .= "Please log in using your credentials and change your password immediately:<br>";
    $body .= "<a href=\"" . LOGIN_PAGE_URL . "\">Login Page</a><br><br>";
    $body .= "Thank you.<br>";
    $body .= "KLD Advising System Team";

    sendEmail($data->email, $fullName, $subject, $body);

    require dirname(__DIR__, 3) . '/vendor/autoload.php';

    try {
        // Connect to the websocket server running on localhost:8080
        $client = new WebSocket\Client("ws://localhost:8080");

        // Prepare the message to send (JSON format is good practice)
        $message = json_encode([
            'type' => 'backend_event', // Generic type for backend events
            'payload' => [
                'event' => 'user_created', // Specific event type within payload
                'role' => 'dean', // Role of the created user
                'userId' => $userId, // Optionally include relevant data
                'message' => 'A new dean account has been created.' // Optional message
            ]
        ]);

        // Send the message
        $client->send($message);

        // Close the connection
        $client->close();

        // Optional: Log success
        // error_log("WebSocket message sent: " . $message);

    } catch (Exception $e) {
        // Log the error, but don't stop the API from returning success
        error_log("WebSocket error sending message: " . $e->getMessage());
    }

    http_response_code(201);
    echo json_encode(["message" => "Dean account created successfully"]);
} catch (Exception $e) {
    // Rollback on error
    $conn->rollBack();
    http_response_code(500);
    echo json_encode(["error" => "Database error: " . $e->getMessage()]);
}
?>
