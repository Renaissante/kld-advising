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
    error_log("Database connection failed in read_courses_by_section_curriculum.php.");
    echo json_encode(array("success" => false, "message" => "Database connection failed."));
    exit();
}

// Get required section_id and student_id
$sectionId = isset($_GET['section_id']) ? intval($_GET['section_id']) : null;
$studentId = isset($_GET['student_id']) ? intval($_GET['student_id']) : null;

// Get admin ID from query parameter (for testing) or session
$adminId = isset($_GET['admin_id']) ? $_GET['admin_id'] : null;

if (!$adminId && isset($_SESSION['user_id'])) {
    $adminId = $_SESSION['user_id'];
    // Ensure the logged-in user is an admin
    if (isset($_SESSION['user_roles']) && !in_array('admin', $_SESSION['user_roles'])) {
        http_response_code(403);
        echo json_encode(array("success" => false, "message" => "Forbidden: User is not an admin"));
        exit();
    }
} else if (!$adminId) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Unauthorized: You must be logged in as an admin"));
    exit();
}

if (!$sectionId || !$studentId) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Missing required parameters: section_id and student_id"));
    exit();
}

try {
    // First, get the section's year_level_id and semester_id
    $sectionQuery = "SELECT s.year_level_id, s.semester_id, s.academic_year_id
                     FROM sections s
                     WHERE s.id = :section_id LIMIT 1";
    $sectionStmt = $conn->prepare($sectionQuery);
    $sectionStmt->bindParam(':section_id', $sectionId, PDO::PARAM_INT);
    $sectionStmt->execute();
    $sectionResult = $sectionStmt->fetch(PDO::FETCH_ASSOC);

    if (!$sectionResult) {
        http_response_code(404);
        echo json_encode(array("success" => false, "message" => "Section not found."));
        exit();
    }

    $sectionYearLevelId = $sectionResult['year_level_id'];
    $sectionSemesterId = $sectionResult['semester_id'];
    $sectionAcademicYearId = $sectionResult['academic_year_id'];

    // Find the most common curriculum_id among students in this section
    $curriculumQuery = "SELECT st.curriculum_id, COUNT(*) as student_count
                        FROM students st
                        WHERE st.section_id = :section_id
                        AND st.curriculum_id IS NOT NULL
                        GROUP BY st.curriculum_id
                        ORDER BY student_count DESC
                        LIMIT 1";
    $curriculumStmt = $conn->prepare($curriculumQuery);
    $curriculumStmt->bindParam(':section_id', $sectionId, PDO::PARAM_INT);
    $curriculumStmt->execute();
    $curriculumResult = $curriculumStmt->fetch(PDO::FETCH_ASSOC);

    if (!$curriculumResult || $curriculumResult['curriculum_id'] === null) {
        http_response_code(200);
        echo json_encode(array(
            "success" => true, 
            "count" => 0, 
            "data" => [], 
            "message" => "No students with assigned curriculum found in this section."
        ));
        exit();
    }

    $majorCurriculumId = $curriculumResult['curriculum_id'];

    // Now, fetch courses belonging to this curriculum that match the section's year level and semester
    $query = "
        SELECT 
            c.id AS course_id,
            c.course_code,
            c.course_title,
            c.year_level_id,
            c.semester_id,
            c.unit_lec,
            c.unit_lab,
            c.hour_lec,
            c.hour_lab
        FROM 
            courses c
        WHERE 
            c.curriculum_id = :curriculum_id
            AND c.year_level_id = :year_level_id
            AND c.semester_id = :semester_id
        ORDER BY
            c.course_code;
    ";

    $stmt = $conn->prepare($query);
    if ($stmt === false) {
        throw new PDOException("Failed to prepare query: " . implode(" - ", $conn->errorInfo()));
    }

    $stmt->bindParam(':curriculum_id', $majorCurriculumId, PDO::PARAM_INT);
    $stmt->bindParam(':year_level_id', $sectionYearLevelId, PDO::PARAM_INT);
    $stmt->bindParam(':semester_id', $sectionSemesterId, PDO::PARAM_INT);
    
    $stmt->execute();
    $courses = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "count" => count($courses),
        "data" => $courses,
        "section_info" => array(
            "curriculum_id" => $majorCurriculumId,
            "year_level_id" => $sectionYearLevelId,
            "semester_id" => $sectionSemesterId,
            "academic_year_id" => $sectionAcademicYearId,
            "student_count" => $curriculumResult['student_count']
        )
    ));

} catch (PDOException $e) {
    http_response_code(503);
    error_log("Database error in read_courses_by_section_curriculum.php: " . $e->getMessage());
    echo json_encode(array("success" => false, "message" => "Database error: " . $e->getMessage()));
} catch (Exception $e) {
    http_response_code(500);
    error_log("General error in read_courses_by_section_curriculum.php: " . $e->getMessage());
    echo json_encode(array("success" => false, "message" => "Server error: " . $e->getMessage()));
}

?>