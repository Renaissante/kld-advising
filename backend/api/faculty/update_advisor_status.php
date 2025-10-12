<?php
// Include CORS headers
include_once '../../config/cors.php';

// Set headers for content type
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS request (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    exit(0);
}

// Include database configuration
include_once '../../config/database.php';

// Check if the connection variable exists and is valid
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in update_advisor_status.php. Check config/database.php and ensure $conn is set.");
    echo json_encode(array("message" => "Database connection failed."));
    exit();
}

// Expecting JSON input
$data = json_decode(file_get_contents("php://input"));

// Validate input
if (empty($data->advisor_id) || empty($data->new_status)) {
    http_response_code(400);
    echo json_encode(array("message" => "Missing 'advisor_id' or 'new_status'."));
    exit();
}

$advisor_id = $data->advisor_id;
$new_status = $data->new_status;

// Validate new_status against allowed ENUM values
$allowed_statuses = ['available', 'unavailable'];
if (!in_array($new_status, $allowed_statuses)) {
    http_response_code(400);
    echo json_encode(array("message" => "Invalid 'new_status' provided. Allowed values are 'available' or 'unavailable'."));
    exit();
}

try {
    // TODO: Implement Authorization: Only Program Chairs or Deans should be able to update advisor status.
    // This could involve checking user roles from a session or JWT token.

    // Prepare the update query for the faculty table
    $query = "UPDATE faculty SET advisor_status = :new_status WHERE employee_id = :advisor_id";

    $stmt = $conn->prepare($query);

    if ($stmt === false) {
        throw new PDOException("Failed to prepare the update query. Error: " . implode(" - ", $conn->errorInfo()));
    }

    // Bind parameters
    $stmt->bindParam(':new_status', $new_status);
    $stmt->bindParam(':advisor_id', $advisor_id);

    // Execute the query
    if ($stmt->execute()) {
        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode(array("message" => "Advisor status updated successfully.", "advisor_id" => $advisor_id, "new_status" => $new_status));
        } else {
            http_response_code(404);
            echo json_encode(array("message" => "No advisor found with the provided ID or status is already the same."));
        }
    } else {
        http_response_code(500);
        error_log("Error updating advisor status: " . implode(" - ", $stmt->errorInfo()));
        echo json_encode(array("message" => "Failed to update advisor status."));
    }

} catch (PDOException $exception) {
    http_response_code(500);
    error_log("Database error in update_advisor_status.php: " . $exception->getMessage());
    echo json_encode(array(
        "message" => "Unable to update advisor status due to a database error.",
        "error_details_debug" => $exception->getMessage()
    ));
} catch (Exception $exception) {
    http_response_code(500);
    error_log("General error in update_advisor_status.php: " . $exception->getMessage());
    echo json_encode(array(
        "message" => "An unexpected error occurred.",
        "error_details_debug" => $exception->getMessage()
    ));
}
?>
