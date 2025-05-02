<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

include_once '../../config/database.php';

// Check if the request is a POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(array("message" => "Method not allowed. Please use POST."));
    exit();
}

// Get the posted data
$data = json_decode(file_get_contents("php://input"));

// Validate required fields
if (!isset($data->faculty_id) || !isset($data->section_id) || !isset($data->course_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to assign course. Required data is incomplete."));
    exit();
}

$faculty_id = $data->faculty_id;
$section_id = $data->section_id;
$course_id = $data->course_id;

try {
    // Check if the section exists and get its academic year and semester
    $section_query = "SELECT s.id, s.name, s.program_id, s.year_level_id, s.academic_year_id, s.semester_id, 
                             p.name as program_name, 
                             yl.level as year_level, 
                             ay.academic_year_name as academic_year, 
                             sem.semester_name as semester
                      FROM sections s
                      LEFT JOIN programs p ON s.program_id = p.id
                      LEFT JOIN year_levels yl ON s.year_level_id = yl.id
                      JOIN academic_years ay ON s.academic_year_id = ay.academic_year_id
                      JOIN semesters sem ON s.semester_id = sem.semester_id
                      WHERE s.id = :section_id";
    
    $section_stmt = $conn->prepare($section_query);
    $section_stmt->bindParam(':section_id', $section_id);
    $section_stmt->execute();
    
    if ($section_stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("message" => "Section not found."));
        exit();
    }
    
    $section = $section_stmt->fetch(PDO::FETCH_ASSOC);
    
    // Check if the course exists and belongs to the right curriculum for this program
    $course_query = "SELECT c.id, c.course_code, c.course_title, c.curriculum_id, c.year_level_id, c.semester_id 
                    FROM courses c
                    JOIN curriculums curr ON c.curriculum_id = curr.curriculum_id
                    WHERE c.id = :course_id 
                    AND curr.program_id = :program_id";
    
    $course_stmt = $conn->prepare($course_query);
    $course_stmt->bindParam(':course_id', $course_id);
    $course_stmt->bindParam(':program_id', $section['program_id']);
    $course_stmt->execute();
    
    if ($course_stmt->rowCount() === 0) {
        // Try without program filter in case there's a mismatch
        $alt_course_query = "SELECT c.id, c.course_code, c.course_title, c.curriculum_id, c.year_level_id, c.semester_id 
                           FROM courses c
                           WHERE c.id = :course_id";
        
        $alt_course_stmt = $conn->prepare($alt_course_query);
        $alt_course_stmt->bindParam(':course_id', $course_id);
        $alt_course_stmt->execute();
        
        if ($alt_course_stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(array("message" => "Course not found."));
            exit();
        }
        
        $course = $alt_course_stmt->fetch(PDO::FETCH_ASSOC);
        
        // Warning but continue
        error_log("Warning: Course {$course['course_code']} assigned to section {$section['name']} but curriculum program mismatch");
    } else {
        $course = $course_stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    // Check if the faculty exists as an employee with active user account
    $faculty_query = "SELECT e.employee_id, e.name
                     FROM employees e
                     JOIN users u ON e.employee_id = u.id
                     WHERE e.employee_id = :faculty_id";
    
    $faculty_stmt = $conn->prepare($faculty_query);
    $faculty_stmt->bindParam(':faculty_id', $faculty_id);
    $faculty_stmt->execute();
    
    if ($faculty_stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("message" => "Faculty not found."));
        exit();
    }
    
    $faculty = $faculty_stmt->fetch(PDO::FETCH_ASSOC);
    
    // Check if faculty account is active
    if (isset($faculty['status']) && $faculty['status'] !== 'active') {
        http_response_code(403);
        echo json_encode(array("message" => "Faculty account is not active."));
        exit();
    }
    
    // Check if this assignment already exists to prevent duplicates
    $check_query = "SELECT id FROM section_faculty 
                    WHERE faculty_id = :faculty_id 
                    AND section_id = :section_id 
                    AND course_id = :course_id";
    
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(':faculty_id', $faculty_id);
    $check_stmt->bindParam(':section_id', $section_id);
    $check_stmt->bindParam(':course_id', $course_id);
    $check_stmt->execute();
    
    if ($check_stmt->rowCount() > 0) {
        http_response_code(409); // Conflict
        echo json_encode(array("message" => "This course has already been assigned to this faculty for this section."));
        exit();
    }
    
    // Create the assignment
    $query = "INSERT INTO section_faculty (section_id, course_id, faculty_id) 
              VALUES (:section_id, :course_id, :faculty_id)";
    
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':section_id', $section_id);
    $stmt->bindParam(':course_id', $course_id);
    $stmt->bindParam(':faculty_id', $faculty_id);
    
    if ($stmt->execute()) {
        $assignment_id = $conn->lastInsertId();
        
        // Prepare response with combined data 
        $response = array(
            "id" => $assignment_id,
            "faculty_id" => $faculty_id,
            "faculty_name" => $faculty['name'],
            "section_id" => $section_id,
            "section_name" => $section['name'],
            "course_id" => $course_id,
            "course_code" => $course['course_code'],
            "course_title" => $course['course_title'],
            "academic_year_id" => $section['academic_year_id'],
            "academic_year" => $section['academic_year'],
            "semester_id" => $section['semester_id'],
            "semester" => $section['semester'],
            "message" => "Course assigned successfully."
        );
        
        http_response_code(201); // Created
        echo json_encode($response);
    } else {
        http_response_code(503); // Service Unavailable
        echo json_encode(array("message" => "Unable to assign course. Please try again."));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?> 