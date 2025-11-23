<?php
// Required headers
include_once '../../config/cors.php';
require_once '../../config/database.php';

// Set content type to JSON
header("Content-Type: application/json; charset=UTF-8");

// Check if student_id, academic_year, and semester are provided
$student_id = isset($_GET['student_id']) ? trim($_GET['student_id'], '\" ') : die("Missing student_id parameter.");
$academic_year = isset($_GET['academic_year']) ? trim($_GET['academic_year'], '\" ') : die("Missing academic_year parameter.");
$semester = isset($_GET['semester']) ? trim($_GET['semester'], '\" ') : die("Missing semester parameter.");

// Add logging for received parameters
error_log("Received student_id for profile: " . $student_id);
error_log("Received academic_year for profile: " . $academic_year);
error_log("Received semester for profile: " . $semester);

try {
    // Fetch all academic years and semesters to determine the previous period
    $get_all_periods_sql = "SELECT
                                ay.academic_year_id,
                                ay.academic_year_name,
                                sem.semester_id,
                                sem.semester_name
                            FROM academic_years ay
                            CROSS JOIN semesters sem
                            ORDER BY ay.academic_year_name ASC, sem.semester_id ASC";
    $stmt_all_periods = $conn->prepare($get_all_periods_sql);
    $stmt_all_periods->execute();
    $all_periods = $stmt_all_periods->fetchAll(PDO::FETCH_ASSOC);
    
    $current_period_index = -1;
    foreach ($all_periods as $index => $period) {
        if ($period['academic_year_name'] === $academic_year && $period['semester_name'] === $semester) {
            $current_period_index = $index;
            break;
        }
    }
    
    $last_enrollment_academic_year = 'N/A';
    $last_enrollment_semester = '';
    
    if ($current_period_index > 0) {
        $previous_period = $all_periods[$current_period_index - 1];
        $last_enrollment_academic_year = $previous_period['academic_year_name'];
        $last_enrollment_semester = $previous_period['semester_name'];
    }

    // Determine next enrollment period
    $next_enrollment_academic_year = 'N/A';
    $next_enrollment_semester = '';

    if ($current_period_index < count($all_periods) - 1) {
        $next_period = $all_periods[$current_period_index + 1];
        $next_enrollment_academic_year = $next_period['academic_year_name'];
        $next_enrollment_semester = $next_period['semester_name'];
    }

    // Prepare a SQL query to select comprehensive student advising profile details
    $query = "SELECT
                COALESCE(s.name, 'N/A') AS student_name,
                COALESCE(s.student_id, 'N/A') AS student_number,
                COALESCE(d.name, 'N/A') AS institute_name,
                COALESCE(sec.name, 'N/A') AS program_year_section,
                COALESCE(s.enrollment_status::text, 'N/A') AS student_status,
                (SELECT e.name 
                 FROM advised_courses ac
                 JOIN employees e ON ac.advisor_id = e.employee_id
                 JOIN academic_years ay_ac ON ac.academic_year_id = ay_ac.academic_year_id
                 JOIN semesters sem_ac ON ac.semester_id = sem_ac.semester_id
                 WHERE ac.student_id = s.student_id
                 AND ay_ac.academic_year_name = :academic_year
                 AND sem_ac.semester_name = :semester
                 LIMIT 1) AS current_advisor_name,
                (SELECT COALESCE(SUM(c_sum.unit_lec + c_sum.unit_lab), 0)
                 FROM course_grades cg_sum
                 JOIN courses c_sum ON cg_sum.course_id = c_sum.id
                 WHERE cg_sum.student_id = s.student_id 
                 AND cg_sum.remarks = 'Passed') AS total_units_earned,
                :last_enrollment_period AS last_enrollment_period,
                :current_enrollment_period AS current_enrollment_period,
                :next_enrollment_period AS next_enrollment_period
              FROM students s
              LEFT JOIN programs p ON s.program_id = p.id
              LEFT JOIN departments d ON s.department_id = d.id
              LEFT JOIN sections sec ON s.section_id = sec.id
              WHERE s.student_id = :student_id";

    $stmt = $conn->prepare($query);

    // Build period strings
    $last_enrollment_period_str = $last_enrollment_semester 
        ? $last_enrollment_academic_year . ' ' . $last_enrollment_semester 
        : 'N/A';
    $current_enrollment_period_str = $academic_year . ' ' . $semester;
    $next_enrollment_period_str = $next_enrollment_semester 
        ? $next_enrollment_academic_year . ' ' . $next_enrollment_semester 
        : 'N/A';

    // Bind parameters
    $stmt->bindParam(':student_id', $student_id);
    $stmt->bindParam(':last_enrollment_period', $last_enrollment_period_str);
    $stmt->bindParam(':current_enrollment_period', $current_enrollment_period_str);
    $stmt->bindParam(':next_enrollment_period', $next_enrollment_period_str);
    $stmt->bindParam(':academic_year', $academic_year);
    $stmt->bindParam(':semester', $semester);

    // Execute query
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