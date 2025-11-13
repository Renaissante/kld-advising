<?php
// Load Composer autoload
require_once __DIR__ . '/../../vendor/autoload.php';

// Use environment variables directly (Railway injects them)
$host     = getenv('DB_HOST')     ?: 'localhost';
$db_name  = getenv('DB_NAME')     ?: 'postgres';
$username = getenv('DB_USER')     ?: 'postgres';
$password = getenv('DB_PASS')     ?: '';
$port     = getenv('DB_PORT')     ?: '5432';
$driver   = getenv('DB_DRIVER')   ?: 'pgsql';

try {
    // PDO connection with SSL (required for Supabase)
    $conn = new PDO(
        "$driver:host=$host;port=$port;dbname=$db_name;sslmode=require",
        $username,
        $password
    );

    // Set error mode to exceptions
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Optional: set default schema
    $conn->exec("SET search_path TO kld_advising, public");

    // Test query (optional, uncomment to debug)
    // $result = $conn->query('SELECT current_database()');
    // $row = $result->fetch(PDO::FETCH_ASSOC);
    // echo "Connected to database: " . $row['current_database'];

} catch (PDOException $e) {
    // Log detailed error to server logs
    error_log("Database connection failed: " . $e->getMessage());

    // Return generic error to client
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        "status"  => "error",
        "message" => "Database connection failed."
    ]);
    exit;
}
