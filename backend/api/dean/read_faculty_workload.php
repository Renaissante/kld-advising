<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

include_once '../../config/cors.php';
require_once '../../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

// Get filter parameters from GET request
$academicYearName = isset($_GET['academic_year']) ? $_GET['academic_year'] : null;
$semesterName = isset($_GET['semester_name']) ? $_GET['semester_name'] : null;

$facultyWorkloadData = [];

try {
    // Fetch active academic year and semester if not provided
    $activeAcademicYear = null;
    if (!$academicYearName) {
        $stmt = $conn->prepare("SELECT academic_year_name FROM academic_years WHERE is_current = TRUE LIMIT 1");
        $stmt->execute();
        $activeAcademicYear = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($activeAcademicYear) {
            $academicYearName = $activeAcademicYear['academic_year_name'];
        }
    }

    $activeSemester = null;
    if (!$semesterName) {
        $stmt = $conn->prepare("SELECT semester_name FROM semesters WHERE is_current = TRUE LIMIT 1");
        $stmt->execute();
        $activeSemester = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($activeSemester) {
            $semesterName = $activeSemester['semester_name'];
        }
    }

    $query = "SELECT
                u.id AS faculty_user_id,
                e.name AS faculty_name,
                COUNT(DISTINCT ac.student_id) AS advised_students,
                COUNT(DISTINCT sf.section_id) AS sections_taught,
                SUM(COALESCE(c.unit_lec, 0) + COALESCE(c.unit_lab, 0)) AS total_units
              FROM
                faculty f
              JOIN
                employees e ON f.employee_id = e.employee_id
              JOIN
                users u ON e.employee_id = u.id
              LEFT JOIN
                section_faculty sf ON u.id = sf.faculty_id AND sf.status = 'active'
              LEFT JOIN
                sections sect ON sf.section_id = sect.id AND sect.status = 'active'
              LEFT JOIN
                courses c ON sf.course_id = c.id
              LEFT JOIN
                academic_years ay ON sect.academic_year_id = ay.academic_year_id AND ay.academic_year_name = :academic_year_name
              LEFT JOIN
                semesters sem ON sect.semester_id = sem.semester_id AND sem.semester_name = :semester_name
              LEFT JOIN
                advised_courses ac ON e.employee_id = ac.advisor_id
                                  AND ac.academic_year_id = ay.academic_year_id
                                  AND ac.semester_id = sem.semester_id
              WHERE 1=1";

    $params = [];

    if ($academicYearName) {
        $params[':academic_year_name'] = $academicYearName;
    }
    if ($semesterName) {
        $params[':semester_name'] = $semesterName;
    }

    $query .= " GROUP BY u.id, e.name ORDER BY e.name ASC";

    error_log("Faculty Workload Query: " . $query);
    error_log("Faculty Workload Params: " . json_encode($params));
    error_log("Active Academic Year: " . ($academicYearName ?? 'Not set'));
    error_log("Active Semester: " . ($semesterName ?? 'Not set'));

    $stmt = $conn->prepare($query);
    $stmt->execute($params);

    error_log("Rows found: " . $stmt->rowCount());

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        extract($row);
        $facultyWorkloadData[] = [
            "faculty" => $faculty_name,
            "advisedStudents" => (int)$advised_students,
            "sectionsTaught" => (int)$sections_taught,
            "totalUnits" => (int)$total_units
        ];
    }

    error_log("Faculty Workload Data: " . json_encode($facultyWorkloadData));

    http_response_code(200);
    echo json_encode($facultyWorkloadData);

} catch (PDOException $e) {
    http_response_code(503);
    error_log("Database error in read_faculty_workload.php: " . $e->getMessage());
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
} catch (Exception $e) {
    http_response_code(500);
    error_log("General error in read_faculty_workload.php: " . $e->getMessage());
    echo json_encode(array("message" => "Server error: " . $e->getMessage()));
}
?>
