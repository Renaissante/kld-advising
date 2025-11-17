<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id)) {
    try {
        // Check if academic year exists
        $check_query = "SELECT COUNT(*) FROM academic_years WHERE academic_year_id = :id";
        $check_stmt = $conn->prepare($check_query);
        $check_stmt->bindParam(":id", $data->id);
        $check_stmt->execute();
        
        if ($check_stmt->fetchColumn() == 0) {
            http_response_code(404);
            echo json_encode(array("message" => "Academic year not found."));
            exit();
        }

        // Build update query based on provided fields
        $update_fields = array();
        $params = array(":id" => $data->id);

        if (isset($data->academic_year_name)) {
            $update_fields[] = "academic_year_name = :academic_year_name";
            $params[":academic_year_name"] = htmlspecialchars(strip_tags($data->academic_year_name));
        }

        if (isset($data->start_date)) {
            $update_fields[] = "start_date = :start_date";
            $params[":start_date"] = htmlspecialchars(strip_tags($data->start_date));
        }

        if (isset($data->end_date)) {
            $update_fields[] = "end_date = :end_date";
            $params[":end_date"] = htmlspecialchars(strip_tags($data->end_date));
        }

        if (isset($data->status)) {
            // Validate status value
            if (!in_array($data->status, ['Active', 'Inactive'])) {
                http_response_code(400);
                echo json_encode(array("message" => "Invalid status value. Must be 'Active' or 'Inactive'."));
                exit();
            }

            $update_fields[] = "status = :status";
            $params[":status"] = htmlspecialchars(strip_tags($data->status));
        }

        if (isset($data->is_current)) {
            // If trying to set to current, first set all others to not current
            if ($data->is_current === true) {
                $reset_current_query = "UPDATE academic_years SET is_current = FALSE WHERE academic_year_id != :id";
                $reset_current_stmt = $conn->prepare($reset_current_query);
                $reset_current_stmt->bindParam(":id", $data->id);
                $reset_current_stmt->execute();
            }
            $update_fields[] = "is_current = :is_current";
            $params[":is_current"] = $data->is_current ? 1 : 0; // SQLite stores BOOLEAN as 0 or 1
        }

        if (empty($update_fields)) {
            http_response_code(400);
            echo json_encode(array("message" => "No fields to update."));
            exit();
        }

        $query = "UPDATE academic_years SET " . implode(", ", $update_fields) . " WHERE academic_year_id = :id";
        $stmt = $conn->prepare($query);

        // Bind all parameters
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }

        if ($stmt->execute()) {
            // Get the updated record
            $select_query = "SELECT * FROM academic_years WHERE academic_year_id = :id";
            $select_stmt = $conn->prepare($select_query);
            $select_stmt->bindParam(":id", $data->id);
            $select_stmt->execute();
            $updated_record = $select_stmt->fetch(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode(array(
                "message" => "Academic year was updated.",
                "academic_year" => array(
                    "id" => $updated_record['academic_year_id'],
                    "year" => $updated_record['academic_year_name'],
                    "startDate" => $updated_record['start_date'],
                    "endDate" => $updated_record['end_date'],
                    "status" => $updated_record['status'],
                    "is_current" => (bool)$updated_record['is_current']
                )
            ));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to update academic year."));
        }
    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to update academic year. ID is required."));
}
?> 