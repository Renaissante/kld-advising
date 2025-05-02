<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->semester_name)) {
    try {
        // Check for duplicate semester name
        $check_query = "SELECT COUNT(*) FROM semesters WHERE semester_name = :semester_name";
        $check_stmt = $conn->prepare($check_query);
        $check_stmt->bindParam(":semester_name", $data->semester_name);
        $check_stmt->execute();
        
        if ($check_stmt->fetchColumn() > 0) {
            http_response_code(400);
            echo json_encode(array("message" => "Semester name already exists."));
            exit();
        }

        // Check if there's already an active semester
        $check_active_query = "SELECT COUNT(*) FROM semesters WHERE status = 'Active'";
        $check_active_stmt = $conn->prepare($check_active_query);
        $check_active_stmt->execute();
        $has_active_semester = $check_active_stmt->fetchColumn() > 0;

        // Set status to Inactive if there's already an active semester
        $status = $has_active_semester ? 'Inactive' : 'Active';

        // Create semester
        $query = "INSERT INTO semesters (semester_name, status) VALUES (:semester_name, :status)";
        $stmt = $conn->prepare($query);

        // Sanitize and bind data
        $semester_name = htmlspecialchars(strip_tags($data->semester_name));

        $stmt->bindParam(":semester_name", $semester_name);
        $stmt->bindParam(":status", $status);

        if ($stmt->execute()) {
            // Get the created record
            $last_id = $conn->lastInsertId();
            $select_query = "SELECT * FROM semesters WHERE semester_id = :id";
            $select_stmt = $conn->prepare($select_query);
            $select_stmt->bindParam(":id", $last_id);
            $select_stmt->execute();
            $created_record = $select_stmt->fetch(PDO::FETCH_ASSOC);

            http_response_code(201);
            echo json_encode(array(
                "message" => "Semester was created.",
                "semester" => array(
                    "id" => $created_record['semester_id'],
                    "name" => $created_record['semester_name'],
                    "status" => $created_record['status']
                )
            ));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to create semester."));
        }
    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to create semester. Data is incomplete."));
}
?> 