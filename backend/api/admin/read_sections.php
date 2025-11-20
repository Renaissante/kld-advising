<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// Get academic_year_id and semester_id from request
$academic_year_id = isset($_GET['academic_year_id']) ? $_GET['academic_year_id'] : null;
$semester_id = isset($_GET['semester_id']) ? $_GET['semester_id'] : null;
$ignore_academic_filters = isset($_GET['ignore_academic_filters']) ? filter_var($_GET['ignore_academic_filters'], FILTER_VALIDATE_BOOLEAN) : false;

// // Get admin ID from query parameter (for testing) or session
// $adminId = isset($_GET['admin_id']) ? $_GET['admin_id'] : null;
// 
// // Start session to check for logged in user
// session_start();
// 
// if (!$adminId && isset($_SESSION['user_id'])) {
//     $adminId = $_SESSION['user_id'];
//     // Ensure the logged-in user is an admin
//     if (isset($_SESSION['user_roles']) && !in_array('admin', $_SESSION['user_roles'])) {
//         http_response_code(403);
//         echo json_encode(array("message" => "Forbidden: User is not an admin"));
//         exit();
//     }
// } else if (!$adminId) {
//     http_response_code(401);
//     echo json_encode(array("message" => "Unauthorized: You must be logged in as an admin"));
//     exit();
// }

// If not ignoring academic filters and academic year/semester are missing, then it's an error
if (!$ignore_academic_filters && (empty($academic_year_id) || empty($semester_id))) {
    die(json_encode(array("message" => "Missing academic_year_id or semester_id parameter, or ignore_academic_filters is false")));
}

// Check if we want sections with advisors or without advisors
$filter_type = isset($_GET['filter_type']) ? $_GET['filter_type'] : 'all';
$status_filter = isset($_GET['status']) ? $_GET['status'] : null; // Get status filter
// $program_ids_filter = isset($_GET['program_ids']) ? $_GET['program_ids'] : null; // Remove program_ids filter

