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
// This query assumes the following table structure:
// - students: student_id, name, program_id, current_section_id, current_year_level_id, status
// - programs: id, program_name, department_id
// - departments: id, department_name
// - sections: id, section_name, year_level_id
// - year_levels: id, year_level_name
// - advised_courses: student_id, course_id, academic_year_id, semester_id, advisor_id
// - courses: id, unit_lec, unit_lab
// - employees: employee_id, name

$query = "SELECT
            COALESCE(s.name, 'N/A') AS student_name,
            COALESCE(s.student_id, 'N/A') AS student_number,
            COALESCE(d.name, 'N/A') AS institute_name,
            COALESCE(sec.name, 'N/A') AS program_year_section,
            COALESCE(s.status, 'N/A') AS student_status,
            COALESCE(e.name, 'N/A') AS current_advisor_name,
            -- Total units earned (sum of passed courses from course_grades)
            (SELECT COALESCE(SUM(c_sum.unit_lec + c_sum.unit_lab), 0)
             FROM advised_courses ac_sum
             JOIN courses c_sum ON ac_sum.course_id = c_sum.id
             LEFT JOIN course_grades cg_sum ON ac_sum.student_id = cg_sum.student_id AND ac_sum.course_id = cg_sum.course_id
             WHERE ac_sum.student_id = s.student_id AND cg_sum.remarks = 'Passed') AS total_units_earned,
            -- Last Enrollment Period from student_section_enrollments
            (SELECT
                COALESCE(CONCAT(ay_last.academic_year_name, ' ', sem_last.semester_name), 'N/A')
             FROM student_section_enrollments sse_last
             JOIN sections sec_last ON sse_last.section_id = sec_last.id
             JOIN academic_years ay_last ON sec_last.academic_year_id = ay_last.academic_year_id
             JOIN semesters sem_last ON sec_last.semester_id = sem_last.semester_id
             WHERE sse_last.student_id = s.id AND sse_last.enrollment_status = 'completed'
             ORDER BY sse_last.completed_at DESC, sse_last.enrolled_at DESC
             LIMIT 1) AS last_enrollment_period

          FROM students s
          LEFT JOIN programs p ON s.program_id = p.id
          LEFT JOIN departments d ON s.department_id = d.id
          LEFT JOIN sections sec ON s.section_id = sec.id
          LEFT JOIN year_levels yl ON s.year_level_id = yl.id
          LEFT JOIN advised_courses ac ON s.student_id = ac.student_id -- Used only for advisor_id for current semester, consider refining this if current advisor is from sections
          LEFT JOIN employees e ON ac.advisor_id = e.employee_id
          LEFT JOIN courses c ON ac.course_id = c.id
          WHERE s.student_id = :student_id
          GROUP BY s.id, s.name, s.student_id, s.status, d.name, p.name, yl.level, sec.name, e.name";

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
