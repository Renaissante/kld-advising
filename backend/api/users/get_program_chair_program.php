<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once "../../config/database.php";

// Ensure it's a GET request
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method Not Allowed"]);
    exit;
}

// Validate the program chair ID
if (!isset($_GET['id']) || empty($_GET['id'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Program Chair ID is required"]);
    exit;
}

$programChairId = $_GET['id'];

try {
    // Get the program details for the program chair
    $query = "
        SELECT 
            pc.program as program_id, 
            p.name as program_name,
            p.abbreviation as program_abbreviation
        FROM program_chairs pc
        JOIN programs p ON pc.program = p.id
        WHERE pc.employee_id = :program_chair_id
    ";
    
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':program_chair_id', $programChairId);
    $stmt->execute();
    
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "No program found for this program chair"]);
        exit;
    }
    
    $program = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        "success" => true,
        "data" => $program
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
} 