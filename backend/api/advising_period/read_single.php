<?php
error_log("read_single.php: Script started.");
header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/cors.php';
include_once '../../config/database.php';

if (!isset($_GET['academic_year_id']) || !isset($_GET['semester_id'])) {
    error_log("read_single.php: Missing academic_year_id or semester_id.");
    http_response_code(400);
    echo json_encode(array("message" => "Missing academic_year_id or semester_id."));
    exit();
}

$academic_year_id = $_GET['academic_year_id'];
$semester_id = $_GET['semester_id'];

error_log("read_single.php: Received academic_year_id = " . $academic_year_id . ", semester_id = " . $semester_id);

try {
    $query = "SELECT * FROM advising_periods WHERE academic_year_id = :academic_year_id AND semester_id = :semester_id LIMIT 1";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':academic_year_id', $academic_year_id, PDO::PARAM_INT);
    $stmt->bindParam(':semester_id', $semester_id, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $advising_period = array(
            "id" => $row['id'],
            "academic_year_id" => $row['academic_year_id'],
            "semester_id" => $row['semester_id'],
            "start_date" => $row['start_date'],
            "end_date" => $row['end_date'],
            "status" => $row['status']
        );
        error_log("read_single.php: Found advising period: " . json_encode($advising_period));
        http_response_code(200);
        echo json_encode($advising_period);
    } else {
        error_log("read_single.php: Advising period not found for academic_year_id = " . $academic_year_id . " and semester_id = " . $semester_id);
        http_response_code(404);
        echo json_encode(array("message" => "Advising period not found for the specified academic year and semester."));
    }
} catch (PDOException $e) {
    error_log("read_single.php: Database error: " . $e->getMessage());
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>
