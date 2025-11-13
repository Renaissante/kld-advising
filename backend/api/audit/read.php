<?php
session_start();

require_once "../../config/database.php";
include_once '../../config/cors.php';

// Set headers for JSON response
header("Content-Type: application/json; charset=UTF-8");

// Check for admin role
// if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
//     http_response_code(403);
//     echo json_encode(["message" => "Access Denied. Admin privilege required."]);
//     exit();
// }

// $conn is assumed to be available globally from database.php

// Prepare query to fetch all audit trail records
$query = "SELECT id, user_id, action, description, entity_type, entity_id, old_values, new_values, timestamp, ip_address FROM audit_trail ORDER BY timestamp DESC";

$stmt = $conn->prepare($query);

try {
    $stmt->execute();
    $num = $stmt->rowCount();

    if ($num > 0) {
        $audit_trail_arr = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            extract($row);
            $audit_item = [
                "id" => $id,
                "user_id" => $user_id,
                "action" => $action,
                "description" => $description,
                "entity_type" => $entity_type,
                "entity_id" => $entity_id,
                "old_values" => $old_values,
                "new_values" => $new_values,
                "timestamp" => $timestamp,
                "ip_address" => $ip_address
            ];
            array_push($audit_trail_arr, $audit_item);
        }
        http_response_code(200);
        echo json_encode($audit_trail_arr);
    } else {
        http_response_code(404);
        echo json_encode(["message" => "No audit trail records found."]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Database error: " . $e->getMessage()]);
}
