<?php
// Required headers
// header("Access-Control-Allow-Origin: *");
// header("Content-Type: application/json; charset=UTF-8");
// header("Access-Control-Allow-Methods: POST");
// header("Access-Control-Max-Age: 3600");
// header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Include database and object files
// include_once '../../config/Database.php'; // Database connection should be established by the calling script

function logActivity($userId, $action, $description, $entityType, $entityId = null, $oldValues = null, $newValues = null, $ipAddress = null) {
    global $conn; // Use the global database connection from the calling script

    // Prepare the SQL statement
    $query = "INSERT INTO `audit_trail` (`user_id`, `action`, `description`, `entity_type`, `entity_id`, `old_values`, `new_values`, `ip_address`) VALUES (:user_id, :action, :description, :entity_type, :entity_id, :old_values, :new_values, :ip_address)";

    // Prepare statement
    $stmt = $conn->prepare($query);

    // Sanitize and bind parameters
    $userId = htmlspecialchars($userId); // Only htmlspecialchars, not strip_tags
    $action = htmlspecialchars($action); // Only htmlspecialchars, not strip_tags
    // $description = htmlspecialchars($description); // Only htmlspecialchars, not strip_tags
    $entityType = htmlspecialchars($entityType); // Only htmlspecialchars, not strip_tags

    $stmt->bindParam(":user_id", $userId);
    $stmt->bindParam(":action", $action);
    $stmt->bindParam(":description", $description);
    $stmt->bindParam(":entity_type", $entityType);
    $stmt->bindParam(":entity_id", $entityId); // Bind directly, no htmlspecialchars for id and JSON data
    $stmt->bindParam(":old_values", $oldValues);
    $stmt->bindParam(":new_values", $newValues);
    $stmt->bindParam(":ip_address", $ipAddress);

    // Execute query
    if ($stmt->execute()) {
        // Attempt to send notification via WebSocket
        try {
            require dirname(__DIR__, 3) . '/vendor/autoload.php';
            $client = new WebSocket\Client("ws://192.168.1.11:8080");

            $auditData = [
                'user_id' => $userId,
                'action' => $action,
                'description' => $description,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'old_values' => $oldValues,
                'new_values' => $newValues,
                'ip_address' => $ipAddress,
                'timestamp' => date('Y-m-d H:i:s') // Add timestamp for real-time notification
            ];
            $notificationMessage = json_encode([
                'type' => 'backend_event',
                'payload' => [
                    'event' => 'audit_log_updated', // Specific event type for audit log
                    'data' => $auditData
                ]
            ]);

            $client->send($notificationMessage);
            $client->close();
        } catch (Exception $e) {
            error_log("WebSocket Error: {$e->getMessage()}\n");
        }
        return true;
    }
    return false;
}
