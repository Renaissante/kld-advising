<?php
// Include CORS headers
include_once '../../config/cors.php';

// Set headers for content type
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS request (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    exit(0);
}

// Start session to check for logged in user
session_start();

// Include database configuration
include_once '../../config/database.php';

// Check connection
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in save_grades.php.");
    echo json_encode(array("success" => false, "message" => "Database connection failed."));
    exit();
}

// Get faculty ID - check query parameter first (for testing), then session
$facultyId = isset($_GET['faculty_id']) ? $_GET['faculty_id'] : null;

// If no query parameter, check session
if (!$facultyId && isset($_SESSION['user_id'])) {
    $facultyId = $_SESSION['user_id'];
    
    // Also verify role if available
    if (isset($_SESSION['role']) && $_SESSION['role'] !== 'faculty') {
        http_response_code(403);
        echo json_encode(array("success" => false, "message" => "Forbidden: User is not a faculty member"));
        exit();
    }
}

// Validate required parameters
if (!$facultyId) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Unauthorized: You must be logged in as faculty"));
    exit();
}

// Get request body
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "No data provided"));
    exit();
}

// Extract required information
$courseId = isset($data['course_id']) ? intval($data['course_id']) : null;
$sectionId = isset($data['section_id']) ? intval($data['section_id']) : null;
$academicYearId = isset($data['academic_year_id']) ? intval($data['academic_year_id']) : null;
$semesterId = isset($data['semester_id']) ? intval($data['semester_id']) : null;
$action = isset($data['action']) ? $data['action'] : 'save'; // 'save' or 'submit'
$students = isset($data['students']) ? $data['students'] : [];

// Validate required data
if (!$courseId || !$sectionId || !$academicYearId || !$semesterId || empty($students)) {
    http_response_code(400);
    echo json_encode(array(
        "success" => false, 
        "message" => "Missing required data: course_id, section_id, academic_year_id, semester_id, or students"
    ));
    exit();
}

// Function to calculate transmutation
function calculateTransmutation($average) {
    if (!$average || $average === "") return null;
    
    $numAverage = floatval($average);
    
    if (is_nan($numAverage)) return null;
    
    if ($numAverage >= 97) return "1.00";
    if ($numAverage >= 94) return "1.25";
    if ($numAverage >= 91) return "1.50";
    if ($numAverage >= 88) return "1.75";
    if ($numAverage >= 85) return "2.00";
    if ($numAverage >= 82) return "2.25";
    if ($numAverage >= 79) return "2.50";
    if ($numAverage >= 76) return "2.75";
    if ($numAverage >= 70) return "3.00";
    if ($numAverage >= 65) return "5.00";
    return "5.00"; // Failing grade
  }

// Function to get remarks based on transmutation
function getDefaultRemarks($transmutation) {
    if ($transmutation === "") return null;
    if ($transmutation === "5.00") return "Failed";
    return "Passed";
}

// Determine status based on action
$status = ($action === 'submit') ? 'submitted' : 'draft';

