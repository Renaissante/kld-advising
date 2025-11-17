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
    error_log("Database connection failed in get_sections.php.");
    echo json_encode(array("success" => false, "message" => "Database connection failed."));
    exit();
}

// Get advisor ID (renamed from facultyId for clarity) - check query parameter first, then session
$advisorId = isset($_GET['faculty_id']) ? $_GET['faculty_id'] : null; // Keep query param name for frontend compatibility for now
$statusFilter = isset($_GET['status_filter']) ? $_GET['status_filter'] : null; // Changed: null means show all

// If no query parameter, check session
if (!$advisorId && isset($_SESSION['user_id'])) {
    $advisorId = $_SESSION['user_id'];

    // Also verify role if available
    if (isset($_SESSION['user_roles'])) {
        $allowedRoles = ['faculty', 'dean', 'programchair', 'advisor']; // Define allowed roles, added 'advisor'
        $hasPermission = false;
        foreach ($_SESSION['user_roles'] as $userRole) {
            if (in_array($userRole, $allowedRoles)) {
                $hasPermission = true;
                break;
            }
        }

        if (!$hasPermission) {
            http_response_code(403);
            echo json_encode(array("success" => false, "message" => "Forbidden: User does not have permission to view assigned sections"));
            exit();
        }
    } else {
        http_response_code(403);
        echo json_encode(array("success" => false, "message" => "Forbidden: User roles not found in session"));
        exit();
    }
}

// If still no advisor ID, return unauthorized
if (!$advisorId) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Unauthorized: You must be logged in"));
    exit();
}

try {
    // Modified query: Use student_section_enrollments to count students correctly for both active and completed sections
    $query = "SELECT
                s.id AS section_id,
                s.name AS section_name,
                s.status,
                p.name AS program_name,
                yl.level AS year_level,
                sem.semester_name AS semester_name,
                ay.academic_year_name AS academic_year,
                ay.academic_year_id,
                sem.semester_id,
                sa.status as advisor_status,
                -- Count students from enrollment history instead of current section assignment
                COUNT(DISTINCT sse.student_id) AS student_count,
                -- Subquery to count distinct courses associated with this section via section_faculty
                (SELECT COUNT(DISTINCT sf.course_id)
                 FROM section_faculty sf
                 WHERE sf.section_id = s.id) AS subject_count
            FROM section_advisors sa -- Start with advisors to find their sections
            JOIN sections s ON sa.section_id = s.id
            JOIN academic_years ay ON s.academic_year_id = ay.academic_year_id
            JOIN semesters sem ON s.semester_id = sem.semester_id
            LEFT JOIN programs p ON s.program_id = p.id
            LEFT JOIN year_levels yl ON s.year_level_id = yl.id
            -- Changed: Use student_section_enrollments to count all students who were/are enrolled
            LEFT JOIN student_section_enrollments sse ON s.id = sse.section_id
            WHERE sa.advisor_id = :advisor_id";
    
    // Add status filter only if specified
    if ($statusFilter !== null) {
        $query .= " AND sa.status::TEXT = :status_filter";
    }
    
    $query .= " GROUP BY
                s.id,
                s.name,
                s.status,
                p.name,
                yl.level,
                sem.semester_name,
                ay.academic_year_name,
                ay.academic_year_id,
                sem.semester_id,
                sa.status
            ORDER BY ay.academic_year_name DESC, sem.semester_id, s.name";

    // Prepare statement
    $stmt = $conn->prepare($query);
    if ($stmt === false) {
        throw new PDOException("Failed to prepare query: " . implode(" - ", $conn->errorInfo()));
    }

    // Bind advisor ID
    $stmt->bindParam(':advisor_id', $advisorId);
    
    // Bind status filter only if specified
    if ($statusFilter !== null) {
        $stmt->bindParam(':status_filter', $statusFilter);
    }

    // Execute query
    $stmt->execute();
    $num = $stmt->rowCount();

    // Array to hold section data
    $sections_arr = array();

    // Check if sections were found
    if ($num > 0) {
        // Fetch all results
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            // Extract row data
            $section_item = array(
                "id" => $row['section_id'],
                "name" => $row['section_name'],
                "status" => $row['status'],
                "advisor_status" => $row['advisor_status'],
                "program" => $row['program_name'],
                "year_level" => $row['year_level'],
                "semester" => $row['semester_name'],
                "academic_year" => $row['academic_year'],
                "student_count" => (int)$row['student_count'],
                "subjects" => (int)$row['subject_count'],
                "academic_year_id" => $row['academic_year_id'],
                "semester_id" => $row['semester_id']
            );
            array_push($sections_arr, $section_item);
        }
    }

    // Set response code - 200 OK
    http_response_code(200);

    // Send response
    echo json_encode(array(
        "success" => true,
        "count" => count($sections_arr),
        "data" => $sections_arr,
        "message" => ($num > 0) ? "Sections retrieved successfully." : "No sections found assigned to this advisor."
    ));

} catch (PDOException $e) {
    http_response_code(503);
    error_log("Database error in get_sections.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ));
} catch (Exception $e) {
    http_response_code(500);
    error_log("General error in get_sections.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ));
}
?>