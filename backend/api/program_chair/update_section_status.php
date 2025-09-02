<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';
include_once '../audit/log_activity.php';

$data = json_decode(file_get_contents("php://input"));

if (!isset($data->section_id) || !isset($data->status) ||
    !isset($data->user_id) || empty($data->user_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data. Provide section_id, status, and user_id."));
    exit();
}

$section_id = $data->section_id;
$status = $data->status;
$user_id = $data->user_id;

// Validate status to ensure it's one of the allowed ENUM values
$allowed_statuses = ['active', 'archived', 'completed'];
if (!in_array($status, $allowed_statuses)) {
    http_response_code(400);
    echo json_encode(array("message" => "Invalid status provided."));
    exit();
}

try {
    // Get current section details for logging and conditional updates
    $get_section_details_query = "SELECT name, status FROM sections WHERE id = :section_id LIMIT 1";
    $get_section_details_stmt = $conn->prepare($get_section_details_query);
    $get_section_details_stmt->bindParam(':section_id', $section_id);
    $get_section_details_stmt->execute();
    $section_details = $get_section_details_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$section_details) {
        http_response_code(404);
        echo json_encode(array("message" => "Section not found."));
        exit();
    }

    $section_name = $section_details['name'];
    $current_status = $section_details['status'];

    // If status is being updated to 'archived' and was not previously 'archived', update student enrollments and section_id
    if ($status === 'archived' && $current_status !== 'archived') {
        error_log("Attempting to archive section ID: " . $section_id);
        // 1. Update student_section_enrollments
        $update_enrollments_query = "UPDATE student_section_enrollments SET enrollment_status = 'archived' WHERE section_id = :section_id AND enrollment_status = 'enrolled'";
        $update_enrollments_stmt = $conn->prepare($update_enrollments_query);
        $update_enrollments_stmt->bindParam(':section_id', $section_id);
        if ($update_enrollments_stmt->execute()) {
            error_log("Student enrollments updated successfully for section ID: " . $section_id . ". Rows affected: " . $update_enrollments_stmt->rowCount());
        } else {
            $error_info = $update_enrollments_stmt->errorInfo();
            error_log("Error updating student enrollments for section ID: " . $section_id . ". Error: " . $error_info[2]);
        }

        // 2. Set students.section_id to NULL for students in this section
        $update_students_query = "UPDATE students SET section_id = NULL WHERE section_id = :section_id";
        $update_students_stmt = $conn->prepare($update_students_query);
        $update_students_stmt->bindParam(':section_id', $section_id);
        if ($update_students_stmt->execute()) {
            error_log("Students section_id set to NULL successfully for section ID: " . $section_id . ". Rows affected: " . $update_students_stmt->rowCount());
        } else {
            $error_info = $update_students_stmt->errorInfo();
            error_log("Error setting students.section_id to NULL for section ID: " . $section_id . ". Error: " . $error_info[2]);
        }
    }

    // If status is being updated to 'active' and was previously 'archived', restore student enrollments and section_id
    if ($status === 'active' && $current_status === 'archived') {
        error_log("Attempting to restore section ID: " . $section_id);
        // 1. Update student_section_enrollments
        $restore_enrollments_query = "UPDATE student_section_enrollments SET enrollment_status = 'enrolled' WHERE section_id = :section_id AND enrollment_status = 'archived'";
        $restore_enrollments_stmt = $conn->prepare($restore_enrollments_query);
        $restore_enrollments_stmt->bindParam(':section_id', $section_id);
        if ($restore_enrollments_stmt->execute()) {
            error_log("Student enrollments restored successfully for section ID: " . $section_id . ". Rows affected: " . $restore_enrollments_stmt->rowCount());
        } else {
            $error_info = $restore_enrollments_stmt->errorInfo();
            error_log("Error restoring student enrollments for section ID: " . $section_id . ". Error: " . $error_info[2]);
        }

        // 2. Set students.section_id back to section_id for students in this section
        // This assumes students that were archived from this section should be reassigned to it upon restore.
        // The original logic only set section_id to NULL. If a student was assigned to a new section, this would overwrite it.
        // A more robust solution might involve a `previous_section_id` column or more complex re-assignment logic.
        $restore_students_query = "UPDATE students SET section_id = :section_id WHERE id IN (SELECT student_id FROM student_section_enrollments WHERE section_id = :section_id AND enrollment_status = 'enrolled')";
        $restore_students_stmt = $conn->prepare($restore_students_query);
        $restore_students_stmt->bindParam(':section_id', $section_id);
        if ($restore_students_stmt->execute()) {
            error_log("Students section_id restored successfully for section ID: " . $section_id . ". Rows affected: " . $restore_students_stmt->rowCount());
        } else {
            $error_info = $restore_students_stmt->errorInfo();
            error_log("Error restoring students.section_id for section ID: " . $section_id . ". Error: " . $error_info[2]);
        }
    }

    $query = "UPDATE sections SET status = :status WHERE id = :section_id";
    $stmt = $conn->prepare($query);

    $stmt->bindParam(':status', $status);
    $stmt->bindParam(':section_id', $section_id);

    if ($stmt->execute()) {
        if ($stmt->rowCount() > 0) {
            // Log the status change activity
            $ipAddress = $_SERVER['REMOTE_ADDR'];
            $action_description = "Updated section {$section_name} status from {$current_status} to {$status}.";
            logActivity($user_id, 'update_section_status', $action_description, 'Section', $section_id, $current_status, $status, $ipAddress);

            http_response_code(200);
            echo json_encode(array("message" => "Section status updated successfully."));
        } else {
            http_response_code(404);
            echo json_encode(array("message" => "Section not found or status already set."));
        }
    } else {
        http_response_code(503);
        echo json_encode(array("message" => "Unable to update section status."));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}?>