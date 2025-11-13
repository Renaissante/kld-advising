<?php

require_once __DIR__ . '/../../vendor/autoload.php';

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

// Get DB credentials from .env
$host = $_ENV['DB_HOST'];
$db_name = $_ENV['DB_NAME'];
$username = $_ENV['DB_USER'];
$password = $_ENV['DB_PASS'];
$port = isset($_ENV['DB_PORT']) ? $_ENV['DB_PORT'] : '5432';
$driver = isset($_ENV['DB_DRIVER']) ? $_ENV['DB_DRIVER'] : 'pgsql';

try {
    // DSN with SSL mode
    $dsn = "$driver:host=$host;port=$port;dbname=$db_name;sslmode=require";

    // Connect to Supabase Postgres
    $conn = new PDO($dsn, $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Optional: set default schema
    $conn->exec("SET search_path TO kld_advising, public");

    // Test query
    $result = $conn->query('SELECT current_database()');
    $dbName = $result->fetchColumn();
    echo "✅ Connected successfully to database: $dbName";

} catch (PDOException $e) {
    die("❌ Connection failed: " . $e->getMessage());
}
?>
