<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

// Check required fields
if (empty($data->name) || empty($data->program_id) || empty($data->academic_year_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Missing required fields. Name, program ID, and academic year ID are required."));
    exit();
}

try {
    // Check for duplicate curriculum
    $check_query = "SELECT COUNT(*) FROM curriculums WHERE name = :name AND program_id = :program_id AND academic_year_id = :academic_year_id";
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(":name", $data->name);
    $check_stmt->bindParam(":program_id", $data->program_id);
    $check_stmt->bindParam(":academic_year_id", $data->academic_year_id);
    $check_stmt->execute();
    
    if ($check_stmt->fetchColumn() > 0) {
        http_response_code(400);
        echo json_encode(array("message" => "Curriculum with this name, program and academic year already exists."));
        exit();
    }

    // Prepare SQL query with status defaulting to 'Active'
    $query = "INSERT INTO curriculums (name, program_id, academic_year_id, status) 
              VALUES (:name, :program_id, :academic_year_id, 'Active')";
    $stmt = $conn->prepare($query);

    // Sanitize and bind data
    $name = htmlspecialchars(strip_tags($data->name));
    $program_id = htmlspecialchars(strip_tags($data->program_id));
    $academic_year_id = htmlspecialchars(strip_tags($data->academic_year_id));

    $stmt->bindParam(":name", $name);
    $stmt->bindParam(":program_id", $program_id);
    $stmt->bindParam(":academic_year_id", $academic_year_id);

    if ($stmt->execute()) {
        // Get the newly created curriculum
        $curriculum_id = $conn->lastInsertId();
        
        // Query to get program name
        $program_query = "SELECT name FROM programs WHERE id = :program_id";
        $program_stmt = $conn->prepare($program_query);
        $program_stmt->bindParam(":program_id", $program_id);
        $program_stmt->execute();
        $program_name = $program_stmt->fetch(PDO::FETCH_ASSOC)['name'];
        
        // Query to get academic year
        $academic_year_query = "SELECT academic_year_name FROM academic_years WHERE academic_year_id = :academic_year_id";
        $academic_year_stmt = $conn->prepare($academic_year_query);
        $academic_year_stmt->bindParam(":academic_year_id", $academic_year_id);
        $academic_year_stmt->execute();
        
        // Fetch the academic year name
        $academicYearRow = $academic_year_stmt->fetch(PDO::FETCH_ASSOC);
        if (!$academicYearRow) {
            throw new Exception("Academic year not found");
        }
        $academic_year = $academicYearRow['academic_year_name'];
        
        // Build response data
        $curriculum_data = array(
            "id" => $curriculum_id,
            "name" => $name,
            "program_id" => $program_id,
            "program" => $program_name,
            "academic_year_id" => $academic_year_id,
            "academicYear" => $academic_year,
            "status" => "Active" // Include status in response
        );
        
        http_response_code(201); // Created
        echo json_encode(array(
            "message" => "Curriculum created successfully.",
            "curriculum" => $curriculum_data
        ));
    } else {
        http_response_code(503); // Service Unavailable
        echo json_encode(array("message" => "Unable to create curriculum."));
    }
} catch (PDOException $e) {
    http_response_code(503); // Service Unavailable
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?> 