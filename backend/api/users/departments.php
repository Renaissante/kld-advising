<?php

require_once "../../config/database.php"; 


if (!isset($conn)) {
    die("Database connection failed.");
}

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header('Access-Control-Allow-Headers: Content-Type, Authorization'); 

try {
 
    $query = "SELECT id, name FROM departments";
    $stmt = $conn->prepare($query);
    $stmt->execute();
    
  
    $departments = $stmt->fetchAll(PDO::FETCH_ASSOC);


    echo json_encode($departments);
} catch (PDOException $e) {
    echo json_encode(["error" => "Error fetching data: " . $e->getMessage()]);
}
?>
