<?php
// Include CORS headers
include_once '../../config/cors.php';

// Set headers for content type
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS request (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header("Access-Control-Allow-Methods: GET, OPTIONS");
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
    error_log("Database connection failed in get_students.php.");
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

// Get required parameters
$courseId = isset($_GET['course_id']) ? intval($_GET['course_id']) : null;
$sectionId = isset($_GET['section_id']) ? intval($_GET['section_id']) : null;

// Validate required parameters
if (!$facultyId) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Unauthorized: You must be logged in as faculty"));
    exit();
}

if (!$courseId || !$sectionId) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Missing required parameters: course_id and section_id"));
    exit();
}

// First, verify this faculty is assigned to the given course and section
try {
    $verifyQuery = "SELECT COUNT(*) as count
                    FROM section_faculty
                    WHERE faculty_id = :faculty_id
                    AND course_id = :course_id
                    AND section_id = :section_id";

    $verifyStmt = $conn->prepare($verifyQuery);
    if ($verifyStmt === false) {
        throw new PDOException("Failed to prepare verification query: " . implode(" - ", $conn->errorInfo()));
    }

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

    // Get course details for reference
    $courseQuery = "SELECT c.course_code, c.course_title, s.name
                    FROM courses c
                    JOIN sections s ON s.id = :section_id
                    WHERE c.id = :course_id";

    $courseStmt = $conn->prepare($courseQuery);
    $courseStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
    $courseStmt->bindParam(':section_id', $sectionId, PDO::PARAM_INT);
    $courseStmt->execute();

    $courseInfo = $courseStmt->fetch(PDO::FETCH_ASSOC);

    // Now fetch students enrolled in this section
    $query = "SELECT s.id, s.student_id, s.name, sec.name as section,
                     c.course_code, c.course_title,
                     COALESCE(g.midterm, '') as midterm,
                     COALESCE(g.final, '') as final,
                     COALESCE(g.midterm_status, '') as midterm_status,
                     COALESCE(g.final_status, '') as final_status,
                     COALESCE(g.average, '') as average,
                     COALESCE(g.transmutation, '') as transmutation,
                     COALESCE(g.remarks, '') as remarks
              FROM students s
              JOIN sections sec ON s.section_id = sec.id
              JOIN courses c ON c.id = :course_id
              LEFT JOIN course_grades g ON g.student_id = s.student_id
                               AND g.course_id = :course_id
              WHERE s.section_id = :section_id
              ORDER BY s.name";

    $stmt = $conn->prepare($query);
    if ($stmt === false) {
        throw new PDOException("Failed to prepare query: " . implode(" - ", $conn->errorInfo()));
    }

    $stmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
    $stmt->bindParam(':section_id', $sectionId, PDO::PARAM_INT);
    $stmt->execute();

    $students = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Return success response with data
    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "count" => count($students),
        "course_info" => $courseInfo,
        "data" => $students
    ));

} catch (PDOException $e) {
    http_response_code(503);
    error_log("Database error in get_students.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ));
} catch (Exception $e) {
    http_response_code(500);
    error_log("General error in get_students.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ));
}
?>