<?php

require_once "../../config/database.php";
include_once '../../config/cors.php';

if (!isset($conn)) {
    die("Database connection failed.");
}

// header("Access-Control-Allow-Origin: *");
// header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
// header('Access-Control-Allow-Headers: Content-Type, Authorization');

try {

    $query = "SELECT id, name, program_id, year_level_id FROM sections";
    $stmt = $conn->prepare($query);
    $stmt->execute();
    

    $sections = $stmt->fetchAll(PDO::FETCH_ASSOC);


    echo json_encode($sections);
} catch (PDOException $e) {
    echo json_encode(["error" => "Error fetching data: " . $e->getMessage()]);
}
?>
