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

// Get required section_id
$sectionId = isset($_GET['section_id']) ? intval($_GET['section_id']) : null;

if (!$sectionId) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Missing required parameter: section_id"));
    exit();
}

try {
    // First, get the curriculum_id associated with the given section_id
    $curriculumQuery = "SELECT c.curriculum_id, s.year_level_id, s.semester_id
                        FROM sections s
                        JOIN programs p ON s.program_id = p.id
                        JOIN curriculums c ON p.id = c.program_id
                        WHERE s.id = :section_id LIMIT 1";
    $curriculumStmt = $conn->prepare($curriculumQuery);
    $curriculumStmt->bindParam(':section_id', $sectionId, PDO::PARAM_INT);
    $curriculumStmt->execute();
    $curriculumResult = $curriculumStmt->fetch(PDO::FETCH_ASSOC);

    if (!$curriculumResult || $curriculumResult['curriculum_id'] === null) {
        http_response_code(200);
        echo json_encode(array("success" => true, "count" => 0, "data" => [], "message" => "Section or its program has no assigned curriculum."));
        exit();
    }

    $sectionCurriculumId = $curriculumResult['curriculum_id'];
    $sectionYearLevelId = $curriculumResult['year_level_id'];
    $sectionSemesterId = $curriculumResult['semester_id'];

    // Now, fetch all courses belonging to this curriculum and year level/semester
    $query = "
        SELECT 
            c.id AS course_id,
            c.course_code,
            c.course_title
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

    $stmt->bindParam(':curriculum_id', $sectionCurriculumId, PDO::PARAM_INT);
    $stmt->bindParam(':year_level_id', $sectionYearLevelId, PDO::PARAM_INT);
    $stmt->bindParam(':semester_id', $sectionSemesterId, PDO::PARAM_INT);
    $stmt->execute();
    $courses = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "count" => count($courses),
        "data" => $courses
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
