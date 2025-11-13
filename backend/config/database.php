<?php
require_once __DIR__ . '/../../vendor/autoload.php';

$host     = getenv('DB_HOST')     ?: 'aws-0-ap-southeast-1.pooler.supabase.com';
$db_name  = getenv('DB_NAME')     ?: 'postgres';
$username = getenv('DB_USER')     ?: 'postgres.irnudqxgicdruxdjcbzj';
$password = getenv('DB_PASS')     ?: '09772634543raniel';
$port     = getenv('DB_PORT')     ?: '6543';
$driver   = getenv('DB_DRIVER')   ?: 'pgsql';

// Function to resolve hostname to IPv4 only
function resolveToIPv4($hostname) {
    // Try using dns_get_record to get A records only (IPv4)
    $records = @dns_get_record($hostname, DNS_A);
    
    if ($records && isset($records[0]['ip'])) {
        return $records[0]['ip'];
    }
    
    // Fallback to gethostbyname
    $resolved = gethostbyname($hostname);
    
    // If gethostbyname failed, it returns the hostname unchanged
    if ($resolved === $hostname) {
        error_log("⚠ DNS resolution failed for $hostname, using hostname directly");
        return $hostname;
    }
    
    // Verify it's IPv4 (not IPv6)
    if (filter_var($resolved, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        return $resolved;
    }
    
    error_log("⚠ Resolved to non-IPv4 address, using hostname directly");
    return $hostname;
}

$ipv4_host = resolveToIPv4($host);

error_log("Attempting database connection...");
error_log("Host: $host → Resolved: $ipv4_host");
error_log("Port: $port | User: $username | DB: $db_name");

try {
    // Connection string with IPv4 preference
    $dsn = "$driver:host=$ipv4_host;port=$port;dbname=$db_name";
    
    $options = [
        PDO::ATTR_TIMEOUT => 10,
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_PERSISTENT => false
    ];
    
    $conn = new PDO($dsn, $username, $password, $options);
    
    // Set search path
    $conn->exec("SET search_path TO kld_advising, public");
    
    error_log("✓ Database connection successful!");

} catch (PDOException $e) {
    error_log("✗ Database connection failed!");
    error_log("Error: " . $e->getMessage());
    error_log("DSN attempted: $dsn");
    
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        "status"  => "error",
        "message" => "Database connection failed.",
        "debug"   => getenv('APP_ENV') === 'development' ? $e->getMessage() : null
    ]);
    exit;
}