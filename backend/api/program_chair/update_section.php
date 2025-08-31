<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

// Validate input
if (!isset($data->id) || empty($data->id) ||
    !isset($data->name) || empty($data->name) ||
    !isset($data->capacity) || !is_numeric($data->capacity) ||
    !isset($data->program_id) || empty($data->program_id) ||
    !isset($data->year_level_id) || empty($data->year_level_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete or invalid data provided."));
    exit();
}

$id = $data->id;
$name = $data->name;
$capacity = $data->capacity;
$program_id = $data->program_id;
$year_level_id = $data->year_level_id;

try {
    // Check for duplicate active section name for the same academic context, excluding the current section being updated
    $check_query = "SELECT id FROM sections 
                    WHERE name = :name 
                    AND academic_year_id = (SELECT academic_year_id FROM sections WHERE id = :id) 
                    AND semester_id = (SELECT semester_id FROM sections WHERE id = :id) 
                    AND program_id = :program_id 
                    AND year_level_id = :year_level_id
                    AND status = 'active'
                    AND id != :id LIMIT 1";

    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(':id', $id);
    $check_stmt->bindParam(':name', $name);
    $check_stmt->bindParam(':program_id', $program_id);
    $check_stmt->bindParam(':year_level_id', $year_level_id);
    $check_stmt->execute();

    if ($check_stmt->rowCount() > 0) {
        http_response_code(409); // Conflict
        echo json_encode(array("message" => "An active section with this name already exists for the selected academic year, semester, program, and year level."));
        exit();
    }

    // Check if new capacity is lower than currently enrolled students
    $enrolled_count_query = "SELECT COUNT(id) FROM student_section_enrollments WHERE section_id = :id AND enrollment_status = 'enrolled'";
    $enrolled_count_stmt = $conn->prepare($enrolled_count_query);
    $enrolled_count_stmt->bindParam(':id', $id);
    $enrolled_count_stmt->execute();
    $current_enrolled_count = $enrolled_count_stmt->fetchColumn();

    if ($capacity < $current_enrolled_count) {
        http_response_code(400);
        echo json_encode(array("message" => "New capacity cannot be lower than the number of currently enrolled students ({$current_enrolled_count})."));
        exit();
    }

    // Update section
    $query = "UPDATE sections 
                SET name = :name, 
                    capacity = :capacity, 
                    program_id = :program_id, 
                    year_level_id = :year_level_id 
                WHERE id = :id";
    
    $stmt = $conn->prepare($query);

    // Bind parameters
    $stmt->bindParam(':name', $name);
    $stmt->bindParam(':capacity', $capacity);
    $stmt->bindParam(':program_id', $program_id);
    $stmt->bindParam(':year_level_id', $year_level_id);
    $stmt->bindParam(':id', $id);

    if ($stmt->execute()) {
        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode(array("message" => "Section updated successfully."));
        } else {
            // No rows affected, but no error (e.g., data was identical)
            http_response_code(200);
            echo json_encode(array("message" => "Section details are up to date."));
        }
    } else {
        http_response_code(503); // Service Unavailable
        echo json_encode(array("message" => "Unable to update section."));
    }

} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>