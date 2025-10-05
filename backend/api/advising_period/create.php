<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

include_once '../../config/cors.php';
include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!isset($data->academic_year_id) || !isset($data->semester_id) || !isset($data->start_date) || !isset($data->end_date)) {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data. Missing academic_year_id, semester_id, start_date, or end_date."));
    exit();
}

$academic_year_id = $data->academic_year_id;
$semester_id = $data->semester_id;
$start_date = $data->start_date;
$end_date = $data->end_date;
$status = isset($data->status) ? $data->status : 'inactive'; // Default to inactive

try {
    // Check if an advising period already exists for this academic year and semester
    $check_query = "SELECT id FROM advising_periods WHERE academic_year_id = :academic_year_id AND semester_id = :semester_id LIMIT 1";
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(':academic_year_id', $academic_year_id, PDO::PARAM_INT);
    $check_stmt->bindParam(':semester_id', $semester_id, PDO::PARAM_INT);
    $check_stmt->execute();

    if ($check_stmt->rowCount() > 0) {
        http_response_code(409); // Conflict
        echo json_encode(array("message" => "An advising period already exists for this academic year and semester."));
        exit();
    }

    $query = "INSERT INTO advising_periods (academic_year_id, semester_id, start_date, end_date, status) VALUES (:academic_year_id, :semester_id, :start_date, :end_date, :status)";
    $stmt = $conn->prepare($query);

    $stmt->bindParam(':academic_year_id', $academic_year_id, PDO::PARAM_INT);
    $stmt->bindParam(':semester_id', $semester_id, PDO::PARAM_INT);
    $stmt->bindParam(':start_date', $start_date);
    $stmt->bindParam(':end_date', $end_date);
    $stmt->bindParam(':status', $status);

    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode(array("message" => "Advising period created."));
    } else {
        http_response_code(503);
        echo json_encode(array("message" => "Unable to create advising period."));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>
