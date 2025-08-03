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
    $sql = "INSERT INTO users (id, email, password_hash, role, created_at) 
            VALUES (:id, :email, :password_hash, :role, NOW())";
    $stmt = $conn->prepare($sql);

    $defaultPassword = password_hash('123456', PASSWORD_BCRYPT);
    $userId = $data->studentId;

    $stmt->bindParam(':id', $userId);
    $stmt->bindParam(':email', $data->email);
    $stmt->bindParam(':password_hash', $defaultPassword);
    $stmt->bindParam(':role', $data->role);
    $stmt->execute();

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

    // 8. Retrieve courses associated with the curriculum directly from the courses table
    $sqlCourses = "SELECT id FROM courses WHERE curriculum_id = :curriculum_id";
    $stmtCourses = $conn->prepare($sqlCourses);
    $stmtCourses->bindParam(':curriculum_id', $curriculumId);
    $stmtCourses->execute();
    $courses = $stmtCourses->fetchAll(PDO::FETCH_ASSOC);

    // 9. Pre-populate course_grades table for the student
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
