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

// Include database configuration (provides $conn)
include_once '../../config/database.php';

// Start session
// session_start();

// // Check if user is logged in and is an admin
// if (!isset($_SESSION['user_id']) || !in_array('admin', $_SESSION['user_roles'])) {
//     http_response_code(403);
//     echo json_encode(array("message" => "Forbidden: You do not have permission to view faculty assignments."));
//     exit();
// }

// Check connection
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in read_single_faculty_assignment.php.");
    echo json_encode(array("message" => "Database connection failed."));
    exit();
}

// Get faculty_id from query parameter
$faculty_id = isset($_GET['faculty_id']) ? $_GET['faculty_id'] : null;

if (!$faculty_id) {
    http_response_code(400);
    echo json_encode(array("message" => "Missing faculty_id parameter."));
    exit();
}

$academic_year_id = isset($_GET['academic_year_id']) ? $_GET['academic_year_id'] : null;
$semester_id = isset($_GET['semester_id']) ? $_GET['semester_id'] : null;
$status = isset($_GET['status']) ? $_GET['status'] : 'active'; // Default to 'active'

// Log received academic_year_id and semester_id for debugging
error_log("Received academic_year_id: " . $academic_year_id);
error_log("Received semester_id: " . $semester_id);

if (!$academic_year_id || !$semester_id) {
    http_response_code(400);
    echo json_encode(array("message" => "Missing academic_year_id or semester_id parameter."));
    exit();
}

$response_data = array(
    "facultyInfo" => null,
    "assignedCourses" => [],
    "advisees" => []
);

