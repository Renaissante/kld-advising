<?php
// Include CORS headers
include_once '../../config/cors.php';

// Set headers for content type
header("Content-Type: application/json; charset=UTF-8"); // Standard content type

// Handle OPTIONS request (preflight) - Keep this for frontend interaction
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header("Access-Control-Allow-Methods: GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization"); // Allow necessary headers
    exit(0);
}

// Include database configuration
include_once '../../config/database.php'; // Use database.php (assuming it provides $conn)

// Check database connection
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in get_students_by_section.php."); // Add error logging
    echo json_encode(array("success" => false, "message" => "Database connection failed."));
    exit();
}

// --- Authorization Check (Based on Passed ID) ---
// Check if faculty_id is provided
if (!isset($_GET['faculty_id'])) {
    http_response_code(401); // Unauthorized (or 400 Bad Request)
    echo json_encode(array("success" => false, "message" => "Unauthorized: Missing faculty identifier."));
    exit();
}
$faculty_id = $_GET['faculty_id']; // Use the passed faculty ID

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
        http_response_code(403); // Forbidden
        error_log("Forbidden access attempt: Invalid faculty_id or no roles found for user: " . $faculty_id);
        echo json_encode(array("success" => false, "message" => "Forbidden: Invalid faculty identifier or no roles assigned."));
        exit();
    }

    $allowedRoles = ['faculty', 'dean', 'programchair']; // Define allowed roles
    $hasPermission = false;
    foreach ($user_roles as $role_name) {
        if (in_array($role_name, $allowedRoles)) {
            $hasPermission = true;
            break;
        }
    }

    if (!$hasPermission) {
        http_response_code(403); // Forbidden
        error_log("Forbidden access attempt by user ID: " . $faculty_id . " with roles: " . implode(', ', $user_roles));
        echo json_encode(array("success" => false, "message" => "Forbidden: User does not have permission to view students for this section."));
        exit();
    }
} catch (PDOException $e) {
     http_response_code(503); // Service Unavailable for DB errors during auth check
     error_log("Database error during authorization check in get_students_by_section.php: " . $e->getMessage());
     echo json_encode(array(
         "success" => false,
         "message" => "Database error during authorization: " . $e->getMessage()
     ));
     exit(); // Stop execution if auth fails
}
// --- End Authorization Check ---


// --- Input Validation ---
// Check if section_id is provided in GET request
if (!isset($_GET['section_id'])) {
    http_response_code(400); // Bad Request
    echo json_encode(array("success" => false, "message" => "Missing required parameter: section_id"));
    exit();
}

// Validate section_id
$section_id = filter_input(INPUT_GET, 'section_id', FILTER_VALIDATE_INT);
if ($section_id === false || $section_id <= 0) {
    http_response_code(400); // Bad Request
    echo json_encode(array("success" => false, "message" => "Invalid section_id provided"));
    exit();
}

// Keep AY and Sem ID checks as they might be used elsewhere or for future features
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

    // --- Fetch Students, Units, and Advising Status ---
    // NOTE: This query assumes you have a table named 'advised_courses'
    // with columns 'student_id', 'academic_year_id', and 'semester_id'
    // that records completed advising sessions.
    // You may need to adjust the table name and column names based on your actual database schema.
    $sql = "SELECT
                s.student_id AS id,
                s.name,
                s.status,
                -- Subquery to calculate total units of courses ACTUALLY advised for this student
                (SELECT COALESCE(SUM(c.unit_lec + c.unit_lab), 0)
                 FROM advised_courses ac
                 JOIN courses c ON ac.course_id = c.id
                 WHERE ac.student_id = s.student_id
                   AND ac.academic_year_id = :active_ay_id
                   AND ac.semester_id = :active_sem_id
                ) AS units,
                -- Determine advising status
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM advised_courses ac
                        WHERE ac.student_id = s.student_id
                        AND ac.academic_year_id = :active_ay_id
                        AND ac.semester_id = :active_sem_id
                        -- Add any other conditions to determine 'Done' status, e.g., a 'status' column in advised_courses
                        -- AND ac.status = 'Completed'
                    ) THEN 'Done'
                    ELSE 'Pending'
                END AS advising_status
            FROM
                students s
            WHERE
                s.section_id = :section_id -- Filter students by the selected section
            ORDER BY
                s.name";

    // Prepare statement using $conn
    $stmt = $conn->prepare($sql);
    if ($stmt === false) {
        throw new PDOException("Failed to prepare student query: " . implode(" - ", $conn->errorInfo()));
    }

    // Bind parameters
    $stmt->bindParam(':section_id', $section_id, PDO::PARAM_INT);
    $stmt->bindParam(':active_ay_id', $active_ay_id, PDO::PARAM_INT); // Bind AY ID for advising status check AND units calculation
    $stmt->bindParam(':active_sem_id', $active_sem_id, PDO::PARAM_INT); // Bind Semester ID for advising status check AND units calculation


    // Execute query
    $stmt->execute();

    // Fetch all results
    $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $num = count($students);
    // --- End Fetch Students, Units, and Advising Status ---


    // --- Send Response ---
    http_response_code(200); // OK
    // Modify student objects to ensure units is an integer and advising_status is included
    $students_data = array_map(function($student) {
        $student['units'] = (int)$student['units']; // Ensure units is an integer
        // advising_status is already included by the SQL query
        return $student;
    }, $students);

    echo json_encode(array(
        "success" => true,
        "count" => $num,
        "data" => $students_data, // Send the modified array
        "message" => ($num > 0) ? "Students retrieved successfully." : "No students found in this section."
    ));
    // --- End Send Response ---

} catch (PDOException $e) {
    http_response_code(503); // Service Unavailable for DB errors
    error_log("Database error in get_students_by_section.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ));
} catch (Exception $e) {
    http_response_code(500); // Internal Server Error
    error_log("General error in get_students_by_section.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ));
}
?>