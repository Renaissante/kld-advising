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
          ORDER BY ac.advising_date DESC";

// Query to get graded courses from CURRENT enrollment (left side of form)
// Shows courses offered in the student's section with their grades AND prerequisites
$graded_query = "SELECT 
    subq.course_grade_id,
    subq.course_id,
    subq.course_code,
    subq.course_title,
    subq.grade,
    subq.remarks,
    subq.year_level_id,
    subq.course_semester_id,
    subq.year_level_name,
    subq.course_semester_name,
    subq.academic_year_name,
    subq.semester_name,
    STRING_AGG(DISTINCT pr.course_code, ', ' ORDER BY pr.course_code) AS prerequisite_code,
    STRING_AGG(DISTINCT pr.course_title, ', ' ORDER BY pr.course_title) AS prerequisite_title,
    subq.units
FROM (
    SELECT DISTINCT ON (c.id)
        cg.id as course_grade_id,
        c.id as course_id,
        c.course_code,
        c.course_title,
        (c.unit_lec + c.unit_lab) AS units,
        cg.transmutation AS grade,
        cg.remarks,
        c.year_level_id,
        c.semester_id as course_semester_id,
        yl.level AS year_level_name,
        sem_course.semester_name as course_semester_name,
        ay.academic_year_name,
        sem.semester_name
    FROM students st
    INNER JOIN student_section_enrollments sse ON st.id = sse.student_id
    INNER JOIN sections sec ON sse.section_id = sec.id
    INNER JOIN academic_years ay ON sec.academic_year_id = ay.academic_year_id
    INNER JOIN semesters sem ON sec.semester_id = sem.semester_id
    INNER JOIN section_faculty sf ON sf.section_id = sec.id
    INNER JOIN courses c ON sf.course_id = c.id
    LEFT JOIN year_levels yl ON c.year_level_id = yl.id
    LEFT JOIN semesters sem_course ON c.semester_id = sem_course.semester_id
    LEFT JOIN course_grades cg ON cg.student_id = st.student_id
        AND cg.course_id = c.id
    WHERE st.student_id = :student_id
        AND sse.enrollment_status = 'enrolled'
        AND ay.academic_year_name = :academic_year
        AND sem.semester_name = :semester
        AND sf.status = 'active'
    ORDER BY c.id, cg.id DESC
) subq
LEFT JOIN course_prerequisites cp ON subq.course_id = cp.course_id
LEFT JOIN courses pr ON cp.prerequisite_course_id = pr.id
GROUP BY 
    subq.course_grade_id,
    subq.course_id,
    subq.course_code,
    subq.course_title,
    subq.grade,
    subq.remarks,
    subq.year_level_id,
    subq.course_semester_id,
    subq.year_level_name,
    subq.course_semester_name,
    subq.academic_year_name,
    subq.semester_name,
    subq.units";

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

    // Fetch graded courses from CURRENT enrollment
    $stmt_graded = $conn->prepare($graded_query);
    $stmt_graded->bindParam(':student_id', $student_id);
    $stmt_graded->bindParam(':academic_year', $academic_year);
    $stmt_graded->bindParam(':semester', $semester);
    $stmt_graded->execute();
    $graded_courses = $stmt_graded->fetchAll(PDO::FETCH_ASSOC);

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
        'debug_prerequisites' => $prereq_data // Add this for debugging
    ];

    http_response_code(200);
    echo json_encode($response);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Database error: " . $e->getMessage()]);
}

?>