try {
    // --- 1. Fetch Faculty Basic Info & Counts ---
    $faculty_info_query = "SELECT
                                e.employee_id as faculty_id,
                                u.email,
                                STRING_AGG(r.role_name, ', ' ORDER BY r.role_name ASC) AS roles,
                                e.name as faculty_name,
                                d.name as department_name
                           FROM employees e
                           JOIN users u ON e.employee_id = u.id
                           LEFT JOIN user_roles ur ON u.id = ur.user_id
                           LEFT JOIN roles r ON ur.role_id = r.id
                           JOIN departments d ON e.department_id = d.id
                           WHERE e.employee_id = :faculty_id
                           GROUP BY e.employee_id, u.email, e.name, d.name";

    $faculty_stmt = $conn->prepare($faculty_info_query);
    if ($faculty_stmt === false) throw new PDOException("Failed to prepare faculty_info query: " . implode(" - ", $conn->errorInfo()));
    $faculty_stmt->bindParam(':faculty_id', $faculty_id);
    $faculty_stmt->execute();

    $facultyInfo = $faculty_stmt->fetch(PDO::FETCH_ASSOC);

    if ($facultyInfo) {
        // Calculate counts for this specific faculty member
        // Sections Assigned
        $sections_assigned_query = "SELECT COUNT(DISTINCT c.id) as count FROM section_faculty sf JOIN sections s ON sf.section_id = s.id JOIN courses c ON sf.course_id = c.id WHERE sf.faculty_id = :faculty_id AND s.academic_year_id = :academic_year_id AND s.semester_id = :semester_id AND sf.status = 'active'";
        $sections_assigned_stmt = $conn->prepare($sections_assigned_query);
        $sections_assigned_stmt->bindParam(':faculty_id', $faculty_id);
        $sections_assigned_stmt->bindParam(':academic_year_id', $academic_year_id);
        $sections_assigned_stmt->bindParam(':semester_id', $semester_id);
        $sections_assigned_stmt->execute();
        $facultyInfo['sectionsAssigned'] = (int)($sections_assigned_stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0);

        // Advised Sections
        $advised_sections_query = "SELECT COUNT(DISTINCT sa.section_id) as count FROM section_advisors sa JOIN sections s ON sa.section_id = s.id WHERE sa.advisor_id = :faculty_id AND s.academic_year_id = :academic_year_id AND s.semester_id = :semester_id";
        $advised_sections_stmt = $conn->prepare($advised_sections_query);
        $advised_sections_stmt->bindParam(':faculty_id', $faculty_id);
        $advised_sections_stmt->bindParam(':academic_year_id', $academic_year_id);
        $advised_sections_stmt->bindParam(':semester_id', $semester_id);
        $advised_sections_stmt->execute();
        $facultyInfo['advisedSectionsCount'] = (int)($advised_sections_stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0);

        // Advisees Count

        $response_data['facultyInfo'] = $facultyInfo;

        // --- 2. Fetch Assigned Courses ---
        // Assuming 'sections' table has 'year_level_id' and 'semester_id' columns
        // Adjust JOINs and column names if your 'sections' table is different
        $assigned_courses_query = "SELECT
                                        sf.id as assignment_id,
                                        c.id as course_id, c.course_code as course_code, c.course_title as course_title,
                                        sec.id as section_id, sec.name as section_name,
                                        yl.level as year_level, -- Assuming sections links to year_levels via year_level_id
                                        sem.semester_name as semester -- Assuming sections links to semesters via semester_id
                                   FROM section_faculty sf
                                   JOIN courses c ON sf.course_id = c.id
                                   JOIN sections sec ON sf.section_id = sec.id
                                   LEFT JOIN year_levels yl ON sec.year_level_id = yl.id -- !! VERIFY JOIN COLUMN !!
                                   LEFT JOIN semesters sem ON sec.semester_id = sem.semester_id -- !! VERIFY JOIN COLUMN !!
                                   WHERE sf.faculty_id = :faculty_id AND sf.status = 'active'
                                   AND sec.academic_year_id = :academic_year_id
                                   AND sec.semester_id = :semester_id
                                   ORDER BY sem.semester_id, sec.name, c.course_code"; // Example ordering

        $courses_stmt = $conn->prepare($assigned_courses_query);
         if ($courses_stmt === false) throw new PDOException("Failed to prepare assigned_courses query: " . implode(" - ", $conn->errorInfo()));
        $courses_stmt->bindParam(':faculty_id', $faculty_id);
        $courses_stmt->bindParam(':academic_year_id', $academic_year_id);
        $courses_stmt->bindParam(':semester_id', $semester_id);
        $courses_stmt->execute();
        $response_data['assignedCourses'] = $courses_stmt->fetchAll(PDO::FETCH_ASSOC);


        // --- 3. Fetch Advisees ---
        // Assuming 'sections' table has 'year_level_id'
        $advisees_query = "SELECT
                                sec.id as section_id,
                                sec.name as section_name,
                                yl.level as year_level, -- Assuming sections links to year_levels via year_level_id
                                sem.semester_name as semester, -- Include semester name for section
                                COUNT(s.id) AS student_count -- Count students in each section
                           FROM section_advisors sa
                           JOIN sections sec ON sa.section_id = sec.id
                           LEFT JOIN students s ON sec.id = s.section_id -- LEFT JOIN to count students, even if none
                           LEFT JOIN year_levels yl ON sec.year_level_id = yl.id -- !! VERIFY JOIN COLUMN !!
                           LEFT JOIN semesters sem ON sec.semester_id = sem.semester_id -- !! VERIFY JOIN COLUMN !!
                           WHERE sa.advisor_id = :faculty_id
                           AND sec.academic_year_id = :academic_year_id
                           AND sec.semester_id = :semester_id
                           AND sa.status = :status
                           GROUP BY sec.id, sec.name, yl.level, sem.semester_name -- Group to get unique sections
                           ORDER BY sec.name";

        $advisees_stmt = $conn->prepare($advisees_query);
        if ($advisees_stmt === false) throw new PDOException("Failed to prepare advisees query: " . implode(" - ", $conn->errorInfo()));
        $advisees_stmt->bindParam(':faculty_id', $faculty_id);
        $advisees_stmt->bindParam(':academic_year_id', $academic_year_id);
        $advisees_stmt->bindParam(':semester_id', $semester_id);
        $advisees_stmt->bindParam(':status', $status);
        $advisees_stmt->execute();
        $response_data['advisees'] = $advisees_stmt->fetchAll(PDO::FETCH_ASSOC);

    } else {
        // Faculty not found, but still return 200 with null info
        // Or you could return 404 here if preferred
        // http_response_code(404);
        // $response_data['message'] = "Faculty not found.";
    }

    // Return the combined data
    http_response_code(200);
    echo json_encode($response_data);

} catch (PDOException $exception) {
    http_response_code(500);
    error_log("Database error in read_single_faculty_assignment.php: " . $exception->getMessage());
    echo json_encode(array(
        "message" => "Unable to fetch faculty assignment data due to a database error.",
        "error_details_debug" => $exception->getMessage() // For debugging
    ));
} catch (Exception $exception) {
    http_response_code(500);
    error_log("General error in read_single_faculty_assignment.php: " . $exception->getMessage());
    echo json_encode(array(
        "message" => "An unexpected error occurred.",
        "error_details_debug" => $exception->getMessage() // For debugging
    ));
}
?>
