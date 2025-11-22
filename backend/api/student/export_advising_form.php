<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

ob_start(); // Start output buffering

include_once '../../config/cors.php';
require_once '../../config/database.php';
require_once __DIR__ . '/../../../vendor/autoload.php'; // Composer autoload

// Get filter parameters from GET request
$student_id = isset($_GET['student_id']) ? trim($_GET['student_id'], '\" ') : die("Missing student_id parameter.");
$academic_year = isset($_GET['academic_year']) ? trim($_GET['academic_year'], '\" ') : die("Missing academic_year parameter.");
$semester = isset($_GET['semester']) ? trim($_GET['semester'], '\" ') : die("Missing semester parameter.");
$format = 'pdf'; // Force format to PDF for student export

// Log received parameters for debugging
error_log("Export request received: Student ID = " . $student_id . ", Academic Year = " . $academic_year . ", Semester = " . $semester . ", Format = " . $format);

try {
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

    // Fetch the active academic year and semester - NOT NEEDED AS PARAMS ARE PASSED
    // $activeAcademicYearQuery = "SELECT academic_year_id, academic_year_name FROM academic_years WHERE is_current = TRUE LIMIT 1";
    // $activeAcademicYearStmt = $conn->prepare($activeAcademicYearQuery);
    // $activeAcademicYearStmt->execute();
    // $activeAcademicYear = $activeAcademicYearStmt->fetch(PDO::FETCH_ASSOC);

    // $activeSemesterQuery = "SELECT semester_id, semester_name FROM semesters WHERE is_current = TRUE LIMIT 1";
    // $activeSemesterStmt = $conn->prepare($activeSemesterQuery);
    // $activeSemesterStmt->execute();
    // $activeSemester = $activeSemesterStmt->fetch(PDO::FETCH_ASSOC);

    // if (!$activeAcademicYear || !$activeSemester) {
    //     http_response_code(404);
    //     echo json_encode(array("message" => "Active academic year or semester not found."));
    //     exit();
    // }

    // $academicYearId = $activeAcademicYear['academic_year_id'];
    // $academicYearName = $activeAcademicYear['academic_year_name'];
    // $semesterId = $activeSemester['semester_id'];
    // $semesterName = $activeSemester['semester_name'];
    
    // Fetch academic_year_id and semester_id based on names provided
    $get_ay_id_sql = "SELECT academic_year_id FROM academic_years WHERE academic_year_name = :academic_year_name";
    $stmt_ay_id = $conn->prepare($get_ay_id_sql);
    $stmt_ay_id->bindParam(':academic_year_name', $academic_year);
    $stmt_ay_id->execute();
    $ay_row = $stmt_ay_id->fetch(PDO::FETCH_ASSOC);
    if (!$ay_row || !isset($ay_row['academic_year_id'])) {
        http_response_code(400);
        echo json_encode(["message" => "Academic year not found."]);
        exit;
    }
    $academicYearId = $ay_row['academic_year_id'];

    $get_sem_id_sql = "SELECT semester_id FROM semesters WHERE semester_name = :semester_name";
    $stmt_sem_id = $conn->prepare($get_sem_id_sql);
    $stmt_sem_id->bindParam(':semester_name', $semester);
    $stmt_sem_id->execute();
    $sem_row = $stmt_sem_id->fetch(PDO::FETCH_ASSOC);
    if (!$sem_row || !isset($sem_row['semester_id'])) {
        http_response_code(400);
        echo json_encode(["message" => "Semester not found."]);
        exit;
    }
    $semesterId = $sem_row['semester_id'];

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

    // Prepare a SQL query to select comprehensive student advising profile details
    $query = "SELECT
                COALESCE(s.name, 'N/A') AS student_name,
                COALESCE(s.student_id, 'N/A') AS student_number,
                COALESCE(d.name, 'N/A') AS institute_name,
                COALESCE(sec.name, 'N/A') AS program_year_section,
                COALESCE(sec.name, 'N/A') AS section_name,
                COALESCE(s.enrollment_status::text, 'N/A') AS student_status,
                (SELECT e.name 
                 FROM advised_courses ac
                 JOIN employees e ON ac.advisor_id = e.employee_id
                 JOIN academic_years ay_ac ON ac.academic_year_id = ay_ac.academic_year_id
                 JOIN semesters sem_ac ON ac.semester_id = sem_ac.semester_id
                 WHERE ac.student_id = s.student_id
                 AND ay_ac.academic_year_name = :academic_year
                 AND sem_ac.semester_name = :semester
                 LIMIT 1) AS advisor_name,
                (SELECT COALESCE(SUM(CASE
                                         WHEN cg_sum.remarks IN ('Failed', 'Incomplete', 'Unofficially Dropped', 'Officially Dropped') THEN 0
                                         ELSE (c_sum.unit_lec + c_sum.unit_lab)
                                     END), 0)
                 FROM course_grades cg_sum
                 JOIN courses c_sum ON cg_sum.course_id = c_sum.id
                 INNER JOIN academic_years ay_cg_sum ON cg_sum.academic_year_id = ay_cg_sum.academic_year_id
                 INNER JOIN semesters sem_cg_sum ON cg_sum.semester_id = sem_cg_sum.semester_id
                 WHERE cg_sum.student_id = s.student_id
                   AND ay_cg_sum.academic_year_name = :last_enrollment_academic_year
                   AND sem_cg_sum.semester_name = :last_enrollment_semester
                ) AS total_units_earned,
                :last_enrollment_period AS last_enrollment_period,
                :current_enrollment_period AS current_enrollment_period
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

    // Bind parameters
    $stmt->bindParam(':student_id', $student_id);
    $stmt->bindParam(':last_enrollment_period', $last_enrollment_period_str);
    $stmt->bindParam(':current_enrollment_period', $current_enrollment_period_str);
    $stmt->bindParam(':academic_year', $academic_year);
    $stmt->bindParam(':semester', $semester);

    // Bind new parameters for total_units_earned subquery
    $stmt->bindParam(':last_enrollment_academic_year', $last_enrollment_academic_year);
    $stmt->bindParam(':last_enrollment_semester', $last_enrollment_semester);

    // Execute query
    if ($stmt->execute()) {
        $num = $stmt->rowCount();
        // error_log("Profile query executed successfully. Rows found: " . $num);
        $studentData = []; // Renamed from $groupedAdvisingData for single student

        if ($num > 0) {
            $studentData = $stmt->fetch(PDO::FETCH_ASSOC);
        } else {
            http_response_code(404);
            echo json_encode(array("message" => "No advising data found for this student and period."));
            exit();
        }
    } else {
        $error_info = $stmt->errorInfo();
        http_response_code(500);
        echo json_encode(["message" => "Unable to fetch student profile. Error: " . $error_info[2]]);
        exit();
    }

    // Fetch advised courses for the current student and active academic year/semester
    $advisedCoursesQuery = "SELECT ac.advised_course_id, c.course_code, c.course_title, (c.unit_lec + c.unit_lab) AS units FROM advised_courses ac LEFT JOIN courses c ON ac.course_id = c.id LEFT JOIN academic_years ay ON ac.academic_year_id = ay.academic_year_id LEFT JOIN semesters sem ON ac.semester_id = sem.semester_id WHERE ac.student_id = :student_id AND ay.academic_year_name = :academic_year AND sem.semester_name = :semester ORDER BY c.year_level_id ASC, c.semester_id ASC, c.id ASC";
    $advisedCoursesStmt = $conn->prepare($advisedCoursesQuery);
    $advisedCoursesStmt->bindParam(':student_id', $student_id);
    $advisedCoursesStmt->bindParam(':academic_year', $academic_year);
    $advisedCoursesStmt->bindParam(':semester', $semester);
    $advisedCoursesStmt->execute();
    $studentData['advised_courses'] = $advisedCoursesStmt->fetchAll(PDO::FETCH_ASSOC);

    // Fetch graded courses (all past terms, with units earned logic)
    $gradedCoursesQuery = "SELECT
        cg.id as course_grade_id,
        c.course_code,
        c.course_title,
        CASE
            WHEN cg.remarks IN ('Failed', 'Incomplete', 'Unofficially Dropped', 'Officially Dropped') THEN 0
            ELSE (c.unit_lec + c.unit_lab)
        END AS units_earned,
        cg.transmutation AS grade,
        cg.remarks,
        ay_cg.academic_year_name AS academic_year_name,
        sem_cg.semester_name AS semester_name,
        STRING_AGG(DISTINCT pr.course_code, ', ' ORDER BY pr.course_code) AS prerequisite_code
    FROM students s
    LEFT JOIN courses c ON c.curriculum_id = s.curriculum_id
    INNER JOIN course_grades cg ON cg.student_id = s.student_id AND cg.course_id = c.id
    INNER JOIN academic_years ay_cg ON cg.academic_year_id = ay_cg.academic_year_id
    INNER JOIN semesters sem_cg ON cg.semester_id = sem_cg.semester_id
    LEFT JOIN course_prerequisites cp ON c.id = cp.course_id
    LEFT JOIN courses pr ON cp.prerequisite_course_id = pr.id
    WHERE s.student_id = :student_id
    AND ay_cg.academic_year_name = :last_enrollment_academic_year
    AND sem_cg.semester_name = :last_enrollment_semester
    GROUP BY
        cg.id, c.course_code, c.course_title, cg.transmutation, cg.remarks, ay_cg.academic_year_name, sem_cg.semester_name, c.unit_lec, c.unit_lab, ay_cg.academic_year_id, sem_cg.semester_id, c.year_level_id, c.semester_id, c.id
    ORDER BY c.year_level_id ASC, c.semester_id ASC, c.id ASC";

    $gradedCoursesStmt = $conn->prepare($gradedCoursesQuery);
    $gradedCoursesStmt->bindParam(':student_id', $student_id);
    $gradedCoursesStmt->bindParam(':last_enrollment_academic_year', $last_enrollment_academic_year);
    $gradedCoursesStmt->bindParam(':last_enrollment_semester', $last_enrollment_semester);
    $gradedCoursesStmt->execute();
    $studentData['graded_courses'] = $gradedCoursesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // PDF generation starts here
    $dompdf = new Dompdf\Dompdf();

    $html = '';
    $html .= '<style>';
    $html .= 'body { font-family: Arial, sans-serif; }';
    $html .= '.advising-form { margin-bottom: 30px; }';
    $html .= 'table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }';
    $html .= 'th, td { border: 1px solid #000; padding: 4px; text-align: left; font-size: 10px; }';
    $html .= 'th { background-color: #f2f2f2; }';
    $html .= 'h1, h3 { text-align: center; }';
    $html .= '.student-info p { margin: 2px 0; }';
    $html .= '.new-page { page-break-before: always; }';
    $html .= '</style>';

    $html .= '<div class="advising-form">';
    $html .= '<table>';
    $html .= '<thead>';
    
    $html .= '<tr>';
    $html .= '<th colspan="4" style="width:60%; text-align:left; font-weight:normal;"><strong>Name :</strong> ' . htmlspecialchars($studentData['student_name'] ?? '') . '</th>';
    $html .= '<th colspan="3" style="width:40%; text-align:left; font-weight:normal;"><strong>Student No :</strong> ' . htmlspecialchars($studentData['student_number'] ?? '') . '</th>';
    $html .= '</tr>';
    
    $html .= '<tr>';
    $html .= '<th colspan="2" style="width:30%; text-align:left; font-weight:normal;"><strong>Institute :</strong> ' . htmlspecialchars($studentData['institute_name'] ?? '') . '</th>';
    $html .= '<th colspan="2" style="width:30%; text-align:left; font-weight:normal;"><strong>Program/Year/Section :</strong> ' . htmlspecialchars($studentData['program_year_section'] ?? '') . '</th>';
    $html .= '<th colspan="3" style="width:40%; text-align:left; font-weight:normal;"><strong>Status :</strong> ' . htmlspecialchars($studentData['student_status'] ?? '') . '</th>';
    $html .= '</tr>';
    
    $html .= '<tr>';
    $html .= '<th colspan="4" style="width:60%; text-align:left; font-weight:normal;"><strong>LAST ENROLLMENT :</strong> ' . htmlspecialchars($studentData['last_enrollment_period'] ?? '') . '</th>';
    $html .= '<th colspan="3" style="width:40%; text-align:left; font-weight:normal;"><strong>CURRENT ENROLLMENT :</strong> ' . htmlspecialchars($studentData['current_enrollment_period'] ?? '') . '</th>';
    $html .= '</tr>';
    
    $html .= '<tr>';
    $html .= '<th class="header-label" style="width:12.5%; text-align:center;">Course Code</th>';
    $html .= '<th class="header-label" style="width:25%; text-align:center;">Course Title</th>';
    $html .= '<th class="header-label" style="width:10%; text-align:center;">Units Earned</th>';
    $html .= '<th class="header-label" style="width:12.5%; text-align:center;">Pre-requisite</th>';
    $html .= '<th class="header-label" style="width:15%; text-align:center;">Course Code</th>';
    $html .= '<th class="header-label" style="width:15%; text-align:center;">Course Title</th>';
    $html .= '<th class="header-label" style="width:10%; text-align:center;">Units</th>';
    $html .= '</tr>';
    $html .= '</thead>';
    $html .= '<tbody>';

    $maxRows = max(count($studentData['graded_courses']), count($studentData['advised_courses']));
    for ($i = 0; $i < $maxRows; $i++) {
        $graded = $studentData['graded_courses'][$i] ?? null;
        $advised = $studentData['advised_courses'][$i] ?? null;
        $html .= '<tr>';
        // Graded columns (left)
        $html .= '<td>' . htmlspecialchars($graded['course_code'] ?? '') . '</td>';
        $html .= '<td>' . htmlspecialchars($graded['course_title'] ?? '') . '</td>';
        $html .= '<td style="text-align: center;">' . htmlspecialchars($graded['units_earned'] ?? '0') . '</td>';
        $html .= '<td>' . htmlspecialchars($graded['prerequisite_code'] ?? '') . '</td>';
        // Advised side (right)
        $html .= '<td>' . htmlspecialchars($advised['course_code'] ?? '') . '</td>';
        $html .= '<td>' . htmlspecialchars($advised['course_title'] ?? '') . '</td>';
        $html .= '<td style="text-align: center;">' . htmlspecialchars($advised['units'] ?? '') . '</td>';
        $html .= '</tr>';
    }

    $html .= '</tbody>';
    $html .= '<tfoot>';
    $html .= '<tr>';
    $html .= '<td colspan="3"><strong>Total number of units enrolled:</strong> ' . ($studentData['total_units_earned'] ?? 0) . ' Units</td>';
    $html .= '<td colspan="4"><strong>Total number of units to be enrolled:</strong> ' . array_reduce($studentData['advised_courses'], function($sum, $item) { return $sum + (($item['units'] ?? 0) ?: 0); }, 0) . ' Units</td>';
    $html .= '</tr>';
    $html .= '<tr>';
    $html .= '<td colspan="3"><strong>Student\'s Signature:</strong> </td>';
    $html .= '<td colspan="4"><strong>Adviser\'s Printed Name:</strong> ' . htmlspecialchars(mb_strtoupper($studentData['advisor_name'] ?? 'N/A')) . '</td>';
    $html .= '</tr>';
    $html .= '<tr>';
    $html .= '<td colspan="3"></td>';
    $html .= '<td colspan="4"><strong>Student\'s Printed Name:</strong> ' . htmlspecialchars(mb_strtoupper($studentData['student_name'] ?? 'N/A')) . '</td>';
    $html .= '</tr>';
    $html .= '</tfoot>';
    $html .= '</table>';
    $html .= '</div>'; // End of advising-form

    $dompdf->loadHtml($html);
    $dompdf->setPaper('A4', 'portrait');
    $dompdf->render();

    ob_clean(); // Clean the output buffer before sending the file
    $filename = "Advising_Form_" . htmlspecialchars($student_id) . "_" . htmlspecialchars($academic_year) . "_" . htmlspecialchars($semester) . ".pdf";
    header("Content-Type: application/pdf");
    header("Content-Disposition: attachment;filename=\"" . $filename . "\"");
    header('Cache-Control: max-age=0');
    echo $dompdf->output();
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    header("Content-Type: application/json; charset=UTF-8"); // Ensure JSON header for errors
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    exit();
} catch (Exception $e) { // Catch any other exceptions
    http_response_code(500);
    header("Content-Type: application/json; charset=UTF-8"); // Ensure JSON header for errors
    echo json_encode(array("message" => "Server error: " . $e->getMessage()));
    exit();
}

?>
