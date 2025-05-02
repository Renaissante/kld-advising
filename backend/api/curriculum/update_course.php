<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, PUT"); // Allow PUT method as well for updates
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

// Check if ID is provided for update
if (empty($data->id)) {
    http_response_code(400); // Bad Request
    echo json_encode(array("success" => false, "message" => "Unable to update course. Course ID is required."));
    exit();
}

$course_id = filter_var($data->id, FILTER_VALIDATE_INT);
if (!$course_id) {
     http_response_code(400); // Bad Request
     echo json_encode(array("success" => false, "message" => "Invalid Course ID provided."));
     exit();
}


// Begin transaction
$conn->beginTransaction();

try {
    // Check if the course exists
    $check_query = "SELECT curriculum_id FROM courses WHERE id = :id"; // Also get curriculum_id for checks
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(":id", $course_id, PDO::PARAM_INT);
    $check_stmt->execute();
    $existing_course = $check_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$existing_course) {
        http_response_code(404); // Not Found
        echo json_encode(array("success" => false, "message" => "Course not found with ID: " . $course_id));
        $conn->rollBack();
        exit();
    }
    $current_curriculum_id = $existing_course['curriculum_id'];


    // --- Duplicate Code/Title Check (within the same curriculum, excluding self) ---
    if (isset($data->course_code)) {
        $check_code_query = "SELECT COUNT(*) FROM courses WHERE course_code = :course_code AND curriculum_id = :curriculum_id AND id != :id";
        $check_code_stmt = $conn->prepare($check_code_query);
        $check_code_stmt->bindParam(":course_code", $data->course_code);
        $check_code_stmt->bindParam(":curriculum_id", $current_curriculum_id, PDO::PARAM_INT);
        $check_code_stmt->bindParam(":id", $course_id, PDO::PARAM_INT);
        $check_code_stmt->execute();
        if ($check_code_stmt->fetchColumn() > 0) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => "Another course in this curriculum already has this code."));
            $conn->rollBack();
            exit();
        }
    }
     if (isset($data->course_title)) {
        $check_title_query = "SELECT COUNT(*) FROM courses WHERE course_title = :course_title AND curriculum_id = :curriculum_id AND id != :id";
        $check_title_stmt = $conn->prepare($check_title_query);
        $check_title_stmt->bindParam(":course_title", $data->course_title);
        $check_title_stmt->bindParam(":curriculum_id", $current_curriculum_id, PDO::PARAM_INT);
        $check_title_stmt->bindParam(":id", $course_id, PDO::PARAM_INT);
        $check_title_stmt->execute();
        if ($check_title_stmt->fetchColumn() > 0) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => "Another course in this curriculum already has this title."));
            $conn->rollBack();
            exit();
        }
    }
    // --- End Duplicate Check ---


    // Build update query for the 'courses' table based on provided fields
    $update_fields = [];
    $params = [":id" => $course_id]; // Add ID to params immediately

    // Map frontend fields to database columns (excluding prerequisite_id)
    $field_map = [
        'course_code' => 'course_code',
        'course_title' => 'course_title',
        'unit_lec' => 'unit_lec',
        'unit_lab' => 'unit_lab',
        'hour_lec' => 'hour_lec',
        'hour_lab' => 'hour_lab',
        'year_level_id' => 'year_level_id',
        'semester_id' => 'semester_id'
        // curriculum_id is usually not updated this way
    ];

    foreach ($field_map as $data_key => $db_column) {
        if (isset($data->$data_key)) {
            $update_fields[] = "`" . $db_column . "` = :" . $db_column;
            // Sanitize non-ID fields
            if (str_ends_with($db_column, '_id')) {
                 $params[":" . $db_column] = filter_var($data->$data_key, FILTER_VALIDATE_INT) ?: null;
            } else {
                 $params[":" . $db_column] = htmlspecialchars(strip_tags($data->$data_key));
            }
        }
    }

    // Execute update for the main course details if there are fields to update
    if (!empty($update_fields)) {
        $query = "UPDATE courses SET " . implode(", ", $update_fields) . " WHERE id = :id";
        $stmt = $conn->prepare($query);

        // Bind parameters dynamically
        foreach ($params as $key => &$value) {
             $paramType = PDO::PARAM_STR;
             if (str_ends_with($key, '_id') || $key === ':id') {
                 $paramType = $value === null ? PDO::PARAM_NULL : PDO::PARAM_INT;
             }
             $stmt->bindValue($key, $value, $paramType);
        }
        unset($value); // Break the reference

        if (!$stmt->execute()) {
            $conn->rollBack();
            http_response_code(503);
            error_log("SQL Error updating course table: " . implode(", ", $stmt->errorInfo()));
            echo json_encode(array("success" => false, "message" => "Unable to update course details. Database error occurred."));
            exit();
        }
    }

    // --- Update Prerequisites ---
    // 1. Delete existing prerequisites for this course
    $delete_prereq_query = "DELETE FROM course_prerequisites WHERE course_id = :course_id";
    $delete_prereq_stmt = $conn->prepare($delete_prereq_query);
    $delete_prereq_stmt->bindParam(":course_id", $course_id, PDO::PARAM_INT);
    if (!$delete_prereq_stmt->execute()) {
        $conn->rollBack();
        http_response_code(503);
        error_log("SQL Error deleting prerequisites: " . implode(", ", $delete_prereq_stmt->errorInfo()));
        echo json_encode(array("success" => false, "message" => "Unable to update prerequisites (delete step). Database error occurred."));
        exit();
    }

    // 2. Insert new prerequisites if provided
    $prerequisites_updated = [];
    if (isset($data->prerequisite_ids) && is_array($data->prerequisite_ids)) {
        $insert_prereq_query = "INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (:course_id, :prerequisite_course_id)";
        $insert_prereq_stmt = $conn->prepare($insert_prereq_query);

        foreach ($data->prerequisite_ids as $prereq_id) {
            $prereq_id_sanitized = filter_var($prereq_id, FILTER_VALIDATE_INT);
            // Ensure prerequisite is valid, exists, and is not the course itself
            if ($prereq_id_sanitized && $prereq_id_sanitized > 0 && $prereq_id_sanitized != $course_id) {
                 // Optional: Check if prerequisite course exists and belongs to the same curriculum
                 // $check_prereq_exists_query = "SELECT COUNT(*) FROM courses WHERE id = :prereq_id AND curriculum_id = :curriculum_id";
                 // ... execute check ...
                 // if ($exists) { ... insert ... }

                 $insert_prereq_stmt->bindParam(":course_id", $course_id, PDO::PARAM_INT);
                 $insert_prereq_stmt->bindParam(":prerequisite_course_id", $prereq_id_sanitized, PDO::PARAM_INT);
                 if (!$insert_prereq_stmt->execute()) {
                     // Handle error during prerequisite insertion
                     throw new Exception("Failed to add prerequisite ID: " . $prereq_id_sanitized . " Error: " . print_r($insert_prereq_stmt->errorInfo(), true));
                 }
                 $prerequisites_updated[] = $prereq_id_sanitized;
            }
        }
    }
    // --- End Update Prerequisites ---


    // Commit transaction
    $conn->commit();

    // Get the fully updated record including new prerequisites
    $select_query = "SELECT * FROM courses WHERE id = :id";
    $select_stmt = $conn->prepare($select_query);
    $select_stmt->bindParam(":id", $course_id);
    $select_stmt->execute();
    $updated_record = $select_stmt->fetch(PDO::FETCH_ASSOC);

    // Fetch prerequisites for the updated course
    $prereq_fetch_query = "
        SELECT cp.prerequisite_course_id, c.course_code
        FROM course_prerequisites cp
        JOIN courses c ON cp.prerequisite_course_id = c.id
        WHERE cp.course_id = :course_id";
    $prereq_fetch_stmt = $conn->prepare($prereq_fetch_query);
    $prereq_fetch_stmt->bindParam(":course_id", $course_id);
    $prereq_fetch_stmt->execute();
    $prerequisites_data = [];
    while ($prereq_row = $prereq_fetch_stmt->fetch(PDO::FETCH_ASSOC)) {
        $prerequisites_data[] = [
            'id' => $prereq_row['prerequisite_course_id'],
            'code' => $prereq_row['course_code']
        ];
    }


    if ($updated_record) {
         http_response_code(200); // OK
         echo json_encode(array(
             "success" => true,
             "message" => "Course was updated successfully.",
             "course" => array( // Match structure expected by frontend/get_courses
                 "id" => $updated_record['id'],
                 "curriculum_id" => $updated_record['curriculum_id'],
                 "course_code" => $updated_record['course_code'],
                 "course_title" => $updated_record['course_title'],
                 "unit_lec" => $updated_record['unit_lec'],
                 "unit_lab" => $updated_record['unit_lab'],
                 "hour_lec" => $updated_record['hour_lec'],
                 "hour_lab" => $updated_record['hour_lab'],
                 "prerequisites" => $prerequisites_data, // Send array of prerequisites
                 "year_level_id" => $updated_record['year_level_id'],
                 "semester_id" => $updated_record['semester_id']
             )
         ));
    } else {
         // This case should ideally not be reached if the initial check passed and commit succeeded
         http_response_code(404);
         echo json_encode(array("success" => false, "message" => "Failed to retrieve updated course after update."));
    }

} catch (PDOException $e) {
    $conn->rollBack(); // Rollback on PDO exception
    http_response_code(503); // Service Unavailable
    error_log("PDOException in update_course.php: " . $e->getMessage());
    echo json_encode(array("success" => false, "message" => "Database error: Unable to process request."));
} catch (Exception $e) {
    $conn->rollBack(); // Rollback on general exception
    http_response_code(500); // Internal Server Error
    error_log("General Exception in update_course.php: " . $e->getMessage());
    echo json_encode(array("success" => false, "message" => "An unexpected error occurred: " . $e->getMessage()));
}

?> 