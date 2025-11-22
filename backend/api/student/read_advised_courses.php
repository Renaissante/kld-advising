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
error_log("Received student_id: " . $student_id);
error_log("Received academic_year: " . $academic_year);
error_log("Received semester: " . $semester);

    // Query to get advised courses for CURRENT enrollment (right side of form)
    $advised_query = "SELECT
            ac.advised_course_id,
            s.name as student_name,
            c.course_code,
            c.course_title,
            (c.unit_lec + c.unit_lab) AS units,
            ay.academic_year_name as academic_year_name,
            sem.semester_name,
            e.name as advisor_name,
            ac.advising_date
          FROM advised_courses ac
          LEFT JOIN students s ON ac.student_id = s.student_id
          LEFT JOIN courses c ON ac.course_id = c.id
          LEFT JOIN academic_years ay ON ac.academic_year_id = ay.academic_year_id
          LEFT JOIN semesters sem ON ac.semester_id = sem.semester_id
          LEFT JOIN employees e ON ac.advisor_id = e.employee_id
          WHERE ac.student_id = :student_id
            AND ay.academic_year_name = :academic_year
            AND sem.semester_name = :semester
            AND ac.status = 'approved'
          ORDER BY ac.advised_course_id";

// Query to get graded courses for student for the current enrollment period
$graded_query = "SELECT
        cg.id as course_grade_id,
        c.id as course_id,
        c.course_code,
        c.course_title,
        (c.unit_lec + c.unit_lab) AS total_units,
        CASE
            WHEN cg.remarks IN ('Failed', 'Incomplete', 'Unofficially Dropped', 'Officially Dropped') OR cg.remarks IS NULL THEN 0
            ELSE (c.unit_lec + c.unit_lab)
        END AS units_earned,
        cg.transmutation AS grade,
        cg.remarks,
        c.year_level_id,
        yl.level AS year_level_name,
        c.semester_id as course_semester_id,
        sem_c.semester_name as course_semester_name,
        ay_cg.academic_year_name AS grade_academic_year_name,
        sem_cg.semester_name AS grade_semester_name,
        STRING_AGG(DISTINCT pr.course_code, ', ' ORDER BY pr.course_code) AS prerequisite_code,
        STRING_AGG(DISTINCT pr.course_title, ', ' ORDER BY pr.course_title) AS prerequisite_title
    FROM students s
    LEFT JOIN courses c ON c.curriculum_id = s.curriculum_id
    INNER JOIN course_grades cg ON cg.student_id = s.student_id AND cg.course_id = c.id
    INNER JOIN academic_years ay_cg ON cg.academic_year_id = ay_cg.academic_year_id
    INNER JOIN semesters sem_cg ON cg.semester_id = sem_cg.semester_id
    LEFT JOIN year_levels yl ON c.year_level_id = yl.id
    LEFT JOIN semesters sem_c ON c.semester_id = sem_c.semester_id
    LEFT JOIN course_prerequisites cp ON c.id = cp.course_id
    LEFT JOIN courses pr ON cp.prerequisite_course_id = pr.id
    WHERE s.id = :student_id_int
      AND ay_cg.academic_year_name = :last_enrollment_academic_year
      AND sem_cg.semester_name = :last_enrollment_semester
    GROUP BY
        cg.id, c.id, c.course_code, c.course_title, cg.transmutation,
        cg.remarks, c.year_level_id, yl.level, c.semester_id, sem_c.semester_name,
        ay_cg.academic_year_name, sem_cg.semester_name, ay_cg.academic_year_id, sem_cg.semester_id
    ORDER BY c.year_level_id ASC, c.semester_id ASC, c.id ASC";

// Debug query to check prerequisites
$prereq_debug_query = "SELECT 
    c.course_code,
    c.course_title,
    c.id as course_id,
    pr.course_code as prereq_code,
    pr.course_title as prereq_title,
    cp.prerequisite_course_id
FROM courses c
LEFT JOIN course_prerequisites cp ON c.id = cp.course_id
LEFT JOIN courses pr ON cp.prerequisite_course_id = pr.id
WHERE c.id IN (
    SELECT DISTINCT c.id
    FROM students st
    INNER JOIN student_section_enrollments sse ON st.id = sse.student_id
    INNER JOIN sections sec ON sse.section_id = sec.id
    INNER JOIN academic_years ay ON sec.academic_year_id = ay.academic_year_id
    INNER JOIN semesters sem ON sec.semester_id = sem.semester_id
    INNER JOIN section_faculty sf ON sf.section_id = sec.id
    INNER JOIN courses c ON sf.course_id = c.id
    WHERE st.student_id = :student_id
        AND sse.enrollment_status = 'enrolled'
        AND ay.academic_year_name = :academic_year
        AND sem.semester_name = :semester
        AND sf.status = 'active'
)
ORDER BY c.course_code";

