<?php

header("Content-Type: application/json");
include_once '../../config/cors.php';
require_once "../../config/database.php";

error_reporting(E_ALL);
ini_set('display_errors', 1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method Not Allowed"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (empty($data->id)) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Unable to archive user. User ID is required."));
    exit();
}

error_log("archive_user.php received data for ID: " . $data->id);

try {
    $conn->beginTransaction();

    $query = "UPDATE users SET status = 'archived' WHERE id = :id AND status = 'active'";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':id', $data->id);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $conn->commit();
        error_log("User with ID " . $data->id . " archived successfully.");
        http_response_code(200);
        echo json_encode(array("success" => true, "message" => "User archived successfully."));
    } else {
        $conn->rollBack(); // No change, so roll back transaction
        error_log("No user found with ID " . $data->id . ", or user is already archived.");
        http_response_code(200);
        echo json_encode(array("success" => true, "message" => "No changes were made or user already archived."));
    }
} catch (Exception $e) {
    $conn->rollBack();
    error_log("Error archiving user with ID " . $data->id . ": " . $e->getMessage());
    http_response_code(503);
    echo json_encode(array("success" => false, "message" => "Unable to archive user: " . $e->getMessage()));
}

?>
