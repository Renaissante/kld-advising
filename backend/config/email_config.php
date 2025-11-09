<?php
// email_config.php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Load environment variables from .env file
// Try to load Composer's autoloader
$autoloadPath = dirname(__DIR__, 2) . '/vendor/autoload.php';
if (file_exists($autoloadPath)) {
    require_once $autoloadPath;
} else {
    error_log("ERROR: Autoload not found at: " . $autoloadPath);
}

try {
    $rootPath = dirname(__DIR__, 2);
    $dotenv = Dotenv\Dotenv::createImmutable($rootPath);
    $dotenv->load();
} catch (Exception $e) {
    error_log("ERROR: Dotenv failed to load: " . $e->getMessage());
}

// SMTP configuration for PHPMailer
define('SMTP_HOST', $_ENV['SMTP_HOST']);
define('SMTP_AUTH', filter_var($_ENV['SMTP_AUTH'], FILTER_VALIDATE_BOOLEAN));
define('SMTP_USERNAME', $_ENV['SMTP_USERNAME']);
define('SMTP_PASSWORD', $_ENV['SMTP_PASSWORD']);
define('SMTP_SECURE', $_ENV['SMTP_SECURE']);
define('SMTP_PORT', $_ENV['SMTP_PORT']);

// Sender details
define('SENDER_EMAIL', $_ENV['SENDER_EMAIL']);
define('SENDER_NAME', $_ENV['SENDER_NAME']);

// Login page URL for the email link
define('LOGIN_PAGE_URL', $_ENV['LOGIN_PAGE_URL']);

?>