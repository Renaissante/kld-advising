<?php
// Include the database connection
require_once "../../config/database.php"; // Make sure this is the correct path
include_once '../../config/cors.php';
// Check if the $conn variable is set correctly
if (!isset($conn)) {
    die("Database connection failed.");
}

// header("Access-Control-Allow-Origin: *");
// header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
// header('Access-Control-Allow-Headers: Content-Type, Authorization'); 

try {
 
    $query = "SELECT id, name, department_id FROM programs";
    $stmt = $conn->prepare($query);
    $stmt->execute();
    
  
    $programs = $stmt->fetchAll(PDO::FETCH_ASSOC);

 
    echo json_encode($programs);
} catch (PDOException $e) {
    echo json_encode(["error" => "Error fetching data: " . $e->getMessage()]);
}
?>
