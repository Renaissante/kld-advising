<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
// header("Access-Control-Allow-Methods: GET");
// header("Access-Control-Max-Age: 3600");
// header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';

// Get academic_year_id and semester_id from request
$academic_year_id = isset($_GET['academic_year_id']) ? $_GET['academic_year_id'] : die(json_encode(array("message" => "Missing academic_year_id parameter")));
$semester_id = isset($_GET['semester_id']) ? $_GET['semester_id'] : die(json_encode(array("message" => "Missing semester_id parameter")));

// Check if we want sections with advisors or without advisors
$filter_type = isset($_GET['filter_type']) ? $_GET['filter_type'] : 'all';
$status_filter = isset($_GET['status']) ? $_GET['status'] : null; // Get status filter
$program_ids_filter = isset($_GET['program_ids']) ? $_GET['program_ids'] : null; // Get program_ids filter

try {
    // Base query to get sections filtered by academic year and semester
    $query = "SELECT 
                s.id, 
                s.name,
                s.program_id,
                s.year_level_id, 
                s.status, -- Add status column
                s.capacity, -- Add capacity column
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
            WHERE 
                s.academic_year_id = :academic_year_id 
            AND 
                s.semester_id = :semester_id";
    
    // Add status filter if provided
    if ($status_filter) {
        $query .= " AND s.status = :status";
    }

    // Add program_ids filter if provided
    if ($program_ids_filter) {
        $program_ids_array = explode(',', $program_ids_filter);
        $placeholders = [];
        foreach ($program_ids_array as $key => $program_id) {
            $placeholders[] = ':program_id_' . $key;
        }
        $query .= " AND s.program_id IN (" . implode(',', $placeholders) . ")";
    }

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
    $stmt->bindParam(':academic_year_id', $academic_year_id);
    $stmt->bindParam(':semester_id', $semester_id);
    if ($status_filter) {
        $stmt->bindParam(':status', $status_filter);
    }
    // Bind program_ids parameters
    if ($program_ids_filter) {
        $program_ids_array = explode(',', $program_ids_filter);
        foreach ($program_ids_array as $key => $program_id) {
            $param_name = ':program_id_' . $key;
            $stmt->bindValue($param_name, $program_id, PDO::PARAM_INT);
        }
    }

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
                "status" => $row['status'], // Use status from database
                "capacity" => $row['capacity'], // Add capacity column
                "advisor_name" => $row['advisor_name'], // Add advisor's name
                "enrolledStudents" => array() // Initialize enrolledStudents array
            );

            // Fetch enrolled students for this section
            $students_query = "SELECT 
                                    s.id as student_db_id, 
                                    s.student_id, 
                                    s.name, 
                                    u.email,
                                    sse.enrollment_status,
                                    sse.completed_at,
                                    (SELECT 
                                        prev_sec.name 
                                     FROM 
                                        student_section_enrollments prev_sse
                                     JOIN 
                                        sections prev_sec ON prev_sse.section_id = prev_sec.id
                                     WHERE 
                                        prev_sse.student_id = s.id 
                                        AND prev_sse.enrollment_status = 'completed'
                                     ORDER BY 
                                        prev_sse.completed_at DESC
                                     LIMIT 1
                                    ) AS previous_section_name
                                FROM 
                                    students s
                                JOIN 
                                    users u ON s.student_id = u.id
                                JOIN
                                    student_section_enrollments sse ON s.id = sse.student_id
                                WHERE 
                                    sse.section_id = :section_id";
            $students_stmt = $conn->prepare($students_query);
            $students_stmt->bindParam(':section_id', $row['id']);
            $students_stmt->execute();
            $enrolled_students = $students_stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($enrolled_students as $student_row) {
                array_push($section_item['enrolledStudents'], array(
                    "id" => $student_row['student_db_id'],
                    "studentId" => $student_row['student_id'],
                    "name" => $student_row['name'],
                    "email" => $student_row['email'],
                    "enrollmentStatus" => $student_row['enrollment_status'],
                    "completedAt" => $student_row['completed_at'],
                    "previousSection" => $student_row['previous_section_name']
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