<?php
// Load Composer autoload
require_once __DIR__ . '/../../vendor/autoload.php';

// Use environment variables directly (Railway injects them)
$host     = $_ENV['DB_HOST']     ?? 'localhost';
$db_name  = $_ENV['DB_NAME']     ?? 'postgres';
$username = $_ENV['DB_USER']     ?? 'postgres';
$password = $_ENV['DB_PASS']     ?? '';
$port     = $_ENV['DB_PORT']     ?? '5432';
$driver   = $_ENV['DB_DRIVER']   ?? 'pgsql';

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

    // Test query
    $result = $conn->query('SELECT current_database()');
    $row = $result->fetch(PDO::FETCH_ASSOC);
    // Optional: uncomment for debugging
    // echo "Connected to database: " . $row['current_database'];

} catch(PDOException $e) {
    // Better error output for production
    error_log("Database connection failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "error" => "Internal Server Error",
        "message" => "Database connection failed."
    ]);
    exit;
}
