<?php
require_once __DIR__ . '/../../vendor/autoload.php';

// Use connection pooler (better for containerized apps)
$host     = getenv('DB_HOST')     ?: 'aws-0-ap-southeast-1.pooler.supabase.com';
$db_name  = getenv('DB_NAME')     ?: 'postgres';
$username = getenv('DB_USER')     ?: 'postgres.irnudqxgicdruxdjcbzj';
$password = getenv('DB_PASS')     ?: '';
$port     = getenv('DB_PORT')     ?: '6543'; // POOLER PORT, not 5432
$driver   = getenv('DB_DRIVER')   ?: 'pgsql';

// Force IPv4 resolution using stream context
$context = stream_context_create([
    'socket' => [
        'bindto' => '0:0', // Bind to any available IPv4 address
    ],
]);

error_log("Attempting database connection...");
error_log("Host: $host | Port: $port | User: $username | DB: $db_name");

try {
    // Use pooler connection string
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
        "debug"   => getenv('APP_ENV') === 'development' ? $e->getMessage() : null
    ]);
    exit;
}