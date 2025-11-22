<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

ob_start(); // Start output buffering

include_once '../../config/cors.php';
require_once '../../config/database.php';
require_once __DIR__ . '/../../../vendor/autoload.php'; // Composer autoload

// Load environment variables from .env file if it exists (local development)
// Current file: backend/api/students/export_advising_form.php
// Need to go up to project root: ../../../
$envPath = __DIR__ . '/../../..';
error_log("Looking for .env at: " . realpath($envPath) . '/.env');
if (file_exists($envPath . '/.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable($envPath);
    $dotenv->safeLoad();
    error_log("✓ Loaded environment from .env file at: " . realpath($envPath . '/.env'));
} else {
    error_log("✗ No .env file found at: " . realpath($envPath) . ' - using system environment variables (Railway)');
}

// Get filter parameters from GET request
$student_id = isset($_GET['student_id']) ? trim($_GET['student_id'], '\" ') : die("Missing student_id parameter.");
$academic_year = isset($_GET['academic_year']) ? trim($_GET['academic_year'], '\" ') : die("Missing academic_year parameter.");
$semester = isset($_GET['semester']) ? trim($_GET['semester'], '\" ') : die("Missing semester parameter.");
$format = 'pdf'; // Force format to PDF for student export

// Template file path - adjust this to your template location
$templatePath = __DIR__ . '/../../templates/KLD_Advising_Form.docx';

// Log received parameters for debugging
error_log("Export request received: Student ID = " . $student_id . ", Academic Year = " . $academic_year . ", Semester = " . $semester . ", Format = " . $format);

try {
    // Check if template exists
    if (!file_exists($templatePath)) {
        http_response_code(500);
        echo json_encode(array("message" => "Template file not found at: " . $templatePath));
        exit();
    }

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
        ? $last_enrollment_semester . ' ' . $last_enrollment_academic_year
        : 'N/A';
    $current_enrollment_period_str = $semester . ' ' . $academic_year;

    // Bind parameters
    $stmt->bindParam(':student_id', $student_id);
    $stmt->bindParam(':last_enrollment_period', $last_enrollment_period_str);
    $stmt->bindParam(':current_enrollment_period', $current_enrollment_period_str);
    $stmt->bindParam(':academic_year', $academic_year);
    $stmt->bindParam(':semester', $semester);
    $stmt->bindParam(':last_enrollment_academic_year', $last_enrollment_academic_year);
    $stmt->bindParam(':last_enrollment_semester', $last_enrollment_semester);

    // Execute query
    if ($stmt->execute()) {
        $num = $stmt->rowCount();
        $studentData = [];

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

    // Fetch advised courses - using same query structure as working file
    $advisedCoursesQuery = "SELECT 
        ac.advised_course_id, 
        c.course_code, 
        c.course_title, 
        (c.unit_lec + c.unit_lab) AS units 
    FROM advised_courses ac 
    LEFT JOIN courses c ON ac.course_id = c.id 
    LEFT JOIN academic_years ay ON ac.academic_year_id = ay.academic_year_id 
    LEFT JOIN semesters sem ON ac.semester_id = sem.semester_id 
    WHERE ac.student_id = :student_id 
        AND ay.academic_year_name = :academic_year 
        AND sem.semester_name = :semester 
    ORDER BY c.year_level_id ASC, c.semester_id ASC, c.id ASC";
    
    $advisedCoursesStmt = $conn->prepare($advisedCoursesQuery);
    $advisedCoursesStmt->bindParam(':student_id', $student_id);
    $advisedCoursesStmt->bindParam(':academic_year', $academic_year);
    $advisedCoursesStmt->bindParam(':semester', $semester);
    $advisedCoursesStmt->execute();
    $studentData['advised_courses'] = $advisedCoursesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Debug: Check raw advised courses data
    error_log("Raw advised courses data: " . json_encode($studentData['advised_courses']));

    // Fetch graded courses - using same query structure as working file
    $gradedCoursesQuery = "SELECT
        cg.id as course_grade_id,
        c.course_code,
        c.course_title,
        (c.unit_lec + c.unit_lab) AS total_units,
        CASE
            WHEN cg.remarks IN ('Failed', 'Incomplete', 'Unofficially Dropped', 'Officially Dropped') OR cg.remarks IS NULL THEN 0
            ELSE (c.unit_lec + c.unit_lab)
        END AS units_earned,
        cg.transmutation AS grade,
        cg.remarks,
        ay_cg.academic_year_name AS academic_year_name,
        sem_cg.semester_name AS semester_name,
        COALESCE(STRING_AGG(DISTINCT pr.course_code, ', ' ORDER BY pr.course_code), '') AS prerequisite_code
    FROM students s
    LEFT JOIN courses c ON c.curriculum_id = s.curriculum_id
    INNER JOIN course_grades cg ON cg.student_id = s.student_id AND cg.course_id = c.id
    INNER JOIN academic_years ay_cg ON cg.academic_year_id = ay_cg.academic_year_id
    INNER JOIN semesters sem_cg ON cg.semester_id = sem_cg.semester_id
    LEFT JOIN course_prerequisites cp ON c.id = cp.course_id
    LEFT JOIN courses pr ON cp.prerequisite_course_id = pr.id
    WHERE s.id = :student_id_int
    AND ay_cg.academic_year_name = :last_enrollment_academic_year
    AND sem_cg.semester_name = :last_enrollment_semester
    GROUP BY
        cg.id, c.course_code, c.course_title, cg.transmutation, cg.remarks, ay_cg.academic_year_name, sem_cg.semester_name, c.unit_lec, c.unit_lab, ay_cg.academic_year_id, sem_cg.semester_id, c.year_level_id, c.semester_id, c.id
    ORDER BY c.year_level_id ASC, c.semester_id ASC, c.id ASC";

    $gradedCoursesStmt = $conn->prepare($gradedCoursesQuery);
    $gradedCoursesStmt->bindParam(':student_id_int', $student_id_int, PDO::PARAM_INT);
    $gradedCoursesStmt->bindParam(':last_enrollment_academic_year', $last_enrollment_academic_year);
    $gradedCoursesStmt->bindParam(':last_enrollment_semester', $last_enrollment_semester);
    $gradedCoursesStmt->execute();
    $studentData['graded_courses'] = $gradedCoursesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Debug: Check raw graded courses data
    error_log("Raw graded courses data: " . json_encode($studentData['graded_courses']));
    
    // Clean output buffer
    if (ob_get_length()) ob_end_clean();

    // Load the template
    $templateProcessor = new \PhpOffice\PhpWord\TemplateProcessor($templatePath);
    
    // Debug: Log what variables are in the template
    error_log("Template variables available: " . json_encode($templateProcessor->getVariables()));
    
    // Set simple variables
    $templateProcessor->setValue('student_name', $studentData['student_name'] ?? '');
    $templateProcessor->setValue('student_number', $studentData['student_number'] ?? '');

    // Abbreviate institute name
    $instituteName = $studentData['institute_name'] ?? '';
    $abbreviatedInstituteName = '';
    if (!empty($instituteName)) {
        $words = explode(' ', $instituteName);
        foreach ($words as $word) {
            if (!in_array(strtolower($word), ['of', 'and', 'the'])) { // Exclude common small words
                $abbreviatedInstituteName .= strtoupper(substr($word, 0, 1));
            }
        }
        if (empty($abbreviatedInstituteName)) { // Fallback if all words were excluded
            $abbreviatedInstituteName = $instituteName;
        }
    }
    $templateProcessor->setValue('institute_name', $abbreviatedInstituteName);

    $templateProcessor->setValue('program_year_section', $studentData['program_year_section'] ?? '');
    $templateProcessor->setValue('section_name', $studentData['section_name'] ?? '');
    $templateProcessor->setValue('student_status', $studentData['student_status'] ?? '');
    $templateProcessor->setValue('last_enrollment_period', $studentData['last_enrollment_period'] ?? '');
    $templateProcessor->setValue('current_enrollment_period', $studentData['current_enrollment_period'] ?? '');
    $templateProcessor->setValue('advisor_name', strtoupper($studentData['advisor_name'] ?? 'N/A'));
    $templateProcessor->setValue('student_name_upper', strtoupper($studentData['student_name'] ?? 'N/A'));
    
    // Define a threshold for smaller font size
    define('TITLE_LENGTH_THRESHOLD', 25);

    // Debug: Log student data
    error_log("Student data being populated: " . json_encode([
        'student_name' => $studentData['student_name'] ?? '',
        'student_number' => $studentData['student_number'] ?? '',
        'graded_courses_count' => count($studentData['graded_courses']),
        'advised_courses_count' => count($studentData['advised_courses'])
    ]));
    
    // Debug: Log sample course data to check units
    if (!empty($studentData['graded_courses'])) {
        error_log("Sample graded course units: " . json_encode([
            'first_course_units' => $studentData['graded_courses'][0]['units_earned'] ?? 'NULL',
            'first_course_code' => $studentData['graded_courses'][0]['course_code'] ?? 'NULL'
        ]));
    }
    if (!empty($studentData['advised_courses'])) {
        error_log("Sample advised course units: " . json_encode([
            'first_course_units' => $studentData['advised_courses'][0]['units'] ?? 'NULL',
            'first_course_code' => $studentData['advised_courses'][0]['course_code'] ?? 'NULL'
        ]));
    }
    
    // Calculate totals
    $totalUnitsEarned = $studentData['total_units_earned'] ?? 0;
    $totalUnitsToBeEnrolled = array_reduce($studentData['advised_courses'], function($sum, $item) { 
        return $sum + (int)($item['units'] ?? 0); 
    }, 0);
    
    $templateProcessor->setValue('total_units_earned', $totalUnitsEarned);
    $templateProcessor->setValue('total_units_to_enroll', $totalUnitsToBeEnrolled);
    
    // Set fixed number of rows (change this number as needed)
    $fixedRows = 12;
    
    // Get actual data count
    $gradedCount = count($studentData['graded_courses']);
    $advisedCount = count($studentData['advised_courses']);
    
    // Use the larger of fixed rows or actual data (in case data exceeds fixed rows)
    $maxGradedRows = max($fixedRows, $gradedCount);
    $maxAdvisedRows = max($fixedRows, $advisedCount);
    
    // Debug: Log row counts
    error_log("Graded courses: $gradedCount, Advised courses: $advisedCount");
    error_log("Max rows - Graded: $maxGradedRows, Advised: $maxAdvisedRows");
    
    // Get all template variables to understand the structure
    $allVars = $templateProcessor->getVariables();
    error_log("All template variables: " . json_encode($allVars));

    // Count how many times each variable appears (to detect if we have 2 tables)
    $varCounts = array_count_values($allVars);
    error_log("Variable counts: " . json_encode($varCounts));

    // Check if we have duplicate tables (gc_code appears more than once in base form)
    $hasDuplicateTables = (isset($varCounts['gc_code']) && $varCounts['gc_code'] > 1);
    error_log("Has duplicate tables: " . ($hasDuplicateTables ? 'YES' : 'NO'));

    // Clone rows - this works for BOTH tables simultaneously
    if ($maxGradedRows > 0) {
        error_log("Cloning gc_code rows: $maxGradedRows");
        $templateProcessor->cloneRow('gc_code', $maxGradedRows);
    }

    if ($maxAdvisedRows > 0) {
        error_log("Cloning ac_code rows: $maxAdvisedRows");
        $templateProcessor->cloneRow('ac_code', $maxAdvisedRows);
    }

    // Check what variables exist after cloning
    error_log("Variables after cloning: " . json_encode($templateProcessor->getVariables()));

    // Now populate the data - setValue replaces ALL occurrences
    for ($i = 0; $i < $maxGradedRows; $i++) {
        $rowNum = $i + 1;
        $graded = $studentData['graded_courses'][$i] ?? null;
        
        // Use the units_earned from the query which already handles the CASE logic
        $units = ($graded !== null && $graded['units_earned'] === 0) ? ' 0' : ($graded ? strval($graded['units_earned']) : '');
        
        error_log("Populating row $rowNum - Code: " . ($graded['course_code'] ?? 'EMPTY') . ", Units: '$units'");

        $gcTitle = $graded['course_title'] ?? '';
        if (strlen($gcTitle) <= TITLE_LENGTH_THRESHOLD) {
            $templateProcessor->setValue("gc_title_normal#$rowNum", $gcTitle);
            $templateProcessor->setValue("gc_title_small#$rowNum", ''); // Ensure the other placeholder is empty
        } else {
            $templateProcessor->setValue("gc_title_small#$rowNum", $gcTitle);
            $templateProcessor->setValue("gc_title_normal#$rowNum", ''); // Ensure the other placeholder is empty
        }

        // This should populate ALL instances of these variables across both tables
        $templateProcessor->setValue("gc_code#$rowNum", $graded['course_code'] ?? '');
        $templateProcessor->setValue("gc_units#$rowNum", $units);
        $templateProcessor->setValue("gc_prereq#$rowNum", $graded['prerequisite_code'] ?? '');
    }

    for ($i = 0; $i < $maxAdvisedRows; $i++) {
        $rowNum = $i + 1;
        $advised = $studentData['advised_courses'][$i] ?? null;
        
        // Use units directly from the query
        $units = ($advised !== null && $advised['units'] === 0) ? ' 0' : ($advised ? strval($advised['units']) : '');
        
        error_log("Populating advised row $rowNum - Code: " . ($advised['course_code'] ?? 'EMPTY') . ", Units: '$units'");
        
        $acTitle = $advised['course_title'] ?? '';
        if (strlen($acTitle) <= TITLE_LENGTH_THRESHOLD) {
            $templateProcessor->setValue("ac_title_normal#$rowNum", $acTitle);
            $templateProcessor->setValue("ac_title_small#$rowNum", '');
        } else {
            $templateProcessor->setValue("ac_title_small#$rowNum", $acTitle);
            $templateProcessor->setValue("ac_title_normal#$rowNum", '');
        }

        // This should populate ALL instances of these variables across both tables
        $templateProcessor->setValue("ac_code#$rowNum", $advised['course_code'] ?? '');
        $templateProcessor->setValue("ac_units#$rowNum", $units);
    }

    // Check what variables are still unresolved
    error_log("Unresolved variables after population: " . json_encode($templateProcessor->getVariables()));
    
    // Save to temporary file
    $tempFile = tempnam(sys_get_temp_dir(), 'advising_') . '.docx';
    $templateProcessor->saveAs($tempFile);
    
    // Debug: Check if temp file was created and has content
    error_log("Temp DOCX file created: " . $tempFile);
    error_log("Temp DOCX file size: " . filesize($tempFile) . " bytes");
    
    if ($format === 'pdf') {
        // Clean output buffer completely
        while (ob_get_level()) {
            ob_end_clean();
        }
        
        // Get ConvertAPI secret
        $convertApiSecret = $_ENV['CONVERTAPI_SECRET'] ?? getenv('CONVERTAPI_SECRET');
        
        // Debug: Log if secret exists (without exposing the actual value)
        error_log("ConvertAPI Secret exists: " . (!empty($convertApiSecret) ? "YES" : "NO"));
        if (!empty($convertApiSecret)) {
            error_log("ConvertAPI Secret length: " . strlen($convertApiSecret));
            error_log("ConvertAPI Secret first 4 chars: " . substr($convertApiSecret, 0, 4) . "...");
        }
        
        if (!$convertApiSecret || empty($convertApiSecret)) {
            http_response_code(500);
            header("Content-Type: application/json; charset=UTF-8");
            echo json_encode(array("message" => "CONVERTAPI_SECRET not configured. Please set it in your .env file."));
            unlink($tempFile);
            exit();
        }
        
        // Trim any whitespace from the secret
        $convertApiSecret = trim($convertApiSecret);
        
        try {
            error_log("Using ConvertAPI for PDF conversion with secret: " . substr($convertApiSecret, 0, 4) . "...");
            
            // Set API credentials (this is the correct way for ConvertAPI PHP library)
            \ConvertApi\ConvertApi::setApiCredentials($convertApiSecret);
            
            error_log("Converting DOCX to PDF via ConvertAPI...");
            
            // Convert DOCX to PDF
            $result = \ConvertApi\ConvertApi::convert('pdf', [
                'File' => $tempFile,
            ], 'docx');
            
            error_log("ConvertAPI conversion completed");
            
            // Save the result to a temporary file
            $pdfFile = sys_get_temp_dir() . '/converted_' . uniqid() . '.pdf';
            $result->getFile()->save($pdfFile);
            
            error_log("PDF file saved to: " . $pdfFile);
            error_log("PDF file size: " . filesize($pdfFile) . " bytes");
            
            if (!file_exists($pdfFile)) {
                throw new Exception("PDF file was not created");
            }
            
            if (filesize($pdfFile) <= 100) {
                throw new Exception("PDF file is too small (" . filesize($pdfFile) . " bytes), likely empty or corrupted");
            }
            
            $filename = "Advising_Form_" . $student_id . "_" . $academic_year . "_" . $semester . ".pdf";
            
            header("Content-Type: application/pdf");
            header("Content-Disposition: attachment; filename=\"" . $filename . "\"");
            header("Content-Length: " . filesize($pdfFile));
            header('Cache-Control: max-age=0');
            header('Pragma: public');
            
            readfile($pdfFile);
            
            // Cleanup
            unlink($pdfFile);
            unlink($tempFile);
            
            error_log("PDF successfully generated with ConvertAPI");
            exit;
            
        } catch (Exception $e) {
            error_log("ConvertAPI error: " . $e->getMessage());
            http_response_code(500);
            header("Content-Type: application/json; charset=UTF-8");
            echo json_encode(array("message" => "PDF conversion failed: " . $e->getMessage()));
            unlink($tempFile);
            exit();
        }
    } else {
        // Return as DOCX
        $filename = "Advising_Form_" . $student_id . "_" . $academic_year . "_" . $semester . ".docx";
        
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