<?php
error_log("update_status.php: Script started.");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: PUT");

include_once '../../config/cors.php';
include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));
error_log("update_status.php: Received JSON data: " . json_encode($data));

if (!isset($data->id) || !isset($data->academic_year_id) || !isset($data->semester_id) || !isset($data->status)) {
    error_log("update_status.php: Incomplete data. Missing id, academic_year_id, semester_id, or status.");
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data. Missing id, academic_year_id, semester_id, or status."));
    exit();
}

$id = $data->id;
$academic_year_id = $data->academic_year_id;
$semester_id = $data->semester_id;
$status = $data->status;

error_log("update_status.php: Updating with ID=" . $id . ", AY_ID=" . $academic_year_id . ", SEM_ID=" . $semester_id . ", Status=" . $status);

// Validate status input
if (!in_array($status, ['active', 'inactive'])) {
    error_log("update_status.php: Invalid status value received: " . $status);
    http_response_code(400);
    echo json_encode(array("message" => "Invalid status value. Must be 'active' or 'inactive'."));
    exit();
}

try {
    // Deactivate all other advising periods if setting to 'active'
    if ($status === 'active') {
        error_log("update_status.php: Deactivating other advising periods (if any) for ID=" . $id);
        $deactivate_query = "UPDATE advising_periods SET status = 'inactive' WHERE id <> :id";
        $deactivate_stmt = $conn->prepare($deactivate_query);
        $deactivate_stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $deactivate_stmt->execute();
    }

    $query = "UPDATE advising_periods SET status = :status WHERE id = :id AND academic_year_id = :academic_year_id AND semester_id = :semester_id";
    $stmt = $conn->prepare($query);

    $stmt->bindParam(':status', $status);
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->bindParam(':academic_year_id', $academic_year_id, PDO::PARAM_INT);
    $stmt->bindParam(':semester_id', $semester_id, PDO::PARAM_INT);

    if ($stmt->execute()) {
        if ($stmt->rowCount() > 0) {
            error_log("update_status.php: Advising period status updated successfully for ID=" . $id);
            http_response_code(200);
            echo json_encode(array("message" => "Advising period status updated."));
        } else {
            error_log("update_status.php: Advising period not found or no changes made for ID=" . $id . ", AY_ID=" . $academic_year_id . ", SEM_ID=" . $semester_id);
            http_response_code(404);
            echo json_encode(array("message" => "Advising period not found for the specified ID, academic year, and semester."));
        }
    } else {
        error_log("update_status.php: Unable to update advising period status for ID=" . $id . ". ErrorInfo: " . json_encode($stmt->errorInfo()));
        http_response_code(503);
        echo json_encode(array("message" => "Unable to update advising period status."));
    }
} catch (PDOException $e) {
    error_log("update_status.php: Database error: " . $e->getMessage());
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>
