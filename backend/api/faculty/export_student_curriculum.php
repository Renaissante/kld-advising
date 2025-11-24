<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

ob_start(); // Start output buffering

include_once '../../config/cors.php';
require_once '../../config/database.php';
require_once __DIR__ . '/../../../vendor/autoload.php'; // Composer autoload

// Load environment variables from .env file if it exists (local development)
$envPath = __DIR__ . '/../../..';
if (file_exists($envPath . '/.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable($envPath);
    $dotenv->safeLoad();
}

// Get filter parameters from GET request
$student_id = isset($_GET['student_id']) ? trim($_GET['student_id'], '\" ') : die("Missing student_id parameter.");
$academic_year_id = isset($_GET['academic_year_id']) ? trim($_GET['academic_year_id'], '\" ') : die("Missing academic_year_id parameter.");
$semester_id = isset($_GET['semester_id']) ? trim($_GET['semester_id'], '\" ') : die("Missing semester_id parameter.");
$format = 'pdf'; // Force format to PDF

// Template file path - adjust this to your template location
$baseDir = dirname(dirname(__DIR__)); // Go up two levels from /backend/api/faculty to /backend
$templatePath = $baseDir . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'Curriculum-Data-Science-Track-Batch-2022-2023-For-Incoming-2nd-Year-1.docx';

error_log("Constructed template path: " . $templatePath);

try {
    // Check if template exists
    if (!file_exists($templatePath)) {
        http_response_code(500);
        echo json_encode(array("message" => "Template file not found at: " . $templatePath));
        exit();
    }

    // Lookup student_id (string) to get internal ID (int)
    $get_student_internal_id_sql = "SELECT id, program_id, department_id, section_id, curriculum_id FROM students WHERE student_id = :student_id_str";
    $stmt_lookup_student = $conn->prepare($get_student_internal_id_sql);
    $stmt_lookup_student->bindParam(':student_id_str', $student_id);
    $stmt_lookup_student->execute();
    $student_info = $stmt_lookup_student->fetch(PDO::FETCH_ASSOC);

    if (!$student_info || !isset($student_info['id'])) {
        http_response_code(404);
        echo json_encode(["message" => "Student not found."]);
        exit;
    }
    $student_internal_id = $student_info['id'];
    $program_id = $student_info['program_id'];
    $department_id = $student_info['department_id'];
    $section_id = $student_info['section_id'];
    $curriculum_id = $student_info['curriculum_id'];

    // Fetch Curriculum Academic Year Name
    $get_curriculum_ay_sql = "SELECT ay.academic_year_name 
                              FROM curriculums c
                              JOIN academic_years ay ON c.academic_year_id = ay.academic_year_id
                              WHERE c.curriculum_id = :curriculum_id";
    $stmt_curriculum_ay = $conn->prepare($get_curriculum_ay_sql);
    $stmt_curriculum_ay->bindParam(':curriculum_id', $curriculum_id);
    $stmt_curriculum_ay->execute();
    $curriculum_academic_year_name = $stmt_curriculum_ay->fetchColumn();

    $get_sem_name_sql = "SELECT semester_name FROM semesters WHERE semester_id = :semester_id";
    $stmt_sem_name = $conn->prepare($get_sem_name_sql);
    $stmt_sem_name->bindParam(':semester_id', $semester_id);
    $stmt_sem_name->execute();
    $semester_name = $stmt_sem_name->fetchColumn();

    if (!$curriculum_academic_year_name || !$semester_name) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid curriculum or semester ID."]);
        exit;
    }

    // Fetch student profile data
    $studentProfileQuery = "SELECT
                                s.name AS student_name,
                                s.student_id AS student_number,
                                d.name AS institute_name,
                                p.name AS program_name,
                                sec.name AS program_year_section,
                                sec.name AS section_name,
                                s.enrollment_status::text AS student_status
                            FROM students s
                            LEFT JOIN programs p ON s.program_id = p.id
                            LEFT JOIN departments d ON s.department_id = d.id
                            LEFT JOIN sections sec ON s.section_id = sec.id
                            WHERE s.id = :student_internal_id";
    $stmtProfile = $conn->prepare($studentProfileQuery);
    $stmtProfile->bindParam(':student_internal_id', $student_internal_id, PDO::PARAM_INT);
    $stmtProfile->execute();
    $studentData = $stmtProfile->fetch(PDO::FETCH_ASSOC);

    if (!$studentData) {
        http_response_code(404);
        echo json_encode(["message" => "Student profile data not found."]);
        exit;
    }

    // Fetch credited courses with grades for the student
    $creditedCoursesQuery = "SELECT
                                c.course_code,
                                c.course_title,
                                c.unit_lec,
                                c.unit_lab,
                                c.hour_lec,
                                c.hour_lab,
                                (c.unit_lec + c.unit_lab) AS units,
                                cg.transmutation AS grade,
                                cg.is_verified,
                                COALESCE(STRING_AGG(DISTINCT pr.course_code, ', ' ORDER BY pr.course_code), '') AS prerequisite_code,
                                c.year_level_id,
                                c.semester_id,
                                yl.level AS year_level_name,
                                s.semester_name AS course_semester_name
                            FROM courses c
                            JOIN course_grades cg ON c.id = cg.course_id
                            LEFT JOIN course_prerequisites cp ON c.id = cp.course_id
                            LEFT JOIN courses pr ON cp.prerequisite_course_id = pr.id
                            LEFT JOIN year_levels yl ON c.year_level_id = yl.id
                            LEFT JOIN semesters s ON c.semester_id = s.semester_id
                            WHERE cg.student_id = :student_id_str
                            GROUP BY c.id, c.course_code, c.course_title, c.unit_lec, c.unit_lab, cg.transmutation, cg.is_verified, c.hour_lec, c.hour_lab, c.year_level_id, c.semester_id, yl.level, s.semester_name
                            ORDER BY c.year_level_id, c.semester_id, c.course_code";

    $stmtCredited = $conn->prepare($creditedCoursesQuery);
    $stmtCredited->bindParam(':student_id_str', $student_id);
    $stmtCredited->execute();
    $studentData['credited_courses'] = $stmtCredited->fetchAll(PDO::FETCH_ASSOC);

    // Debug logging
    error_log("=== CREDITED COURSES DEBUG ===");
    error_log("Student ID (string): " . $student_id);
    error_log("Number of credited courses found: " . count($studentData['credited_courses']));

    // Clean output buffer
    if (ob_get_length()) ob_end_clean();

    // Load the template
    $templateProcessor = new \PhpOffice\PhpWord\TemplateProcessor($templatePath);
    
    // Set simple variables for the main profile section
    $templateProcessor->setValue('student_name', $studentData['student_name'] ?? '');
    $templateProcessor->setValue('program', $studentData['program_name'] ?? '');
    $templateProcessor->setValue('academic_year', $curriculum_academic_year_name);

    // Calculate total units (overall)
    $totalCreditedUnits = array_reduce($studentData['credited_courses'], function($sum, $item) { 
        return $sum + (int)($item['units'] ?? 0); 
    }, 0);
    $templateProcessor->setValue('total_credited_units', $totalCreditedUnits);

    // Calculate overall totals for lecture units, lab units, lecture hours, and lab hours
    $overallTotalLecUnits = 0;
    $overallTotalLabUnits = 0;
    $overallTotalLecHours = 0;
    $overallTotalLabHours = 0;

    foreach ($studentData['credited_courses'] as $course) {
        $overallTotalLecUnits += (float)($course['unit_lec'] ?? 0);
        $overallTotalLabUnits += (float)($course['unit_lab'] ?? 0);
        $overallTotalLecHours += (float)($course['hour_lec'] ?? 0);
        $overallTotalLabHours += (float)($course['hour_lab'] ?? 0);
    }

    // Calculate and set overall totals
    $overallTotalUnits = $overallTotalLecUnits + $overallTotalLabUnits;
    $overallTotalHours = $overallTotalLecHours + $overallTotalLabHours;
    
    $templateProcessor->setValue('overall_total_lec_units', number_format($overallTotalLecUnits, 1));
    $templateProcessor->setValue('overall_total_lab_units', number_format($overallTotalLabUnits, 1));
    $templateProcessor->setValue('overall_total_units', number_format($overallTotalUnits, 1));
    $templateProcessor->setValue('overall_total_lec_hours', number_format($overallTotalLecHours, 1));
    $templateProcessor->setValue('overall_total_lab_hours', number_format($overallTotalLabHours, 1));
    $templateProcessor->setValue('overall_total_hours', number_format($overallTotalHours, 1));

    // Helper to get short identifier for year and semester
    function getSemesterIdentifier($yearLevelName, $semesterName) {
        $yearMap = [
            '1st Year' => 'y1',
            '2nd Year' => 'y2',
            '3rd Year' => 'y3',
            '4th Year' => 'y4',
        ];
        $semesterMap = [
            'First Semester' => 's1',
            'Second Semester' => 's2',
            'Summer' => 's3',
        ];
        $yearPart = $yearMap[$yearLevelName] ?? 'y0';
        $semesterPart = $semesterMap[$semesterName] ?? 's0';
        
        return $yearPart . $semesterPart;
    }

    // Group courses by year level and semester
    $groupedBySemester = [];
    foreach ($studentData['credited_courses'] as $course) {
        $key = $course['year_level_name'] . '|' . $course['course_semester_name'];
        if (!isset($groupedBySemester[$key])) {
            $groupedBySemester[$key] = [
                'year_level' => $course['year_level_name'],
                'semester' => $course['course_semester_name'],
                'courses' => [],
                'total_lec_units' => 0,
                'total_lab_units' => 0,
                'total_lec_hours' => 0,
                'total_lab_hours' => 0,
                'total_units' => 0,
                'total_hours' => 0
            ];
        }
        $groupedBySemester[$key]['courses'][] = $course;
        $groupedBySemester[$key]['total_lec_units'] += (float)($course['unit_lec'] ?? 0);
        $groupedBySemester[$key]['total_lab_units'] += (float)($course['unit_lab'] ?? 0);
        $groupedBySemester[$key]['total_lec_hours'] += (float)($course['hour_lec'] ?? 0);
        $groupedBySemester[$key]['total_lab_hours'] += (float)($course['hour_lab'] ?? 0);
        $groupedBySemester[$key]['total_units'] += (float)($course['units'] ?? 0);
        $groupedBySemester[$key]['total_hours'] += (float)($course['hour_lec'] ?? 0) + (float)($course['hour_lab'] ?? 0);
    }

    // Define all possible semesters (matching your template)
    $allSemesters = [
        'y1s1' => ['year_level' => '1st Year', 'semester' => 'First Semester'],
        'y1s2' => ['year_level' => '1st Year', 'semester' => 'Second Semester'],
        'y2s1' => ['year_level' => '2nd Year', 'semester' => 'First Semester'],
        'y2s2' => ['year_level' => '2nd Year', 'semester' => 'Second Semester'],
        'y3s1' => ['year_level' => '3rd Year', 'semester' => 'First Semester'],
        'y3s2' => ['year_level' => '3rd Year', 'semester' => 'Second Semester'],
        'y4s1' => ['year_level' => '4th Year', 'semester' => 'First Semester'],
        'y4s2' => ['year_level' => '4th Year', 'semester' => 'Second Semester'],
    ];

    // Process each semester (including empty ones)
    foreach ($allSemesters as $semesterId => $semesterInfo) {
        error_log("=== PROCESSING SEMESTER: $semesterId ===");
        
        // Set semester header
        $templateProcessor->setValue('semester_title_' . $semesterId, $semesterInfo['year_level'] . ' - ' . $semesterInfo['semester']);
        
        // Check if this semester has courses
        $key = $semesterInfo['year_level'] . '|' . $semesterInfo['semester'];
        $hasCourses = isset($groupedBySemester[$key]);
        
        if ($hasCourses) {
            $semesterData = $groupedBySemester[$key];
            $courses = $semesterData['courses'];
            $rowCount = count($courses);
            
            error_log("Semester $semesterId has $rowCount courses");
            
            if ($rowCount > 0) {
                // Clone row - this creates rows numbered from 1 to $rowCount
                try {
                    $templateProcessor->cloneRow('grade_' . $semesterId, $rowCount);
                    error_log("Successfully cloned row for grade_$semesterId with $rowCount rows");
                } catch (Exception $e) {
                    error_log("ERROR cloning row for grade_$semesterId: " . $e->getMessage());
                    // If cloning fails, just set the first row
                    $course = $courses[0];
                    $templateProcessor->setValue('grade_' . $semesterId, $course['grade'] ?? '');
                    $templateProcessor->setValue('course_code_' . $semesterId, $course['course_code']);
                    $templateProcessor->setValue('course_title_' . $semesterId, $course['course_title']);
                    $templateProcessor->setValue('hour_lec_' . $semesterId, number_format($course['hour_lec'] ?? 0, 1));
                    $templateProcessor->setValue('hour_lab_' . $semesterId, number_format($course['hour_lab'] ?? 0, 1));
                    $templateProcessor->setValue('unit_lec_' . $semesterId, number_format($course['unit_lec'] ?? 0, 1));
                    $templateProcessor->setValue('unit_lab_' . $semesterId, number_format($course['unit_lab'] ?? 0, 1));
                    $templateProcessor->setValue('prerequisite_' . $semesterId, $course['prerequisite_code'] ?? '');
                    continue;
                }
                
                // After cloning, set values for each row
                for ($i = 0; $i < $rowCount; $i++) {
                    $course = $courses[$i];
                    $rowNum = $i + 1; // PHPWord uses 1-based indexing
                    
                    error_log("Setting row $rowNum for $semesterId: " . $course['course_code']);
                    
                    // Set each field with the #rowNum suffix
                    $templateProcessor->setValue('grade_' . $semesterId . '#' . $rowNum, $course['grade'] ?? '');
                    $templateProcessor->setValue('course_code_' . $semesterId . '#' . $rowNum, $course['course_code']);
                    $templateProcessor->setValue('course_title_' . $semesterId . '#' . $rowNum, $course['course_title']);
                    $templateProcessor->setValue('hour_lec_' . $semesterId . '#' . $rowNum, number_format((float)($course['hour_lec'] ?? 0), 1));
                    $templateProcessor->setValue('hour_lab_' . $semesterId . '#' . $rowNum, number_format((float)($course['hour_lab'] ?? 0), 1));
                    $templateProcessor->setValue('unit_lec_' . $semesterId . '#' . $rowNum, number_format((float)($course['unit_lec'] ?? 0), 1));
                    $templateProcessor->setValue('unit_lab_' . $semesterId . '#' . $rowNum, number_format((float)($course['unit_lab'] ?? 0), 1));
                    $templateProcessor->setValue('prerequisite_' . $semesterId . '#' . $rowNum, $course['prerequisite_code'] ?: '');
                }
            }
            
            // Set semester totals
            $templateProcessor->setValue('total_lec_units_' . $semesterId, number_format($semesterData['total_lec_units'], 1));
            $templateProcessor->setValue('total_lab_units_' . $semesterId, number_format($semesterData['total_lab_units'], 1));
            $templateProcessor->setValue('total_units_' . $semesterId, number_format($semesterData['total_units'], 1));
            $templateProcessor->setValue('total_lec_hours_' . $semesterId, number_format($semesterData['total_lec_hours'], 1));
            $templateProcessor->setValue('total_lab_hours_' . $semesterId, number_format($semesterData['total_lab_hours'], 1));
            $templateProcessor->setValue('total_hours_' . $semesterId, number_format($semesterData['total_hours'], 1));
            
        } else {
            // No courses for this semester - set empty values
            error_log("Semester $semesterId has no courses - setting empty values");
            
            // Set single row with empty values
            $templateProcessor->setValue('grade_' . $semesterId, '');
            $templateProcessor->setValue('course_code_' . $semesterId, '');
            $templateProcessor->setValue('course_title_' . $semesterId, '');
            $templateProcessor->setValue('hour_lec_' . $semesterId, '0.0');
            $templateProcessor->setValue('hour_lab_' . $semesterId, '0.0');
            $templateProcessor->setValue('unit_lec_' . $semesterId, '0.0');
            $templateProcessor->setValue('unit_lab_' . $semesterId, '0.0');
            $templateProcessor->setValue('prerequisite_' . $semesterId, '');
            
            // Set totals to zero
            $templateProcessor->setValue('total_lec_units_' . $semesterId, '0.0');
            $templateProcessor->setValue('total_lab_units_' . $semesterId, '0.0');
            $templateProcessor->setValue('total_units_' . $semesterId, '0.0');
            $templateProcessor->setValue('total_lec_hours_' . $semesterId, '0.0');
            $templateProcessor->setValue('total_lab_hours_' . $semesterId, '0.0');
            $templateProcessor->setValue('total_hours_' . $semesterId, '0.0');
        }
    }

    // Save to temporary file
    $tempFile = tempnam(sys_get_temp_dir(), 'credit_courses_') . '.docx';
    $templateProcessor->saveAs($tempFile);
    
    if ($format === 'pdf') {
        while (ob_get_level()) {
            ob_end_clean();
        }
        
        $convertApiSecret = $_ENV['CONVERTAPI_SECRET'] ?? getenv('CONVERTAPI_SECRET');
        
        if (!$convertApiSecret || empty($convertApiSecret)) {
            http_response_code(500);
            header("Content-Type: application/json; charset=UTF-8");
            echo json_encode(array("message" => "CONVERTAPI_SECRET not configured."));
            if (file_exists($tempFile)) unlink($tempFile);
            exit();
        }
        
        $convertApiSecret = trim($convertApiSecret);
        
        try {
            \ConvertApi\ConvertApi::setApiCredentials($convertApiSecret);
            
            $result = \ConvertApi\ConvertApi::convert('pdf', [
                'File' => $tempFile,
            ], 'docx');
            
            $pdfFile = sys_get_temp_dir() . '/converted_credit_courses_' . uniqid() . '.pdf';
            $result->getFile()->save($pdfFile);
            
            if (!file_exists($pdfFile) || filesize($pdfFile) <= 100) {
                throw new Exception("PDF file was not created or is too small.");
            }
            
            $filename = "Credit_Courses_" . $student_id . "_" . $curriculum_academic_year_name . "_" . $semester_name . ".pdf";
            
            header("Content-Type: application/pdf");
            header("Content-Disposition: attachment; filename=\"" . $filename . "\"");
            header("Content-Length: " . filesize($pdfFile));
            header('Cache-Control: max-age=0');
            header('Pragma: public');
            
            readfile($pdfFile);
            
            unlink($pdfFile);
            unlink($tempFile);
            
            exit;
            
        } catch (Exception $e) {
            http_response_code(500);
            header("Content-Type: application/json; charset=UTF-8");
            echo json_encode(array("message" => "PDF conversion failed: " . $e->getMessage()));
            if (file_exists($tempFile)) unlink($tempFile);
            exit();
        }
    } else {
        $filename = "Credit_Courses_" . $student_id . "_" . $curriculum_academic_year_name . "_" . $semester_name . ".docx";
        
        header("Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        header("Content-Disposition: attachment; filename=\"" . $filename . "\"");
        header("Content-Length: " . filesize($tempFile));
        header('Cache-Control: max-age=0');
        header('Pragma: public');
        
        readfile($tempFile);
        unlink($tempFile);
    }
    
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    exit();
} catch (Exception $e) {
    http_response_code(500);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(array("message" => "Server error: " . $e->getMessage()));
    exit();
}
?>