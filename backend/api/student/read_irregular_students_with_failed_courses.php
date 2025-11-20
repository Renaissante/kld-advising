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
    error_log("Database connection failed in read_irregular_students_with_failed_courses.php.");
    echo json_encode(array("success" => false, "message" => "Database connection failed."));
    exit();
}

// Get admin ID from session or query parameter (for testing)
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

// Get active academic year and semester from query parameters (for context)
$academicYearId = isset($_GET['academic_year_id']) ? intval($_GET['academic_year_id']) : null;
$semesterId = isset($_GET['semester_id']) ? intval($_GET['semester_id']) : null;

if (!$academicYearId || !$semesterId) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Missing required parameters: academic_year_id and semester_id"));
    exit();
}

try {
    // Admin can see students from all programs, no need to filter by program chair assigned programs
    $programQuery = "SELECT id FROM programs"; // Fetch all program IDs
    $programStmt = $conn->prepare($programQuery);
    $programStmt->execute();
    $allPrograms = $programStmt->fetchAll(PDO::FETCH_COLUMN);

    if (empty($allPrograms)) {
        http_response_code(200);
        echo json_encode(array("success" => true, "count" => 0, "data" => [], "message" => "No programs found in the system."));
        exit();
    }

    $programIdsString = implode(',', $allPrograms);

    // Query to fetch irregular students with failed courses, not currently retaking that course
    $query = "
    SELECT 
        s.id AS student_db_id,
        s.student_id,
        s.name AS student_name,
        u.email, -- Changed from s.email to u.email
        yl.level AS year_level, -- Reverted to yl.level
        COALESCE(home_sec.name, 'N/A') AS home_section_name,
        c.id AS failed_course_id,
        c.course_code AS failed_course_code,
        c.course_title AS failed_course_title
    FROM 
        students s
    JOIN 
        course_grades cg ON s.student_id = cg.student_id
    JOIN 
        courses c ON cg.course_id = c.id
    JOIN
        users u ON s.student_id = u.id -- Added join with users table
    JOIN
        year_levels yl ON s.year_level_id = yl.id
    LEFT JOIN
        sections home_sec ON s.section_id = home_sec.id
    WHERE 
        cg.remarks = 'Failed'
        AND s.program_id IN ($programIdsString) -- Now filters by ALL programs
        AND NOT EXISTS (
            SELECT 1
            FROM irregular_course_enrollments ice
            JOIN courses ice_c ON ice.course_id = ice_c.id -- Join to get course code of retake
            WHERE ice.student_id = s.id
              AND ice_c.course_code = c.course_code -- Compare by course_code
              AND ice.enrollment_type = 'Retake'
        )
    ORDER BY 
        s.name, c.course_code;
    ";

    $stmt = $conn->prepare($query);
    if ($stmt === false) {
        throw new PDOException("Failed to prepare query: " . implode(" - ", $conn->errorInfo()));
    }

    // No longer binding program_chair_id
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $irregularStudents = [];
    foreach ($results as $row) {
        $studentDbId = $row['student_db_id'];
        if (!isset($irregularStudents[$studentDbId])) {
            $irregularStudents[$studentDbId] = [
                'id' => $studentDbId,
                'student_id' => $row['student_id'],
                'name' => $row['student_name'],
                'email' => $row['email'],
                'year_level' => $row['year_level'],
                'home_section_name' => $row['home_section_name'],
                'failed_courses' => []
            ];
        }
        $irregularStudents[$studentDbId]['failed_courses'][] = [
            'course_id' => $row['failed_course_id'],
            'course_code' => $row['failed_course_code'],
            'course_title' => $row['failed_course_title']
        ];
    }

    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "count" => count($irregularStudents),
        "data" => array_values($irregularStudents)
    ));

} catch (PDOException $e) {
    http_response_code(503);
    error_log("Database error in read_irregular_students_with_failed_courses.php: " . $e->getMessage());
    echo json_encode(array("success" => false, "message" => "Database error: " . $e->getMessage()));
} catch (Exception $e) {
    http_response_code(500);
    error_log("General error in read_irregular_students_with_failed_courses.php: " . $e->getMessage());
    echo json_encode(array("success" => false, "message" => "Server error: " . $e->getMessage()));
}

?>
