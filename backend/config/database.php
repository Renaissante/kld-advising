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

// Resolve hostname to IPv4 only to avoid IPv6 network issues
$ipv4_host = gethostbyname($host);
error_log("Attempting database connection...");
error_log("Original host: $host");
error_log("Resolved IPv4: $ipv4_host");
error_log("Port: $port");
error_log("Database: $db_name");

try {
    // PDO connection using IPv4 address with SSL
    $conn = new PDO(
        "$driver:host=$ipv4_host;port=$port;dbname=$db_name;sslmode=require",
        $username,
        $password,
        [
            PDO::ATTR_TIMEOUT => 10,
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );

    // Set default schema for your application
    $conn->exec("SET search_path TO kld_advising, public");
    
    error_log("✓ Database connection successful!");

} catch (PDOException $e) {
    // Log detailed error to server logs
    error_log("✗ Database connection failed!");
    error_log("Error: " . $e->getMessage());
    error_log("Connection attempted to: $ipv4_host:$port");
    error_log("Database: $db_name");
    
    // Return generic error to client
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        "status"  => "error",
        "message" => "Database connection failed.",
        "debug"   => getenv('APP_ENV') === 'development' ? $e->getMessage() : null
    ]);
    exit;
}