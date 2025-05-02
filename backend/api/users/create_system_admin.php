<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once "../../config/database.php";

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
    empty($data->role)
) {
    http_response_code(400); 
    echo json_encode(["message" => "All required fields must be filled."]);
    exit;
}


if ($data->role === 'system_admin' && empty($data->employeeId)) {
    http_response_code(400); 
    echo json_encode(["message" => "Employee ID is required for system_admin role."]);
    exit;
}

try {
   
    $fullName = trim($data->firstName . ' ' . ($data->middleName ? $data->middleName . ' ' : '') . $data->lastName);


    $conn->beginTransaction();


    $sql = "INSERT INTO users (id, email, password_hash, role, created_at) 
            VALUES (:id, :email, :password_hash, :role, NOW())";
    $stmt = $conn->prepare($sql);

    $defaultPassword = password_hash('123456', PASSWORD_BCRYPT); 

    $userId = isset($data->employeeId) ? $data->employeeId : uniqid();  

    $stmt->bindParam(':id', $userId); 
    $stmt->bindParam(':email', $data->email);
    $stmt->bindParam(':password_hash', $defaultPassword);
    $stmt->bindParam(':role', $data->role);
    $stmt->execute();

   
    $sql = "INSERT INTO employees (employee_id, name, dob, created_at) 
            VALUES (:employee_id, :name, :dob, NOW())";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':employee_id', $userId); 
    $stmt->bindParam(':name', $fullName);
    $stmt->bindParam(':dob', $data->dob);  
    $stmt->execute();

    $conn->commit();
   
    if ($data->role === 'admin') {
        $sql = "INSERT INTO system_admins (employee_id) 
                VALUES (:employee_id)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':employee_id', $userId);  
        $stmt->execute();
    }

  
   

    
    http_response_code(201); 
    echo json_encode(["message" => "System admin account created successfully"]);
} catch (Exception $e) {
    
    $conn->rollBack();
    http_response_code(500); 
    echo json_encode(["error" => "Database error: " . $e->getMessage()]);
}

?>
