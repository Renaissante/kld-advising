<?php
require_once __DIR__ . '/../../vendor/autoload.php';

// Remove this in production
// $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
// $dotenv->load();

$host = $_ENV['DB_HOST'];
$db_name = $_ENV['DB_NAME'];
$username = $_ENV['DB_USER'];
$password = $_ENV['DB_PASS'];

$port = $_ENV['DB_PORT'] ?? '5432';
$driver = $_ENV['DB_DRIVER'] ?? 'pgsql';

try {
    $conn = new PDO(
        "$driver:host=$host;port=$port;dbname=$db_name;sslmode=require",
        $username,
        $password
    );
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->exec("SET search_path TO kld_advising, public");
    $result = $conn->query('SELECT current_database()');
} catch(PDOException $e) {
    die("Connection failed: " . $e->getMessage());
}
