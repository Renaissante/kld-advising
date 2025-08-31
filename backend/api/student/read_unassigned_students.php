<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// Get academic_year_id and semester_id from request
$academic_year_id = isset($_GET['academic_year_id']) ? $_GET['academic_year_id'] : die(json_encode(array("message" => "Missing academic_year_id parameter")));
$semester_id = isset($_GET['semester_id']) ? $_GET['semester_id'] : die(json_encode(array("message" => "Missing semester_id parameter")));

try {
    // Query to get unassigned students for a specific academic year and semester
    $query = "SELECT 
                s.id as student_db_id, 
                s.student_id, 
                s.name, 
                u.email,
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
            WHERE 
                s.section_id IS NULL
            ORDER BY 
                s.name ASC";
    
    // Prepare statement
    $stmt = $conn->prepare($query);

    // Bind parameters
    // The academic_year_id and semester_id are no longer used in the WHERE clause
    // for unassigned students, as their section_id being NULL is the sole criteria.
    // These parameters are still received but not bound to the query.

    // Execute query
    $stmt->execute();
    $num = $stmt->rowCount();

    // Check if students were found
    if ($num > 0) {
        $students_arr = array();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $student_item = array(
                "id" => $row['student_db_id'], // Use the database ID of the student entry
                "studentId" => $row['student_id'], // The user ID which is also the student ID
                "name" => $row['name'],
                "email" => $row['email'],
                "previousSection" => $row['previous_section_name']
            );
            array_push($students_arr, $student_item);
        }

        http_response_code(200);
        echo json_encode($students_arr);
    } else {
        http_response_code(200); // Not 404, just no unassigned students
        echo json_encode(array());
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}?>