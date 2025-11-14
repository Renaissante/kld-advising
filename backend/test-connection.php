<?php
// Include CORS headers first
require_once __DIR__ . '/config/cors.php';

// Then include database connection
require_once __DIR__ . '/config/database.php';

header('Content-Type: application/json');

try {
    // Test query
    $stmt = $conn->query("SELECT version()");
    $version = $stmt->fetch();
    
    echo json_encode([
        "status" => "success",
        "message" => "Database connected successfully!",
        "database" => $db_name,
        "host" => $host,
        "postgres_version" => $version['version']
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Connection test failed",
        "error" => $e->getMessage()
    ]);
}