try {
    // Debug: Check prerequisites for courses
    $stmt_prereq_debug = $conn->prepare($prereq_debug_query);
    $stmt_prereq_debug->bindParam(':student_id', $student_id);
    $stmt_prereq_debug->bindParam(':academic_year', $academic_year);
    $stmt_prereq_debug->bindParam(':semester', $semester);
    $stmt_prereq_debug->execute();
    $prereq_data = $stmt_prereq_debug->fetchAll(PDO::FETCH_ASSOC);

    error_log("=== DEBUG: PREREQUISITES CHECK ===");
    error_log("Prerequisite data: " . json_encode($prereq_data, JSON_PRETTY_PRINT));

    // Lookup the real integer PK for this student_id
    $get_student_id_sql = "SELECT id FROM students WHERE student_id = :student_id_str";
    $stmt_lookup = $conn->prepare($get_student_id_sql);
    $stmt_lookup->bindParam(':student_id_str', $student_id);
    $stmt_lookup->execute();
    $student_row = $stmt_lookup->fetch(PDO::FETCH_ASSOC);
    if (!$student_row || !isset($student_row['id'])) {
        http_response_code(400);
        echo json_encode(["message" => "Student not found."]);
        exit;
    }
    $student_id_int = $student_row['id'];

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
    
    $last_enrollment_academic_year = null;
    $last_enrollment_semester = null;
    
    if ($current_period_index > 0) {
        $previous_period = $all_periods[$current_period_index - 1];
        $last_enrollment_academic_year = $previous_period['academic_year_name'];
        $last_enrollment_semester = $previous_period['semester_name'];
    } else {
        error_log("No previous enrollment period found for: " . $academic_year . " " . $semester);
    }
    
    error_log("Calculated last_enrollment_academic_year: " . ($last_enrollment_academic_year ?? 'N/A'));
    error_log("Calculated last_enrollment_semester: " . ($last_enrollment_semester ?? 'N/A'));

    // Fetch advised courses for CURRENT enrollment
    $stmt_advised = $conn->prepare($advised_query);
    $stmt_advised->bindParam(':student_id', $student_id);
    $stmt_advised->bindParam(':academic_year', $academic_year);
    $stmt_advised->bindParam(':semester', $semester);
    $stmt_advised->execute();
    $advised_courses = $stmt_advised->fetchAll(PDO::FETCH_ASSOC);

    error_log("=== ADVISED COURSES ===");
    error_log("Advised courses count: " . count($advised_courses));
    if (!empty($advised_courses)) {
        error_log("Advised courses data: " . json_encode($advised_courses, JSON_PRETTY_PRINT));
    } else {
        error_log("No advised courses found");
    }

    // Prepare and bind for graded_courses
    $graded_courses = []; // Initialize to empty array
    
    if ($last_enrollment_academic_year && $last_enrollment_semester) {
        $stmt_graded = $conn->prepare($graded_query);
        $stmt_graded->bindParam(':student_id_int', $student_id_int, PDO::PARAM_INT);
        $stmt_graded->bindParam(':last_enrollment_academic_year', $last_enrollment_academic_year);
        $stmt_graded->bindParam(':last_enrollment_semester', $last_enrollment_semester);
        $stmt_graded->execute();
        $graded_courses = $stmt_graded->fetchAll(PDO::FETCH_ASSOC);
    }
    
    error_log("=== GRADED COURSES ===");
    error_log("Graded courses count: " . count($graded_courses));
    if (!empty($graded_courses)) {
        error_log("Graded courses data: " . json_encode($graded_courses, JSON_PRETTY_PRINT));
    } else {
        error_log("No graded courses found");
    }

    // Prepare response
    $response = [
        'advised_courses' => $advised_courses,
        'graded_courses' => $graded_courses,
        'student_name' => !empty($advised_courses) ? $advised_courses[0]['student_name'] : null,
        'advisor_name' => !empty($advised_courses) ? $advised_courses[0]['advisor_name'] : null,
        'debug_prerequisites' => $prereq_data
    ];

    http_response_code(200);
    echo json_encode($response);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Database error: " . $e->getMessage()]);
}

?>