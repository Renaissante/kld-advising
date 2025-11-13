<?php
require_once __DIR__ . '/../../vendor/autoload.php';

$host     = getenv('DB_HOST')     ?: 'aws-1-ap-southeast-1.pooler.supabase.com';
$db_name  = getenv('DB_NAME')     ?: 'postgres';
$username = getenv('DB_USER')     ?: 'postgres.irnudqxgicdruxdjcbzj';
$password = getenv('DB_PASS')     ?: '';
$port     = getenv('DB_PORT')     ?: '6543';
$driver   = getenv('DB_DRIVER')   ?: 'pgsql';

// Resolve to IPv4
$ipv4_host = gethostbyname($host);

error_log("Attempting database connection...");
error_log("Host: $host → IPv4: $ipv4_host");
error_log("Port: $port | User: $username | DB: $db_name");

try {
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

    $conn->exec("SET search_path TO kld_advising, public");
    error_log("✓ Database connection successful!");

} catch (PDOException $e) {
    error_log("✗ Database connection failed!");
    error_log("Error: " . $e->getMessage());
    
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        "status"  => "error",
        "message" => "Database connection failed.",
        "debug"   => getenv('APP_ENV') === 'development' ? $e->getMessage() : null
    ]);
    exit;
}