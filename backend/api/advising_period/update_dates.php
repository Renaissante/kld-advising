<?php
error_log("update_dates.php: Script started.");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: PUT");

include_once '../../config/cors.php';
include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));
error_log("update_dates.php: Received JSON data: " . json_encode($data));

if (!isset($data->id) || !isset($data->academic_year_id) || !isset($data->semester_id) || !isset($data->start_date) || !isset($data->end_date)) {
    error_log("update_dates.php: Incomplete data. Missing id, academic_year_id, semester_id, start_date, or end_date.");
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data. Missing id, academic_year_id, semester_id, start_date, or end_date."));
    exit();
}

$id = $data->id;
$academic_year_id = $data->academic_year_id;
$semester_id = $data->semester_id;
$start_date = $data->start_date;
$end_date = $data->end_date;

error_log("update_dates.php: Updating with ID=" . $id . ", AY_ID=" . $academic_year_id . ", SEM_ID=" . $semester_id . ", StartDate=" . $start_date . ", EndDate=" . $end_date);

try {
    // First, check if the advising period exists for the given ID, academic year, and semester
    $check_query = "SELECT id FROM advising_periods WHERE id = :id AND academic_year_id = :academic_year_id AND semester_id = :semester_id LIMIT 1";
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $check_stmt->bindParam(':academic_year_id', $academic_year_id, PDO::PARAM_INT);
    $check_stmt->bindParam(':semester_id', $semester_id, PDO::PARAM_INT);
    $check_stmt->execute();

    if ($check_stmt->rowCount() == 0) {
        error_log("update_dates.php: Advising period NOT FOUND for ID=" . $id . ", AY_ID=" . $academic_year_id . ", SEM_ID=" . $semester_id);
        http_response_code(404);
        echo json_encode(array("message" => "Advising period not found for the specified ID, academic year, and semester."));
        exit();
    }

    $query = "UPDATE advising_periods SET start_date = :start_date, end_date = :end_date WHERE id = :id AND academic_year_id = :academic_year_id AND semester_id = :semester_id";
    $stmt = $conn->prepare($query);

    $stmt->bindParam(':start_date', $start_date);
    $stmt->bindParam(':end_date', $end_date);
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->bindParam(':academic_year_id', $academic_year_id, PDO::PARAM_INT);
    $stmt->bindParam(':semester_id', $semester_id, PDO::PARAM_INT);

    if ($stmt->execute()) {
        if ($stmt->rowCount() > 0) {
            error_log("update_dates.php: Advising period dates updated successfully for ID=" . $id);
            http_response_code(200);
            echo json_encode(array("message" => "Advising period dates updated."));
        } else {
            error_log("update_dates.php: Advising period found, but no changes made (data was identical) for ID=" . $id . ", AY_ID=" . $academic_year_id . ", SEM_ID=" . $semester_id);
            http_response_code(200); // Still a success, just no actual change
            echo json_encode(array("message" => "Advising period found, but dates are already identical."));
        }
    } else {
        error_log("update_dates.php: Unable to update advising period dates for ID=" . $id . ". ErrorInfo: " . json_encode($stmt->errorInfo()));
        http_response_code(503);
        echo json_encode(array("message" => "Unable to update advising period dates."));
    }
} catch (PDOException $e) {
    error_log("update_dates.php: Database error: " . $e->getMessage());
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>
