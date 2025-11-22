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

// Include database configuration
include_once '../../config/database.php';

// Check database connection
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in get_students_by_section.php.");
    echo json_encode(array("success" => false, "message" => "Database connection failed."));
    exit();
}

// --- Authorization Check (Based on Passed ID) ---
// Check if faculty_id is provided
if (!isset($_GET['faculty_id'])) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Unauthorized: Missing faculty identifier."));
    exit();
}
$faculty_id = $_GET['faculty_id'];

// Fetch user roles from DB based on faculty_id to verify permissions
try {
    $role_query = "SELECT r.role_name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = :faculty_id";
    $role_stmt = $conn->prepare($role_query);
    if ($role_stmt === false) {
         throw new PDOException("Failed to prepare role query: " . implode(" - ", $conn->errorInfo()));
    }
    $role_stmt->bindParam(':faculty_id', $faculty_id);
    $role_stmt->execute();
    $user_roles = $role_stmt->fetchAll(PDO::FETCH_COLUMN, 0);

    if (empty($user_roles)) {
        http_response_code(403);
        error_log("Forbidden access attempt: Invalid faculty_id or no roles found for user: " . $faculty_id);
        echo json_encode(array("success" => false, "message" => "Forbidden: Invalid faculty identifier or no roles assigned."));
        exit();
    }

    $allowedRoles = ['faculty', 'dean', 'programchair'];
    $hasPermission = false;
    foreach ($user_roles as $role_name) {
        if (in_array($role_name, $allowedRoles)) {
            $hasPermission = true;
            break;
        }
    }

    if (!$hasPermission) {
        http_response_code(403);
        error_log("Forbidden access attempt by user ID: " . $faculty_id . " with roles: " . implode(', ', $user_roles));
        echo json_encode(array("success" => false, "message" => "Forbidden: User does not have permission to view students for this section."));
        exit();
    }
} catch (PDOException $e) {
     http_response_code(503);
     error_log("Database error during authorization check in get_students_by_section.php: " . $e->getMessage());
     echo json_encode(array(
         "success" => false,
         "message" => "Database error during authorization: " . $e->getMessage()
     ));
     exit();
}
// --- End Authorization Check ---


// --- Input Validation ---
if (!isset($_GET['section_id'])) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Missing required parameter: section_id"));
    exit();
}

$section_id = filter_input(INPUT_GET, 'section_id', FILTER_VALIDATE_INT);
if ($section_id === false || $section_id <= 0) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Invalid section_id provided"));
    exit();
}

if (!isset($_GET['academic_year_id'])) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Missing required parameter: academic_year_id"));
    exit();
}
$active_ay_id = filter_input(INPUT_GET, 'academic_year_id', FILTER_VALIDATE_INT);
if ($active_ay_id === false || $active_ay_id <= 0) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Invalid academic_year_id provided"));
    exit();
}

if (!isset($_GET['semester_id'])) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Missing required parameter: semester_id"));
    exit();
}
$active_sem_id = filter_input(INPUT_GET, 'semester_id', FILTER_VALIDATE_INT);
if ($active_sem_id === false || $active_sem_id <= 0) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Invalid semester_id provided"));
    exit();
}
// --- End Input Validation ---


