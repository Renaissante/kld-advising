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
if (!isset($data->name) || empty($data->name) ||
    !isset($data->capacity) || !is_numeric($data->capacity) ||
    !isset($data->program_id) || empty($data->program_id) ||
    !isset($data->year_level_id) || empty($data->year_level_id) ||
    !isset($data->academic_year_id) || empty($data->academic_year_id) ||
    !isset($data->semester_id) || empty($data->semester_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete or invalid data provided."));
    exit();
}

$name = $data->name;
$capacity = $data->capacity;
$program_id = $data->program_id;
$year_level_id = $data->year_level_id;
$academic_year_id = $data->academic_year_id;
$semester_id = $data->semester_id;

try {
    // Check for duplicate active section name for the same academic context
    $check_query = "SELECT id FROM sections 
                    WHERE name = :name 
                    AND academic_year_id = :academic_year_id 
                    AND semester_id = :semester_id 
                    AND program_id = :program_id 
                    -- AND year_level_id = :year_level_id
                    AND status = 'active' LIMIT 1";
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(':name', $name);
    $check_stmt->bindParam(':academic_year_id', $academic_year_id);
    $check_stmt->bindParam(':semester_id', $semester_id);
    $check_stmt->bindParam(':program_id', $program_id);
    // $check_stmt->bindParam(':year_level_id', $year_level_id);
    $check_stmt->execute();

    if ($check_stmt->rowCount() > 0) {
        http_response_code(409); // Conflict
        echo json_encode(array("message" => "An active section with this name already exists for this semester."));
        exit();
    }

    $query = "INSERT INTO sections 
                (name, capacity, program_id, year_level_id, academic_year_id, semester_id)
              VALUES 
                (:name, :capacity, :program_id, :year_level_id, :academic_year_id, :semester_id)";
    
    $stmt = $conn->prepare($query);

    // Bind parameters
    $stmt->bindParam(':name', $name);
    $stmt->bindParam(':capacity', $capacity);
    $stmt->bindParam(':program_id', $program_id);
    $stmt->bindParam(':year_level_id', $year_level_id);
    $stmt->bindParam(':academic_year_id', $academic_year_id);
    $stmt->bindParam(':semester_id', $semester_id);

    if ($stmt->execute()) {
        http_response_code(201); // Created
        echo json_encode(array("message" => "Section created successfully."));
    } else {
        http_response_code(503); // Service Unavailable
        echo json_encode(array("message" => "Unable to create section."));
    }

} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>