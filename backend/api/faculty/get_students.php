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
    if (isset($_SESSION['user_roles'])) {
        if (!in_array('faculty', $_SESSION['user_roles'])) {
            http_response_code(403);
            echo json_encode(array("success" => false, "message" => "Forbidden: User is not a faculty member"));
            exit();
        }
    } else {
        http_response_code(403);
        echo json_encode(array("success" => false, "message" => "Forbidden: User roles not found in session"));
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
    $courseQuery = "SELECT c.course_code, c.course_title, s.name, s.status as section_status
                    FROM courses c
                    JOIN sections s ON s.id = :section_id
                    WHERE c.id = :course_id";

    $courseStmt = $conn->prepare($courseQuery);
    $courseStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
    $courseStmt->bindParam(':section_id', $sectionId, PDO::PARAM_INT);
    $courseStmt->execute();

    $courseInfo = $courseStmt->fetch(PDO::FETCH_ASSOC);

    // Fetch the curriculum_id for the given course_id
    $courseCurriculumQuery = "SELECT curriculum_id FROM courses WHERE id = :course_id";
    $courseCurriculumStmt = $conn->prepare($courseCurriculumQuery);
    $courseCurriculumStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
    $courseCurriculumStmt->execute();
    $courseCurriculumResult = $courseCurriculumStmt->fetch(PDO::FETCH_ASSOC);
    $courseCurriculumId = $courseCurriculumResult ? $courseCurriculumResult['curriculum_id'] : null;

    if ($courseCurriculumId === null) {
        // If the course doesn't have a curriculum_id, it's an invalid state or unassigned, return no students.
        http_response_code(200);
        echo json_encode(array("success" => true, "count" => 0, "course_info" => $courseInfo, "data" => [], "message" => "Course has no assigned curriculum."));
        exit();
    }

    // Modified query: Use student_section_enrollments to find students who were/are enrolled in this section
    // This allows us to see students even after they've moved to a different section
    $query = "SELECT 
                  s.id, 
                  s.student_id, 
                  s.name, 
                  COALESCE(current_sec.name, enrolled_sec.name) as section,
                  c.course_code, 
                  c.course_title,
                  COALESCE(g.transmutation, '') as transmutation,
                  COALESCE(g.remarks, '') as remarks,
                  COALESCE(g.is_credited, 0) as is_credited,
                  sse.enrollment_status,
                  sse.completed_at
              FROM students s
              JOIN student_section_enrollments sse ON s.id = sse.student_id
              JOIN sections enrolled_sec ON sse.section_id = enrolled_sec.id
              LEFT JOIN sections current_sec ON s.section_id = current_sec.id
              JOIN courses c ON c.id = :course_id
              LEFT JOIN course_grades g ON g.id = (
                                            SELECT MAX(id) FROM course_grades 
                                            WHERE student_id = s.student_id 
                                            AND course_id = :course_id
                                          )
              WHERE sse.section_id = :section_id
                AND COALESCE(g.is_credited, 0) = 0
    ";

    // Add a UNION ALL to include irregular students enrolled in this course for retake
    $query .= "
        UNION ALL
        SELECT 
            s.id, 
            s.student_id, 
            s.name, 
            COALESCE(sec.name, 'N/A') as section,
            c.course_code, 
            c.course_title,
            COALESCE(g.transmutation, '') as transmutation,
            COALESCE(g.remarks, '') as remarks,
            0 as is_credited,
            'enrolled' as enrollment_status,
            null as completed_at
        FROM 
            students s
        JOIN 
            irregular_course_enrollments ice ON s.id = ice.student_id
        LEFT JOIN 
            sections sec ON s.section_id = sec.id
        JOIN 
            courses c ON ice.course_id = c.id
        LEFT JOIN 
            course_grades g ON g.student_id = s.student_id
                           AND g.course_id = ice.course_id
        WHERE 
            ice.section_id = :section_id 
            AND ice.course_id = :course_id
            AND ice.enrollment_type = 'Retake'
    ";

    // Add the global ORDER BY clause for the entire UNION ALL query
    $query .= " ORDER BY enrollment_status ASC, name ASC";

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