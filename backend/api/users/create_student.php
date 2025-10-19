<?php

header("Content-Type: application/json");
// header("Access-Control-Allow-Origin: *");
// header("Access-Control-Allow-Methods: POST, OPTIONS");
// header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
//     http_response_code(204);
//     exit;
// }
include_once '../../config/cors.php';
require_once "../../config/database.php";

error_reporting(E_ALL);
ini_set('display_errors', 1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method Not Allowed"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (
    empty($data->firstName) || 
    empty($data->lastName) || 
    empty($data->email) || 
    empty($data->department) || 
    empty($data->role) ||
    empty($data->studentId) ||
    // empty($data->dob) ||
    empty($data->yearLevel) ||
    empty($data->section) ||
    empty($data->program) ||
    empty($data->entryYear)
) {
    http_response_code(400);
    echo json_encode(["message" => "All required fields must be filled, including entry year."]);
    exit;
}

try {
    $fullName = trim($data->firstName . ' ' . ($data->middleName ? $data->middleName . ' ' : '') . $data->lastName);

    $conn->beginTransaction();

    // 1. Insert user data
    $sql = "INSERT INTO users (id, email, password_hash, created_at) 
            VALUES (:id, :email, :password_hash, NOW())";
    $stmt = $conn->prepare($sql);

    $defaultPassword = '123456'; // Default password for new users - FOR TESTING ONLY! DO NOT USE IN PRODUCTION!
    $userId = $data->studentId;

    $stmt->bindParam(':id', $userId);
    $stmt->bindParam(':email', $data->email);
    $stmt->bindParam(':password_hash', $defaultPassword);
    // $stmt->bindParam(':role', $data->role); // Removed as role is now in user_roles
    $stmt->execute();

    // Get the role_id for 'student'
    $sqlGetRoleId = "SELECT id FROM roles WHERE role_name = :role_name";
    $stmtGetRoleId = $conn->prepare($sqlGetRoleId);
    $roleName = 'student'; // Assuming the role for this file is always 'student'
    $stmtGetRoleId->bindParam(':role_name', $roleName);
    $stmtGetRoleId->execute();
    $roleRow = $stmtGetRoleId->fetch(PDO::FETCH_ASSOC);

    if (!$roleRow) {
        throw new Exception("Role 'student' not found in roles table.");
    }
    $roleId = $roleRow['id'];

    // Insert into user_roles table
    $sqlUserRole = "INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)";
    $stmtUserRole = $conn->prepare($sqlUserRole);
    $stmtUserRole->bindParam(':user_id', $userId);
    $stmtUserRole->bindParam(':role_id', $roleId);
    $stmtUserRole->execute();

    // 2. Retrieve department ID
    $sql = "SELECT id FROM departments WHERE name = :department";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':department', $data->department);
    $stmt->execute();
    $departmentRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$departmentRow) {
        throw new Exception("Invalid department selected.");
    }
    $departmentId = $departmentRow['id'];

    // 3. Retrieve program ID
    $sql = "SELECT id FROM programs WHERE name = :program";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':program', $data->program);
    $stmt->execute();
    $programRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$programRow) {
        throw new Exception("Invalid program selected.");
    }
    $programId = $programRow['id'];

    // 4. Retrieve year level ID
    $sql = "SELECT id FROM year_levels WHERE level = :yearLevel";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':yearLevel', $data->yearLevel);
    $stmt->execute();
    $yearLevelRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$yearLevelRow) {
        throw new Exception("Invalid year level selected.");
    }
    $yearLevelId = $yearLevelRow['id'];

    // 5. Retrieve section ID
    $sql = "SELECT id FROM sections WHERE name = :section AND program_id = :programId AND year_level_id = :yearLevelId";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':section', $data->section);
    $stmt->bindParam(':programId', $programId);
    $stmt->bindParam(':yearLevelId', $yearLevelId);
    $stmt->execute();
    $sectionRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$sectionRow) {
        throw new Exception("Invalid section selected.");
    }
    $sectionId = $sectionRow['id'];

    // 6. Retrieve curriculum ID based on entry year
    $sql = "SELECT curriculum_id FROM curriculums WHERE academic_year_id = :entry_year_id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':entry_year_id', $data->entryYear);
    $stmt->execute();
    $curriculumRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$curriculumRow) {
        throw new Exception("No curriculum found for the selected entry year.");
    }
    $curriculumId = $curriculumRow['curriculum_id'];

    // 7. Insert student data, including entry_year_id and curriculum_id
    $sql = "INSERT INTO students (student_id, name, department_id, year_level_id, section_id, program_id, entry_year_id, curriculum_id, created_at) 
            VALUES (:student_id, :name, :department_id, :year_level_id, :section_id, :program_id, :entry_year_id, :curriculum_id, NOW())";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':student_id', $userId);
    $stmt->bindParam(':name', $fullName);
    $stmt->bindParam(':department_id', $departmentId);
    $stmt->bindParam(':year_level_id', $yearLevelId);
    $stmt->bindParam(':section_id', $sectionId);
    $stmt->bindParam(':program_id', $programId);
    $stmt->bindParam(':entry_year_id', $data->entryYear);
    $stmt->bindParam(':curriculum_id', $curriculumId);
    $stmt->execute();

    // Get the auto-incremented ID of the newly created student
    $newlyCreatedStudentInternalId = $conn->lastInsertId();

    // 8. Insert into student_section_enrollments table
    $sqlEnrollment = "INSERT INTO student_section_enrollments (student_id, section_id) VALUES (:student_id, :section_id)";
    $stmtEnrollment = $conn->prepare($sqlEnrollment);
    $stmtEnrollment->bindParam(':student_id', $newlyCreatedStudentInternalId); // Use the internal integer ID
    $stmtEnrollment->bindParam(':section_id', $sectionId);
    $stmtEnrollment->execute();

    // 9. Retrieve courses associated with the curriculum directly from the courses table
    $sqlCourses = "SELECT id FROM courses WHERE curriculum_id = :curriculum_id";
    $stmtCourses = $conn->prepare($sqlCourses);
    $stmtCourses->bindParam(':curriculum_id', $curriculumId);
    $stmtCourses->execute();
    $courses = $stmtCourses->fetchAll(PDO::FETCH_ASSOC);

    // 10. Pre-populate course_grades table for the student
    if (!empty($courses)) {
        $sqlGradeInsert = "INSERT INTO course_grades (student_id, course_id) VALUES (:student_id, :course_id)";
        $stmtGradeInsert = $conn->prepare($sqlGradeInsert);
        
        foreach ($courses as $course) {
            $stmtGradeInsert->bindParam(':student_id', $userId);
            $stmtGradeInsert->bindParam(':course_id', $course['id']);
            $stmtGradeInsert->execute();
        }
    }

    $conn->commit();

    require dirname(__DIR__, 3) . '/vendor/autoload.php';

    try {
        // Connect to the websocket server running on localhost:8080
        $client = new WebSocket\Client("ws://localhost:8080");

        // Prepare the message to send (JSON format is good practice)
        $message = json_encode([
            'type' => 'backend_event', // Generic type for backend events
            'payload' => [
                'event' => 'user_created', // Specific event type within payload
                'role' => 'student', // Role of the created user
                'userId' => $userId, // Optionally include relevant data
                'message' => 'A new student account has been created.' // Optional message
            ]
        ]);

        // Send the message
        $client->send($message);

        // Close the connection
        $client->close();

        // Optional: Log success
        // error_log("WebSocket message sent: " . $message);

    } catch (Exception $e) {
        // Log the error, but don't stop the API from returning success
        error_log("WebSocket error sending message: " . $e->getMessage());
    }

    http_response_code(201);
    echo json_encode(["message" => "Student account created successfully"]);
} catch (Exception $e) {
    $conn->rollBack();
    http_response_code(500);
    echo json_encode(["error" => "Database error: " . $e->getMessage()]);
}
?>
