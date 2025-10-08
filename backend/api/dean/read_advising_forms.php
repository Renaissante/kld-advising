<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

include_once '../../config/cors.php';
require_once '../../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

// Remove direct fetching of academic_year and semester from GET, as they will be active ones
// $academicYear = isset($_GET['academic_year']) ? $_GET['academic_year'] : '';
// $semester = isset($_GET['semester']) ? $_GET['semester'] : '';

$program = isset($_GET['program']) ? $_GET['program'] : '';
$section = isset($_GET['section']) ? $_GET['section'] : '';
$yearLevel = isset($_GET['year_level']) ? $_GET['year_level'] : '';
$searchQuery = isset($_GET['search_query']) ? $_GET['search_query'] : '';

try {
    // Fetch the active academic year and semester
    $activeAcademicYearQuery = "SELECT academic_year_id, academic_year_name FROM academic_years WHERE status = 'active' LIMIT 1";
    $activeAcademicYearStmt = $conn->prepare($activeAcademicYearQuery);
    $activeAcademicYearStmt->execute();
    $activeAcademicYear = $activeAcademicYearStmt->fetch(PDO::FETCH_ASSOC);

    $activeSemesterQuery = "SELECT semester_id, semester_name FROM semesters WHERE status = 'active' LIMIT 1";
    $activeSemesterStmt = $conn->prepare($activeSemesterQuery);
    $activeSemesterStmt->execute();
    $activeSemester = $activeSemesterStmt->fetch(PDO::FETCH_ASSOC);

    if (!$activeAcademicYear || !$activeSemester) {
        http_response_code(404);
        echo json_encode(array("message" => "Active academic year or semester not found."));
        exit();
    }

    $academicYearId = $activeAcademicYear['academic_year_id'];
    $academicYearName = $activeAcademicYear['academic_year_name'];
    $semesterId = $activeSemester['semester_id'];
    $semesterName = $activeSemester['semester_name'];

    $query = "
        SELECT
            s.student_id,
            s.name AS student_name,
            s.student_id AS student_number,
            COALESCE(i.name, 'N/A') AS institute_name,
            CONCAT(COALESCE(p.name, 'N/A'), '/', COALESCE(yl.level, 'N/A'), '/', COALESCE(sec.name, 'N/A')) AS program_year_section,
            COALESCE(sec.name, 'N/A') AS section_name,
            COALESCE(yl.level, 'N/A') AS year_level,
            COALESCE(p.name, 'N/A') AS program_name,
            s.status AS student_status,
            ay.academic_year_name,
            sem.semester_name,
            -- Determine advising status for the current advising session
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM advised_courses ac_status
                    WHERE ac_status.student_id = s.student_id
                    AND ac_status.academic_year_id = ay.academic_year_id
                    AND ac_status.semester_id = sem.semester_id
                ) THEN 'Completed'
                ELSE 'Pending'
            END AS advising_status,
            adv_emp.name AS advisor_name,
            (SELECT MIN(ac_date.advising_date)
             FROM advised_courses ac_date
             WHERE ac_date.student_id = s.student_id
               AND ac_date.academic_year_id = ay.academic_year_id
               AND ac_date.semester_id = sem.semester_id) AS advising_date
        FROM
            students s
        JOIN
            users u ON s.student_id = u.id
        JOIN
            student_section_enrollments sse ON s.id = sse.student_id
        JOIN
            sections sec ON sse.section_id = sec.id
        JOIN
            academic_years ay ON sec.academic_year_id = ay.academic_year_id
        JOIN
            semesters sem ON sec.semester_id = sem.semester_id
        LEFT JOIN
            programs p ON s.program_id = p.id
        LEFT JOIN
            departments i ON p.department_id = i.id
        LEFT JOIN
            year_levels yl ON s.year_level_id = yl.id
        LEFT JOIN
            section_advisors sa ON sec.id = sa.section_id
        LEFT JOIN
            employees adv_emp ON sa.advisor_id = adv_emp.employee_id
        WHERE 1=1
        AND ay.academic_year_id = :active_academic_year_id
        AND sem.semester_id = :active_semester_id
    ";

    $params = [
        ':active_academic_year_id' => $academicYearId,
        ':active_semester_id' => $semesterId,
    ];

    // The academic_year and semester filters are now implicitly handled by fetching the active ones
    // No need for these conditional appends anymore
    // if (!empty($academicYear)) {
    //     $query .= " AND ay.academic_year_name = :academic_year";
    //     $params[':academic_year'] = $academicYear;
    // }
    // if (!empty($semester)) {
    //     $query .= " AND sem.semester_name = :semester";
    //     $params[':semester'] = $semester;
    // }

    if (!empty($program)) {
        $query .= " AND p.name = :program";
        $params[':program'] = $program;
    }
    if (!empty($section)) {
        $query .= " AND sec.name = :section";
        $params[':section'] = $section;
    }
    if (!empty($yearLevel)) {
        $query .= " AND yl.level = :year_level";
        $params[':year_level'] = $yearLevel;
    }
    if (!empty($searchQuery)) {
        $query .= " AND (s.name LIKE :search_query OR s.student_id LIKE :search_query OR adv_emp.name LIKE :search_query)";
        $params[':search_query'] = '%' . $searchQuery . '%';
    }

    // Add a GROUP BY to ensure unique advising forms per student for the active period
    $query .= " GROUP BY s.student_id";

    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    $advisingForms = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($advisingForms);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Server error: " . $e->getMessage()));
}

?>
