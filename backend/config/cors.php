<?php
// Define your list of allowed origins
$allowed_origins = [
    "http://localhost:5173", // For local development on the server machine
    "http://192.168.18.6", // For accessing from other devices on the local network
    "https://kld-advising.vercel.app" // Hosted frontend application
];

// Check if the Origin header is present in the request
if (isset($_SERVER['HTTP_ORIGIN'])) {
    $origin = $_SERVER['HTTP_ORIGIN'];

    // Check if the requesting origin is in our allowed list
    if (in_array($origin, $allowed_origins)) {
        // If allowed, set the Access-Control-Allow-Origin header to the exact origin
        header("Access-Control-Allow-Origin: {$origin}");
        // And set Access-Control-Allow-Credentials to true
        header('Access-Control-Allow-Credentials: true');
    } else {
       
    }
}

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Set headers required for the preflight response
    // These tell the browser which methods and headers are allowed for the actual request
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS"); // List all methods your API uses
    }

    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}"); // Reflect requested headers
    } else {
         // Fallback or default allowed headers if the request doesn't send ACA-Request-Headers
         header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    }


    
    http_response_code(204);
    exit; 
}


?>