try {
    error_log("Fetching students for section $section_id, AY ID: $active_ay_id, Sem ID: $active_sem_id requested by faculty $faculty_id.");

    // First, get the section's academic year and semester
    $section_info_query = "SELECT academic_year_id, semester_id FROM sections WHERE id = :section_id";
    $section_info_stmt = $conn->prepare($section_info_query);
    $section_info_stmt->bindParam(':section_id', $section_id, PDO::PARAM_INT);
    $section_info_stmt->execute();
    $section_info = $section_info_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$section_info) {
        http_response_code(404);
        echo json_encode(array("success" => false, "message" => "Section not found"));
        exit();
    }

    $section_ay_id = $section_info['academic_year_id'];
    $section_sem_id = $section_info['semester_id'];

    // Calculate next academic year and semester
    $next_academic_year_id = $section_ay_id;
    $next_semester_id = $section_sem_id + 1;

    if ($next_semester_id > 2) { // Assuming 2 semesters per academic year
        $next_semester_id = 1;
        $next_academic_year_id++; // Increment academic year if moving from last semester to first
    }

    error_log("Calculated Next AY ID: $next_academic_year_id, Next Sem ID: $next_semester_id");

    // Modified query: Use section's AY/Semester for advising status check
    $sql = "SELECT
                s.student_id AS id,
                s.name,
                s.enrollment_status,
                COALESCE(current_sec.name, enrolled_sec.name) AS current_section,
                sse.enrollment_status AS section_enrollment_status,
                sse.completed_at,
                -- Calculate units based on the NEXT academic year/semester
                (SELECT COALESCE(SUM(c.unit_lec + c.unit_lab), 0)
                 FROM advised_courses ac
                 JOIN courses c ON ac.course_id = c.id
                 WHERE ac.student_id = s.student_id
                   AND ac.academic_year_id = :next_academic_year_id
                   AND ac.semester_id = :next_semester_id
                ) AS units,
                -- Count of advised courses for debugging
                (SELECT COUNT(*)
                 FROM advised_courses ac
                 WHERE ac.student_id = s.student_id
                   AND ac.academic_year_id = :next_academic_year_id
                   AND ac.semester_id = :next_semester_id
                ) AS advised_course_count,
                -- Check advising status based on NEXT academic year/semester
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM advised_courses ac
                        WHERE ac.student_id = s.student_id
                          AND ac.academic_year_id = :next_academic_year_id
                          AND ac.semester_id = :next_semester_id
                          AND ac.status = 'approved'
                          AND ac.advisor_id IS NOT NULL
                        LIMIT 1
                    ) THEN 'Approved'
                    WHEN EXISTS (
                        SELECT 1
                        FROM advised_courses ac
                        WHERE ac.student_id = s.student_id
                          AND ac.academic_year_id = :next_academic_year_id
                          AND ac.semester_id = :next_semester_id
                          AND ac.status = 'pending'
                        LIMIT 1
                    ) THEN 'Pending Approval'
                    ELSE 'Not Started'
                END AS advising_status
            FROM
                students s
            JOIN
                student_section_enrollments sse ON s.id = sse.student_id
            JOIN
                sections enrolled_sec ON sse.section_id = enrolled_sec.id
            LEFT JOIN
                sections current_sec ON s.section_id = current_sec.id
            WHERE
                sse.section_id = :section_id
            ORDER BY
                sse.enrollment_status ASC, s.name ASC";

    // Prepare statement
    $stmt = $conn->prepare($sql);
    if ($stmt === false) {
        throw new PDOException("Failed to prepare student query: " . implode(" - ", $conn->errorInfo()));
    }

    // Bind parameters - now using section's AY/Semester
    $stmt->bindParam(':section_id', $section_id, PDO::PARAM_INT);
    // Bind parameters for the NEXT academic year and semester
    $stmt->bindParam(':next_academic_year_id', $next_academic_year_id, PDO::PARAM_INT);
    $stmt->bindParam(':next_semester_id', $next_semester_id, PDO::PARAM_INT);

    // Execute query
    $stmt->execute();

    // Fetch all results
    $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $num = count($students);

    // --- Send Response ---
    http_response_code(200);
    $students_data = array_map(function($student) {
        $student['units'] = (int)$student['units'];
        return $student;
    }, $students);

    echo json_encode(array(
        "success" => true,
        "count" => $num,
        "data" => $students_data,
        "message" => ($num > 0) ? "Students retrieved successfully." : "No students found in this section."
    ));

} catch (PDOException $e) {
    http_response_code(503);
    error_log("Database error in get_students_by_section.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ));
} catch (Exception $e) {
    http_response_code(500);
    error_log("General error in get_students_by_section.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ));
}
?>