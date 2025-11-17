<?php
// Required headers
include_once '../../config/cors.php';
require_once '../../config/database.php';

// Set content type to JSON
header("Content-Type: application/json; charset=UTF-8");

// Check if student_id is provided
$student_id = isset($_GET['student_id']) ? trim($_GET['student_id'], '\" ') : die("Missing student_id parameter.");

// Add logging for received student_id
error_log("Received student_id for profile: " . $student_id);

// Prepare a SQL query to select comprehensive student advising profile details
$query = "SELECT
            COALESCE(s.name, 'N/A') AS student_name,
            COALESCE(s.student_id, 'N/A') AS student_number,
            COALESCE(d.name, 'N/A') AS institute_name,
            COALESCE(sec.name, 'N/A') AS program_year_section,
            COALESCE(s.enrollment_status::text, 'N/A') AS student_status,
            COALESCE(e.name, 'N/A') AS current_advisor_name,
            -- Total units earned (sum of passed courses from course_grades)
            (SELECT COALESCE(SUM(c_sum.unit_lec + c_sum.unit_lab), 0)
             FROM advised_courses ac_sum
             JOIN courses c_sum ON ac_sum.course_id = c_sum.id
             LEFT JOIN course_grades cg_sum ON ac_sum.student_id = cg_sum.student_id AND ac_sum.course_id = cg_sum.course_id
             WHERE ac_sum.student_id = s.student_id AND cg_sum.remarks = 'Passed') AS total_units_earned,
            -- Current Enrollment Period (most recent enrollment - active or completed)
            (SELECT
                COALESCE(CONCAT(ay_current.academic_year_name, ' ', sem_current.semester_name), 'N/A')
             FROM student_section_enrollments sse_current
             JOIN sections sec_current ON sse_current.section_id = sec_current.id
             JOIN academic_years ay_current ON sec_current.academic_year_id = ay_current.academic_year_id
             JOIN semesters sem_current ON sec_current.semester_id = sem_current.semester_id
             WHERE sse_current.student_id = s.id 
             ORDER BY 
               CASE 
                 WHEN sse_current.enrollment_status = 'enrolled' THEN 1
                 WHEN sse_current.enrollment_status = 'completed' THEN 2
                 ELSE 3
               END,
               sse_current.enrolled_at DESC
             LIMIT 1) AS current_enrollment_period,
            -- Next Enrollment Period (calculated based on current enrollment)
            (SELECT
                CASE 
                  WHEN sem_current.semester_name ILIKE '%second%' THEN
                    -- If Second Semester, next is First Semester of next academic year
                    CONCAT(
                      CAST(SPLIT_PART(ay_current.academic_year_name, '-', 1)::INTEGER + 1 AS TEXT),
                      '-',
                      CAST(SPLIT_PART(ay_current.academic_year_name, '-', 2)::INTEGER + 1 AS TEXT),
                      ' First Semester'
                    )
                  WHEN sem_current.semester_name ILIKE '%first%' THEN
                    -- If First Semester, next is Second Semester of same academic year
                    CONCAT(ay_current.academic_year_name, ' Second Semester')
                  ELSE
                    'N/A'
                END
             FROM student_section_enrollments sse_current
             JOIN sections sec_current ON sse_current.section_id = sec_current.id
             JOIN academic_years ay_current ON sec_current.academic_year_id = ay_current.academic_year_id
             JOIN semesters sem_current ON sec_current.semester_id = sem_current.semester_id
             WHERE sse_current.student_id = s.id 
             ORDER BY 
               CASE 
                 WHEN sse_current.enrollment_status = 'enrolled' THEN 1
                 WHEN sse_current.enrollment_status = 'completed' THEN 2
                 ELSE 3
               END,
               sse_current.enrolled_at DESC
             LIMIT 1) AS next_enrollment_period

          FROM students s
          LEFT JOIN programs p ON s.program_id = p.id
          LEFT JOIN departments d ON s.department_id = d.id
          LEFT JOIN sections sec ON s.section_id = sec.id
          LEFT JOIN year_levels yl ON s.year_level_id = yl.id
          LEFT JOIN advised_courses ac ON s.student_id = ac.student_id
          LEFT JOIN employees e ON ac.advisor_id = e.employee_id
          LEFT JOIN courses c ON ac.course_id = c.id
          WHERE s.student_id = :student_id
          GROUP BY s.id, s.name, s.student_id, s.enrollment_status, d.name, p.name, yl.level, sec.name, e.name";

// Add logging for the prepared query
error_log("Prepared SQL query for profile: " . $query);

$stmt = $conn->prepare($query);

// Bind parameters
$stmt->bindParam(':student_id', $student_id);

// Add logging for bound parameters
error_log("Bound student_id for profile: " . $student_id);

// Execute query
try {
    if ($stmt->execute()) {
        $num = $stmt->rowCount();
        error_log("Profile query executed successfully. Rows found: " . $num);
        $student_profile = [];

        if ($num > 0) {
            $student_profile = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        http_response_code(200);
        echo json_encode($student_profile);
    } else {
        $error_info = $stmt->errorInfo();
        error_log("Profile query execution failed: " . $error_info[2]);
        http_response_code(500);
        echo json_encode(["message" => "Unable to fetch student profile. Error: " . $error_info[2]]);
    }
} catch (PDOException $e) {
    error_log("Database error fetching student profile: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["message" => "Database error fetching student profile: " . $e->getMessage()]);
}

?>