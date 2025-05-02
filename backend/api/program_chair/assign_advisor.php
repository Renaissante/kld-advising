<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

include_once '../../config/database.php';

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Validate required fields
if (!isset($data->faculty_id) || empty($data->faculty_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Faculty ID is required"));
    exit();
}

if (!isset($data->section_id) || empty($data->section_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Section ID is required"));
    exit();
}

try {
    // First check if the section exists
    $section_query = "SELECT s.id, s.name, p.name as program_name, yl.level as year_level 
                     FROM sections s
                     LEFT JOIN programs p ON s.program_id = p.id
                     LEFT JOIN year_levels yl ON s.year_level_id = yl.id
                     WHERE s.id = :section_id";
                     
    $section_stmt = $conn->prepare($section_query);
    $section_stmt->bindParam(':section_id', $data->section_id);
    $section_stmt->execute();
    
    if ($section_stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("message" => "Section not found"));
        exit();
    }
    
    $section = $section_stmt->fetch(PDO::FETCH_ASSOC);
    
    // Check if the user exists and has an eligible role (not admin or student)
    $user_query = "SELECT u.id, u.email, u.role, e.name, e.department_id
                  FROM users u
                  LEFT JOIN employees e ON u.id = e.employee_id
                  WHERE u.id = :user_id";
                     
    $user_stmt = $conn->prepare($user_query);
    $user_stmt->bindParam(':user_id', $data->faculty_id);
    $user_stmt->execute();
    
    if ($user_stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("message" => "User not found"));
        exit();
    }
    
    $user = $user_stmt->fetch(PDO::FETCH_ASSOC);
    
    // Check if user has an eligible role (not admin or student)
    if ($user['role'] === 'admin' || $user['role'] === 'student') {
        http_response_code(400);
        echo json_encode(array("message" => "User with role '" . $user['role'] . "' cannot be assigned as an advisor"));
        exit();
    }
    
    // Check if this section already has an advisor
    $check_query = "SELECT sa.*, u.id, e.name as advisor_name 
                   FROM section_advisors sa
                   JOIN users u ON sa.advisor_id = u.id
                   LEFT JOIN employees e ON u.id = e.employee_id
                   WHERE sa.section_id = :section_id";
                   
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(':section_id', $data->section_id);
    $check_stmt->execute();
    
    // If section already has an advisor, update the assignment
    if ($check_stmt->rowCount() > 0) {
        $existing = $check_stmt->fetch(PDO::FETCH_ASSOC);
        
        $update_query = "UPDATE section_advisors 
                        SET advisor_id = :advisor_id 
                        WHERE section_id = :section_id";
                        
        $update_stmt = $conn->prepare($update_query);
        $update_stmt->bindParam(':advisor_id', $data->faculty_id);
        $update_stmt->bindParam(':section_id', $data->section_id);
        $update_stmt->execute();
        
        // Prepare success response with replaced information
        http_response_code(200);
        echo json_encode(array(
            "message" => "Advisor assignment updated successfully",
            "section_id" => $data->section_id,
            "section_name" => $section["name"],
            "previous_advisor" => $existing["advisor_name"],
            "new_advisor" => $user["name"],
            "replaced" => true
        ));
    } 
    // Otherwise create a new assignment
    else {
        $insert_query = "INSERT INTO section_advisors (section_id, advisor_id) 
                        VALUES (:section_id, :advisor_id)";
                        
        $insert_stmt = $conn->prepare($insert_query);
        $insert_stmt->bindParam(':section_id', $data->section_id);
        $insert_stmt->bindParam(':advisor_id', $data->faculty_id);
        $insert_stmt->execute();
        
        // Prepare success response
        http_response_code(201);
        echo json_encode(array(
            "message" => "Advisor assigned successfully",
            "section_id" => $data->section_id,
            "section_name" => $section["name"],
            "program" => $section["program_name"],
            "year_level" => $section["year_level"],
            "advisor_id" => $data->faculty_id,
            "advisor_name" => $user["name"],
            "advisor_email" => $user["email"]
        ));
    }
    
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?> 