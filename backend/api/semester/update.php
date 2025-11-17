<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (
    !empty($data->id) &&
    (!empty($data->semester_name) || isset($data->status))
) {
    try {
        // Check if the provided ID exists
        $check_id_query = "SELECT COUNT(*) FROM semesters WHERE semester_id = :id";
        $check_id_stmt = $conn->prepare($check_id_query);
        $check_id_stmt->bindParam(":id", $data->id);
        $check_id_stmt->execute();
        
        if ($check_id_stmt->fetchColumn() == 0) {
            http_response_code(404);
            echo json_encode(array("message" => "Semester not found."));
            exit();
        }

        // If updating name, check for duplicates
        if (!empty($data->semester_name)) {
            $check_query = "SELECT COUNT(*) FROM semesters WHERE semester_name = :semester_name AND semester_id != :id";
            $check_stmt = $conn->prepare($check_query);
            $check_stmt->bindParam(":semester_name", $data->semester_name);
            $check_stmt->bindParam(":id", $data->id);
            $check_stmt->execute();
            
            if ($check_stmt->fetchColumn() > 0) {
                http_response_code(400);
                echo json_encode(array("message" => "Semester name already exists."));
                exit();
            }
        }

        // Build the update query based on provided fields
        $update_fields = array();
        $params = array();

        if (!empty($data->semester_name)) {
            $update_fields[] = "semester_name = :semester_name";
            $params[':semester_name'] = htmlspecialchars(strip_tags($data->semester_name));
        }

        if (isset($data->status)) {
            $update_fields[] = "status = :status";
            $params[':status'] = htmlspecialchars(strip_tags($data->status));
        }

        if (isset($data->is_current)) {
            // If trying to set to current, first set all others to not current
            if ($data->is_current === true) {
                $reset_current_query = "UPDATE semesters SET is_current = FALSE WHERE semester_id != :id";
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

        $query = "UPDATE semesters SET " . implode(", ", $update_fields) . " WHERE semester_id = :id";
        $params[':id'] = htmlspecialchars(strip_tags($data->id));

        $stmt = $conn->prepare($query);
        
        // Bind all parameters
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }

        if ($stmt->execute()) {
            // Get the updated record
            $select_query = "SELECT * FROM semesters WHERE semester_id = :id";
            $select_stmt = $conn->prepare($select_query);
            $select_stmt->bindParam(":id", $data->id);
            $select_stmt->execute();
            $updated_record = $select_stmt->fetch(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode(array(
                "message" => "Semester was updated.",
                "semester" => array(
                    "id" => $updated_record['semester_id'],
                    "name" => $updated_record['semester_name'],
                    "status" => $updated_record['status'],
                    "is_current" => (bool)$updated_record['is_current']
                )
            ));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to update semester."));
        }
    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to update semester. Data is incomplete."));
}
?> 