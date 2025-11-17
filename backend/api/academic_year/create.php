<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (
    !empty($data->academic_year_name) &&
    !empty($data->start_date) &&
    !empty($data->end_date)
) {
    try {
        // Check for duplicate academic year
        $check_query = "SELECT COUNT(*) FROM academic_years WHERE academic_year_name = :academic_year_name";
        $check_stmt = $conn->prepare($check_query);
        $check_stmt->bindParam(":academic_year_name", $data->academic_year_name);
        $check_stmt->execute();
        
        if ($check_stmt->fetchColumn() > 0) {
            http_response_code(400);
            echo json_encode(array("message" => "Academic year already exists."));
            exit();
        }

        $query = "INSERT INTO academic_years 
                  (academic_year_name, start_date, end_date, status) 
                  VALUES (:academic_year_name, :start_date, :end_date, :status)";

        $stmt = $conn->prepare($query);

        // Sanitize and bind data
        $academic_year_name = htmlspecialchars(strip_tags($data->academic_year_name));
        $start_date = htmlspecialchars(strip_tags($data->start_date));
        $end_date = htmlspecialchars(strip_tags($data->end_date));
        
        // Set status to Active by default if not provided, otherwise use provided status
        $status = isset($data->status) ? htmlspecialchars(strip_tags($data->status)) : "Active";

        $stmt->bindParam(":academic_year_name", $academic_year_name);
        $stmt->bindParam(":start_date", $start_date);
        $stmt->bindParam(":end_date", $end_date);
        $stmt->bindParam(":status", $status);

        if ($stmt->execute()) {
            // Get the newly created record
            $new_id = $conn->lastInsertId();
            $select_query = "SELECT * FROM academic_years WHERE academic_year_id = :id";
            $select_stmt = $conn->prepare($select_query);
            $select_stmt->bindParam(":id", $new_id);
            $select_stmt->execute();
            $new_record = $select_stmt->fetch(PDO::FETCH_ASSOC);

            http_response_code(201);
            echo json_encode(array(
                "message" => "Academic year was created.",
                "academic_year" => array(
                    "id" => $new_record['academic_year_id'],
                    "year" => $new_record['academic_year_name'],
                    "startDate" => $new_record['start_date'],
                    "endDate" => $new_record['end_date'],
                    "status" => $new_record['status']
                )
            ));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to create academic year."));
        }
    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to create academic year. Data is incomplete."));
}
?> 