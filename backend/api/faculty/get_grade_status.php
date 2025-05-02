<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// Include database connection
require_once '../../config/database.php';

// Check if required parameters are provided
if (!isset($_GET['course_id']) || !isset($_GET['section_id'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Required parameters are missing (course_id, section_id)'
    ]);
    exit;
}

$course_id = $_GET['course_id'];
$section_id = $_GET['section_id'];
$faculty_id = isset($_GET['faculty_id']) ? $_GET['faculty_id'] : null;

try {
    $db = new Database();
    $conn = $db->getConnection();

    // Check if grades exist and their submission status
    $query = "SELECT submitted, submission_date FROM grades_submission 
              WHERE course_id = :course_id AND section_id = :section_id";
    
    // Add faculty_id condition if provided
    if ($faculty_id) {
        $query .= " AND faculty_id = :faculty_id";
    }
    
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':course_id', $course_id);
    $stmt->bindParam(':section_id', $section_id);
    
    if ($faculty_id) {
        $stmt->bindParam(':faculty_id', $faculty_id);
    }
    
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $status = [
            'exists' => true,
            'submitted' => (bool)$result['submitted'],
            'submission_date' => $result['submission_date']
        ];
        
        echo json_encode([
            'success' => true,
            'status' => $status
        ]);
    } else {
        // No grades submission record found
        echo json_encode([
            'success' => true,
            'status' => [
                'exists' => false,
                'submitted' => false,
                'submission_date' => null
            ]
        ]);
    }
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
} 