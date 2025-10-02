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
    
    // Check if the faculty exists as an employee
    $employee_query = "SELECT e.employee_id, e.name, d.name as department_name
                       FROM employees e
                       JOIN departments d ON e.department_id = d.id
                       WHERE e.employee_id = :faculty_id";
    $employee_stmt = $conn->prepare($employee_query);
    $employee_stmt->bindParam(':faculty_id', $data->faculty_id);
    $employee_stmt->execute();

    if ($employee_stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("message" => "Faculty not found as an employee."));
        exit();
    }
    $employee_info = $employee_stmt->fetch(PDO::FETCH_ASSOC);

    // Check if the user exists and has an eligible role
    $user_roles_query = "SELECT r.role_name
                         FROM users u
                         JOIN user_roles ur ON u.id = ur.user_id
                         JOIN roles r ON ur.role_id = r.id
                         WHERE u.id = :user_id";
                     
    $user_roles_stmt = $conn->prepare($user_roles_query);
    $user_roles_stmt->bindParam(':user_id', $data->faculty_id);
    $user_roles_stmt->execute();
    
    if ($user_roles_stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("message" => "User roles not found."));
        exit();
    }
    
    $user_roles = $user_roles_stmt->fetchAll(PDO::FETCH_COLUMN, 0); // Fetch just role names
    
    $is_eligible_advisor = false;
    $allowed_advisor_roles = ['faculty', 'program_chair', 'dean'];

    foreach ($user_roles as $role) {
        if (in_array($role, $allowed_advisor_roles)) {
            $is_eligible_advisor = true;
            break;
        }
    }

    if (!$is_eligible_advisor) {
        http_response_code(400);
        echo json_encode(array("message" => "User does not have an eligible role to be assigned as an advisor."));
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
            "new_advisor" => $employee_info["name"],
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
            "advisor_name" => $employee_info["name"],
            "advisor_email" => "N/A" // Email is not directly available from this query
        ));
    }
    
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?> 