try {
    // Base query to get sections
    $query = "SELECT 
                s.id, 
                s.name,
                s.program_id,
                s.year_level_id, 
                s.status,
                s.capacity,
                p.name as program_name,
                yl.level as year_level,
                ay.academic_year_name as academic_year,
                sem.semester_name as semester,
                (SELECT COUNT(*) FROM section_advisors sa WHERE sa.section_id = s.id) as has_advisor,
                (SELECT e.name FROM section_advisors sa2 
                 JOIN users u ON sa2.advisor_id = u.id 
                 JOIN employees e ON u.id = e.employee_id 
                 WHERE sa2.section_id = s.id LIMIT 1) as advisor_name
            FROM 
                sections s
            LEFT JOIN 
                programs p ON s.program_id = p.id
            LEFT JOIN 
                year_levels yl ON s.year_level_id = yl.id
            JOIN 
                academic_years ay ON s.academic_year_id = ay.academic_year_id
            JOIN 
                semesters sem ON s.semester_id = sem.semester_id
            WHERE 1=1";
    
    // Conditionally add academic year and semester filters
    if (!$ignore_academic_filters) {
        $query .= " AND s.academic_year_id = :academic_year_id AND s.semester_id = :semester_id";
    }

    // Add status filter if provided
    if ($status_filter) {
        $query .= " AND s.status = :status";
    }

    // Remove program_ids filter logic
    // if ($program_ids_filter) {
    //     $program_ids_array = explode(',', $program_ids_filter);
    //     $placeholders = [];
    //     foreach ($program_ids_array as $key => $program_id) {
    //         $placeholders[] = ':program_id_' . $key;
    //     }
    //     $query .= " AND s.program_id IN (" . implode(',', $placeholders) . ")";
    // }

    // Filter sections based on whether they have advisors or not
    if ($filter_type === 'no_advisor') {
        $query .= " AND NOT EXISTS (SELECT 1 FROM section_advisors sa WHERE sa.section_id = s.id)";
    } else if ($filter_type === 'has_advisor') {
        $query .= " AND EXISTS (SELECT 1 FROM section_advisors sa WHERE sa.section_id = s.id)";
    }
    
    $query .= " ORDER BY s.name ASC";

    // Prepare statement
    $stmt = $conn->prepare($query);

    // Bind parameters
    if (!$ignore_academic_filters) {
        $stmt->bindParam(':academic_year_id', $academic_year_id);
        $stmt->bindParam(':semester_id', $semester_id);
    }
    if ($status_filter) {
        $stmt->bindParam(':status', $status_filter);
    }
    // Remove program_ids binding logic
    // if ($program_ids_filter) {
    //     $program_ids_array = explode(',', $program_ids_filter);
    //     foreach ($program_ids_array as $key => $program_id) {
    //         $param_name = ':program_id_' . $key;
    //         $stmt->bindValue($param_name, $program_id, PDO::PARAM_INT);
    //     }
    // }

    // Execute query
    $stmt->execute();
    $sections_data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $num = count($sections_data);

    // Check if sections were found
    if ($num > 0) {
        $sections_arr = array();

        foreach ($sections_data as $row) {
            $section_item = array(
                "id" => $row['id'],
                "name" => $row['name'],
                "program_id" => $row['program_id'],
                "year_level_id" => $row['year_level_id'],
                "program_name" => $row['program_name'],
                "year_level" => $row['year_level'],
                "academic_year" => $row['academic_year'],
                "semester" => $row['semester'],
                "has_advisor" => $row['has_advisor'] > 0,
                "status" => $row['status'],
                "capacity" => $row['capacity'],
                "advisor_name" => $row['advisor_name'],
                "enrolledStudents" => array()
            );

            // Fetch students for this section (both current and historical enrollments)
            // Modified query: removed enrollment_status filter to show both 'enrolled' and 'completed'
            $students_query = "SELECT 
                                    s.id as student_db_id, 
                                    s.student_id, 
                                    s.name, 
                                    u.email,
                                    'Regular' as enrollment_type,
                                    null as retake_course_code,
                                    COALESCE(prev_sec.name, 'N/A') AS previous_section_name,
                                    COALESCE(current_sec.name, 'N/A') AS current_section_name,
                                    null as irregular_enrollment_id,
                                    sse.id as sse_id,
                                    sse.enrollment_status,
                                    sse.completed_at
                                FROM 
                                    students s
                                JOIN 
                                    users u ON s.student_id = u.id
                                JOIN
                                    student_section_enrollments sse ON s.id = sse.student_id
                                LEFT JOIN 
                                    sections prev_sec ON sse.previous_section_id = prev_sec.id
                                LEFT JOIN
                                    sections current_sec ON s.section_id = current_sec.id
                                WHERE 
                                    sse.section_id = :section_id

                                UNION ALL

                                -- Fetch irregular students for this section
                                SELECT
                                    s.id as student_db_id,
                                    s.student_id,
                                    s.name,
                                    u.email,
                                    'Irregular' as enrollment_type,
                                    c.course_code as retake_course_code,
                                    COALESCE(home_sec.name, 'N/A') as previous_section_name,
                                    COALESCE(home_sec.name, 'N/A') as current_section_name,
                                    ice.id as irregular_enrollment_id,
                                    null as sse_id,
                                    'enrolled' as enrollment_status,
                                    null as completed_at
                                FROM
                                    students s
                                JOIN
                                    users u ON s.student_id = u.id
                                JOIN
                                    irregular_course_enrollments ice ON s.id = ice.student_id
                                JOIN
                                    courses c ON ice.course_id = c.id
                                LEFT JOIN
                                    sections home_sec ON s.section_id = home_sec.id
                                WHERE
                                    ice.section_id = :section_id AND ice.enrollment_type = 'Retake'
                                
                                ORDER BY enrollment_status ASC, name ASC;";

            $students_stmt = $conn->prepare($students_query);
            $students_stmt->bindParam(':section_id', $row['id']);
            $students_stmt->execute();
            $enrolled_students = $students_stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($enrolled_students as $student_row) {
                array_push($section_item['enrolledStudents'], array(
                    "id" => $student_row['enrollment_type'] === 'Irregular' ? "irregular-" . $student_row['student_db_id'] . "-" . $student_row['irregular_enrollment_id'] : "regular-" . $student_row['student_db_id'] . "-" . $student_row['sse_id'],
                    "student_id" => $student_row['student_id'],
                    "name" => $student_row['name'],
                    "email" => $student_row['email'],
                    "previous_section_name" => $student_row['previous_section_name'],
                    "current_section_name" => $student_row['current_section_name'],
                    "assigned_course_code" => $student_row['retake_course_code'],
                    "is_irregular" => ($student_row['enrollment_type'] === 'Irregular'),
                    "enrollmentStatus" => $student_row['enrollment_status'], // Will be 'enrolled' or 'completed'
                    "completed_at" => $student_row['completed_at']
                ));
            }

            array_push($sections_arr, $section_item);
        }

        // Set response code - 200 OK
        http_response_code(200);

        // Send response
        echo json_encode($sections_arr);
    } else {
        // Set response code - 200 OK (not 404) with empty array
        http_response_code(200);

        // Tell the user no sections found
        echo json_encode(array());
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>