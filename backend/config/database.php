<?php
require_once __DIR__ . '/../../vendor/autoload.php';

// Load environment variables from .env file if it exists (local development)
$envPath = __DIR__ . '/../..';
if (file_exists($envPath . '/.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable($envPath);
    $dotenv->safeLoad();
    error_log("Loaded environment from .env file");
} else {
    error_log("No .env file found - using system environment variables (Railway)");
}

// Now getenv() will work, or use $_ENV
$host     = $_ENV['DB_HOST']     ?? getenv('DB_HOST')     ?: 'db.irnudqxgicdruxdjcbzj.supabase.co';
$db_name  = $_ENV['DB_NAME']     ?? getenv('DB_NAME')     ?: 'postgres';
$username = $_ENV['DB_USER']     ?? getenv('DB_USER')     ?: 'postgres.irnudqxgicdruxdjcbzj';
$password = $_ENV['DB_PASS']     ?? getenv('DB_PASS')     ?: '';
$port     = $_ENV['DB_PORT']     ?? getenv('DB_PORT')     ?: '5432';
$driver   = $_ENV['DB_DRIVER']   ?? getenv('DB_DRIVER')   ?: 'pgsql';

error_log("Attempting database connection...");
error_log("Host: $host | Port: $port | User: $username | DB: $db_name");

try {
    $dsn = "$driver:host=$host;port=$port;dbname=$db_name";
    
    $options = [
        PDO::ATTR_TIMEOUT => 10,
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ];
    
    $conn = new PDO($dsn, $username, $password, $options);
    
    // Set search path
    $conn->exec("SET search_path TO kld_advising, public");
    
    error_log("✓ Database connection successful!");

} catch (PDOException $e) {
    error_log("✗ Database connection failed!");
    error_log("Error: " . $e->getMessage());
    error_log("DSN: $dsn");
    
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        "status"  => "error",
        "message" => "Database connection failed.",
        "debug"   => ($_ENV['APP_ENV'] ?? null) === 'development' ? $e->getMessage() : null
    ]);
    exit;
}