try {
    // First, verify this faculty is assigned to the given course and section
    $verifyQuery = "SELECT COUNT(*) as count 
                   FROM section_faculty 
                   WHERE faculty_id = :faculty_id 
                   AND course_id = :course_id 
                   AND section_id = :section_id";
    
    $verifyStmt = $conn->prepare($verifyQuery);
    $verifyStmt->bindParam(':faculty_id', $facultyId);
    $verifyStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
    $verifyStmt->bindParam(':section_id', $sectionId, PDO::PARAM_INT);
    $verifyStmt->execute();
    
    $result = $verifyStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($result['count'] == 0) {
        http_response_code(403);
        echo json_encode(array(
            "success" => false, 
            "message" => "Faculty not assigned to this course and section"
        ));
        exit();
    }
    
    // Begin transaction
    $conn->beginTransaction();
    
    // Loop through students and save/update grades
    $successCount = 0;
    $totalCount = count($students);
    $errors = [];
    
    foreach ($students as $student) {
        // Extract student data
        $studentId = isset($student['student_id']) ? $student['student_id'] : null;
        $midterm = isset($student['midterm']) && $student['midterm'] !== "" ? intval($student['midterm']) : null;
        $final = isset($student['final']) && $student['final'] !== "" ? intval($student['final']) : null;
        $average = isset($student['average']) && $student['average'] !== "" ? floatval($student['average']) : null;
        $transmutation = calculateTransmutation($average); // Calculate transmutation
        $remarks = getDefaultRemarks($transmutation); // Calculate remarks
        
        // For submission, validate all required fields
        if ($action === 'submit') {
            if ($midterm === null || $final === null || $average === null || empty($remarks)) {
                $errors[] = "Missing grades or remarks for student ID: $studentId";
                continue;
            }
        }
        
        // Check if an entry already exists
        $checkQuery = "SELECT id FROM course_grades 
                       WHERE student_id = :student_id 
                       AND course_id = :course_id";
        
        $checkStmt = $conn->prepare($checkQuery);
        $checkStmt->bindParam(':student_id', $studentId);
        $checkStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
        $checkStmt->execute();
        
        if ($checkStmt->rowCount() > 0) {
            // Update existing entry
            $updateQuery = "UPDATE course_grades 
                           SET midterm = :midterm,
                               final = :final,
                               average = :average,
                               transmutation = :transmutation,
                               remarks = :remarks,
                               updated_at = NOW()
                           WHERE student_id = :student_id 
                           AND course_id = :course_id";
            
            $updateStmt = $conn->prepare($updateQuery);
            $updateStmt->bindParam(':midterm', $midterm);
            $updateStmt->bindParam(':final', $final);
            $updateStmt->bindParam(':average', $average);
            $updateStmt->bindParam(':transmutation', $transmutation);
            $updateStmt->bindParam(':remarks', $remarks);
            $updateStmt->bindParam(':student_id', $studentId);
            $updateStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
            
            if ($updateStmt->execute()) {
                $successCount++;
            } else {
                $errors[] = "Failed to update grades for student ID: $studentId";
            }
        } else {
            // Insert new entry
            $insertQuery = "INSERT INTO course_grades (
                              student_id, course_id, midterm, final, average, transmutation, remarks
                           ) VALUES (
                              :student_id, :course_id, :midterm, :final, :average, :transmutation, :remarks
                           )";
            
            $insertStmt = $conn->prepare($insertQuery);
            $insertStmt->bindParam(':student_id', $studentId);
            $insertStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
            $insertStmt->bindParam(':midterm', $midterm);
            $insertStmt->bindParam(':final', $final);
            $insertStmt->bindParam(':average', $average);
            $insertStmt->bindParam(':transmutation', $transmutation);
            $insertStmt->bindParam(':remarks', $remarks);
            
            if ($insertStmt->execute()) {
                $successCount++;
            } else {
                $errors[] = "Failed to save grades for student ID: $studentId";
            }
        }
    }
    
    // Commit or rollback transaction based on success
    if ($successCount === $totalCount) {
        $conn->commit();
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => ($action === 'submit') ? "Grades submitted successfully" : "Grades saved successfully",
            "count" => $successCount
        ));
    } else {
        $conn->rollBack();
        http_response_code(500);
        echo json_encode(array(
            "success" => false,
            "message" => "Failed to " . ($action === 'submit' ? "submit" : "save") . " all grades",
            "count" => $successCount,
            "total" => $totalCount,
            "errors" => $errors
        ));
    }
    
} catch (PDOException $e) {
    // Roll back the transaction if something failed
    if ($conn) {
        $conn->rollBack();
    }
    
    http_response_code(503);
    error_log("Database error in save_grades.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false, 
        "message" => "Database error: " . $e->getMessage()
    ));
} catch (Exception $e) {
    // Roll back the transaction if something failed
    if ($conn) {
        $conn->rollBack();
    }
    
    http_response_code(500);
    error_log("General error in save_grades.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false, 
        "message" => "Server error: " . $e->getMessage()
    ));
}
?> 