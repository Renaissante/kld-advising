<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

ob_start(); // Start output buffering

include_once '../../config/cors.php';
require_once '../../config/database.php';
require_once __DIR__ . '/../../../vendor/autoload.php'; // Composer autoload

// Get filter parameters from GET request
// Remove academic_year and semester from GET, as they will be fetched as active ones
// $academicYear = isset($_GET['academic_year']) ? $_GET['academic_year'] : null;
// $semester = isset($_GET['semester']) ? $_GET['semester'] : null;
$program = isset($_GET['program']) ? $_GET['program'] : null;
$section = isset($_GET['section']) ? $_GET['section'] : null; // Added
$yearLevel = isset($_GET['year_level']) ? $_GET['year_level'] : null; // Added
$searchQuery = isset($_GET['search_query']) ? $_GET['search_query'] : null; // Added
$format = isset($_GET['format']) ? $_GET['format'] : 'pdf'; // default to pdf

// Log received parameters for debugging
error_log("Export request received: Program = " . $program . ", Section = " . $section . ", Year Level = " . $yearLevel . ", Search Query = " . $searchQuery . ", Format = " . $format);

try {
    // Fetch the active academic year and semester
    $activeAcademicYearQuery = "SELECT academic_year_id, academic_year_name FROM academic_years WHERE is_current = TRUE LIMIT 1";
    $activeAcademicYearStmt = $conn->prepare($activeAcademicYearQuery);
    $activeAcademicYearStmt->execute();
    $activeAcademicYear = $activeAcademicYearStmt->fetch(PDO::FETCH_ASSOC);

    $activeSemesterQuery = "SELECT semester_id, semester_name FROM semesters WHERE is_current = TRUE LIMIT 1";
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

    // Fetch advising data based on filters
    $query = "
        SELECT
            s.student_id,
            s.name AS student_name,
            s.student_id AS student_number,
            COALESCE(i.name, 'N/A') AS institute_name,
            CONCAT(COALESCE(p.name, 'N/A'), '/', COALESCE(yl.level, 'N/A'), '/', COALESCE(sec.name, 'N/A')) AS program_year_section,
            COALESCE(sec.name, 'N/A') AS section_name,
            s.status AS student_status,
            ay.academic_year_name,
            sem.semester_name,
            (SELECT COALESCE(SUM(c_units.unit_lec + c_units.unit_lab), 0)
             FROM advised_courses ac_units
             JOIN courses c_units ON ac_units.course_id = c_units.id
             LEFT JOIN course_grades cg_sum ON ac_units.student_id = cg_sum.student_id AND ac_units.course_id = cg_sum.course_id
             WHERE ac_units.student_id = s.student_id
               AND ac_units.academic_year_id = ay.academic_year_id
               AND ac_units.semester_id = sem.semester_id
               AND cg_sum.remarks = 'Passed') AS total_units_earned,
            -- Determine advising status for the current advising session to filter completed ones
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
            adv_emp.name AS advisor_name
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
        AND EXISTS ( -- Only include students with completed advising forms
            SELECT 1
            FROM advised_courses ac_completed
            WHERE ac_completed.student_id = s.student_id
            AND ac_completed.academic_year_id = ay.academic_year_id
            AND ac_completed.semester_id = sem.semester_id
        )
    ";
    $params = [
        ':active_academic_year_id' => $academicYearId,
        ':active_semester_id' => $semesterId,
    ];

    // Academic year and semester are now hardcoded to active ones, so remove conditional logic
    // if ($academicYear) {
    //     $query .= " AND ay.academic_year_name = :academic_year";
    //     $params[':academic_year'] = $academicYear;
    // }
    // if ($semester) {
    //     $query .= " AND sem.semester_name = :semester";
    //     $params[':semester'] = $semester;
    // }
    if ($program) {
        $query .= " AND p.name = :program";
        $params[':program'] = $program;
    }
    // Add new filter conditions for section, year_level, and search_query
    if ($section) {
        $query .= " AND sec.name = :section";
        $params[':section'] = $section;
    }
    if ($yearLevel) {
        $query .= " AND yl.level = :year_level";
        $params[':year_level'] = $yearLevel;
    }
    if ($searchQuery) {
        $query .= " AND (s.name LIKE :search_query OR s.student_id LIKE :search_query OR adv_emp.name LIKE :search_query)";
        $params[':search_query'] = '%' . $searchQuery . '%';
    }

    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    $advisingData = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Check if data is empty
    if (empty($advisingData)) {
        http_response_code(404);
        header("Content-Type: application/json; charset=UTF-8"); // Ensure JSON header for errors
        echo json_encode(array("message" => "No advising data found for the selected filters."));
        exit();
    }

    // Group data by student for better document generation
    $groupedAdvisingData = [];
    foreach ($advisingData as $row) {
        $studentId = $row['student_id'];
        if (!isset($groupedAdvisingData[$studentId])) {
            $groupedAdvisingData[$studentId] = [
                'student_name' => $row['student_name'],
                'student_number' => $row['student_number'],
                'institute_name' => $row['institute_name'],
                'section_name' => $row['section_name'], // Ensure section_name is available
                'program_year_section' => $row['program_year_section'],
                'student_status' => $row['student_status'],
                'total_units_earned' => $row['total_units_earned'],
                'academic_year_name' => $row['academic_year_name'],
                'semester_name' => $row['semester_name'],
                'advisor_name' => $row['advisor_name'],
                'advised_courses' => []
            ];
        }
        // Fetch advised courses for the current student and active academic year/semester
        $advisedCoursesQuery = "SELECT
                                    c.course_code,
                                    c.course_title,
                                    cg.transmutation AS grade,
                                    cg.remarks AS remarks,
                                    (c.unit_lec + c.unit_lab) AS units,
                                    pr.course_code AS prerequisite_code,
                                    pr.course_title AS prerequisite_title
                                FROM
                                    advised_courses ac
                                JOIN
                                    courses c ON ac.course_id = c.id
                                LEFT JOIN
                                    course_prerequisites cp ON ac.course_id = cp.course_id
                                LEFT JOIN
                                    courses pr ON cp.prerequisite_course_id = pr.id
                                LEFT JOIN
                                    course_grades cg ON ac.student_id = cg.student_id AND ac.course_id = cg.course_id
                                WHERE
                                    ac.student_id = :student_id AND ac.academic_year_id = :academic_year_id AND ac.semester_id = :semester_id";
        $advisedCoursesStmt = $conn->prepare($advisedCoursesQuery);
        $advisedCoursesStmt->bindParam(':student_id', $studentId);
        $advisedCoursesStmt->bindParam(':academic_year_id', $academicYearId);
        $advisedCoursesStmt->bindParam(':semester_id', $semesterId);
        $advisedCoursesStmt->execute();
        $groupedAdvisingData[$studentId]['advised_courses'] = $advisedCoursesStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    if ($format === 'doc') {
        // Clean any output buffer before generating Word file
        if (ob_get_length()) ob_end_clean();
        
        // Generate DOC file using PhpWord
        $phpWord = new \PhpOffice\PhpWord\PhpWord();
        
        // Set default font
        $phpWord->setDefaultFontName('Arial');
        $phpWord->setDefaultFontSize(9);

        foreach ($groupedAdvisingData as $studentId => $studentData) {
            $section = $phpWord->addSection();
            
            // $section->addText('Advising Form', array('size' => 14, 'bold' => true), array('alignment' => \PhpOffice\PhpWord\SimpleType\Jc::CENTER));
            // $section->addTextBreak(1);
    
            // Student Info Table
            $tableStyle = array(
                'borderSize' => 6, 
                'borderColor' => '000000', 
                'width' => 100, 
                'unit' => \PhpOffice\PhpWord\SimpleType\TblWidth::PERCENT
            );
            $cellStyle = array('valign' => 'center');
            $fontStyle = array('size' => 9);
            $boldFontStyle = array('bold' => true, 'size' => 9);
    
            $table = $section->addTable($tableStyle);
    
            // Row 1: Name and Student No
            $table->addRow();
            $cell1 = $table->addCell(5000, $cellStyle);
            $cell1->addText('Name: ' . ($studentData['student_name'] ?? ''), $fontStyle);
            $cell2 = $table->addCell(5000, $cellStyle);
            $cell2->addText('Student No: ' . ($studentData['student_number'] ?? ''), $fontStyle);
    
            // Row 2: Institute, Program/Year/Section
            $table->addRow();
            $cell1 = $table->addCell(5000, $cellStyle);
            $cell1->addText('Institute: ' . ($studentData['institute_name'] ?? ''), $fontStyle);
            $cell2 = $table->addCell(5000, $cellStyle);
            $cell2->addText('Program/Year/Section: ' . ($studentData['program_year_section'] ?? ''), $fontStyle);
    
            // Row 3: Status
            $table->addRow();
            $cell = $table->addCell(10000, array_merge($cellStyle, array('gridSpan' => 2)));
            $cell->addText('Status: ' . ($studentData['student_status'] ?? ''), $fontStyle);
    
            // Row 4: Last Enrollment Period
            $table->addRow();
            $cell = $table->addCell(10000, array_merge($cellStyle, array('gridSpan' => 2)));
            $cell->addText('LAST ENROLLMENT: ' . ($studentData['academic_year_name'] ?? '') . ' ' . ($studentData['semester_name'] ?? ''), $fontStyle);
    
            // Row 5: Current Enrollment Period
            $table->addRow();
            $cell = $table->addCell(10000, array_merge($cellStyle, array('gridSpan' => 2)));
            $cell->addText('CURRENT ENROLLMENT: ' . ($studentData['academic_year_name'] ?? '') . ' ' . ($studentData['semester_name'] ?? ''), $fontStyle);
    
            $section->addTextBreak(1);
    
            // Advised Courses Table
            $table = $section->addTable($tableStyle);
    
            // Header Row for Advised Courses
            $table->addRow();
            $table->addCell(1500, $cellStyle)->addText('Course Code', $boldFontStyle);
            $table->addCell(2500, $cellStyle)->addText('Course Title', $boldFontStyle);
            $table->addCell(1000, $cellStyle)->addText('Grade', $boldFontStyle);
            $table->addCell(1500, $cellStyle)->addText('Pre-requisite', $boldFontStyle);
            $table->addCell(2500, $cellStyle)->addText('Course Code and Title', $boldFontStyle);
            $table->addCell(500, $cellStyle)->addText('Units', $boldFontStyle);
            $table->addCell(1000, $cellStyle)->addText('Adviser\'s Signature', $boldFontStyle);
    
            if (empty($studentData['advised_courses'])) {
                $table->addRow();
                $cell = $table->addCell(10500, array_merge($cellStyle, array('gridSpan' => 7)));
                $cell->addText('No advising records found for this academic year and semester.', $fontStyle, array('alignment' => \PhpOffice\PhpWord\SimpleType\Jc::CENTER));
            } else {
                foreach ($studentData['advised_courses'] as $course) {
                    $table->addRow();
                    $table->addCell(1500, $cellStyle)->addText($course['course_code'] ?? '', $fontStyle);
                    $table->addCell(2500, $cellStyle)->addText($course['course_title'] ?? '', $fontStyle);
                    $table->addCell(1000, $cellStyle)->addText($course['grade'] ?? '', $fontStyle);
                    $prereqText = $course['prerequisite_code'] ? $course['prerequisite_code'] . ' - ' . ($course['prerequisite_title'] ?? '') : 'N/A';
                    $table->addCell(1500, $cellStyle)->addText($prereqText, $fontStyle);
                    $table->addCell(2500, $cellStyle)->addText($course['course_code'] . ' - ' . ($course['course_title'] ?? ''), $fontStyle);
                    $table->addCell(500, $cellStyle)->addText($course['units'] ?? '', $fontStyle);
                    $table->addCell(1000, $cellStyle)->addText('', $fontStyle);
                }
            }
    
            $section->addTextBreak(1);
    
            // Failed Courses Section
            $failedCourses = array_filter($studentData['advised_courses'], function($c) { 
                return ($c['remarks'] ?? '') === 'Failed'; 
            });
            
            $failedTable = $section->addTable($tableStyle);
            $failedTable->addRow();
            $cell = $failedTable->addCell(10500, array_merge($cellStyle, array('gridSpan' => 7)));
            $cell->addText('Failed course/s', $boldFontStyle, array('alignment' => \PhpOffice\PhpWord\SimpleType\Jc::CENTER));
    
            $failedTable->addRow();
            $failedTable->addCell(1500, $cellStyle)->addText('Course Code', $boldFontStyle);
            $failedTable->addCell(2500, $cellStyle)->addText('Course Title', $boldFontStyle);
            $failedTable->addCell(1000, $cellStyle)->addText('Grade', $boldFontStyle);
            $failedTable->addCell(1500, $cellStyle)->addText('Term', $boldFontStyle);
            $failedTable->addCell(2500, $cellStyle)->addText('AY', $boldFontStyle);
            $failedTable->addCell(500, $cellStyle)->addText('', $boldFontStyle);
            $failedTable->addCell(1000, $cellStyle)->addText('', $boldFontStyle);
    
            if (!empty($failedCourses)) {
                foreach ($failedCourses as $failedCourse) {
                    $failedTable->addRow();
                    $failedTable->addCell(1500, $cellStyle)->addText($failedCourse['course_code'] ?? '', $fontStyle);
                    $failedTable->addCell(2500, $cellStyle)->addText($failedCourse['course_title'] ?? '', $fontStyle);
                    $failedTable->addCell(1000, $cellStyle)->addText($failedCourse['grade'] ?? 'N/A', $fontStyle);
                    $failedTable->addCell(1500, $cellStyle)->addText($studentData['semester_name'] ?? '', $fontStyle);
                    $failedTable->addCell(2500, $cellStyle)->addText($studentData['academic_year_name'] ?? '', $fontStyle);
                    $failedTable->addCell(500, $cellStyle)->addText('', $fontStyle);
                    $failedTable->addCell(1000, $cellStyle)->addText('', $fontStyle);
                }
            } else {
                for ($i = 0; $i < 3; $i++) {
                    $failedTable->addRow();
                    $failedTable->addCell(1500, $cellStyle)->addText('', $fontStyle);
                    $failedTable->addCell(2500, $cellStyle)->addText('', $fontStyle);
                    $failedTable->addCell(1000, $cellStyle)->addText('', $fontStyle);
                    $failedTable->addCell(1500, $cellStyle)->addText('', $fontStyle);
                    $failedTable->addCell(2500, $cellStyle)->addText('', $fontStyle);
                    $failedTable->addCell(500, $cellStyle)->addText('', $fontStyle);
                    $failedTable->addCell(1000, $cellStyle)->addText('', $fontStyle);
                }
            }
    
            $section->addTextBreak(1);
    
            // Footer
            $totalUnits = array_reduce($studentData['advised_courses'], function($sum, $item) { 
                return $sum + (($item['units'] ?? 0) ?: 0); 
            }, 0);
            
            $footerTable = $section->addTable($tableStyle);
            $footerTable->addRow();
            $footerTable->addCell(5000, $cellStyle)->addText('Total number of units enrolled: ' . $totalUnits . ' Units', $fontStyle);
            $footerTable->addCell(5000, $cellStyle)->addText('Total number of units to be enrolled: 16 Units', $fontStyle);
    
            $footerTable->addRow();
            $footerTable->addCell(5000, $cellStyle)->addText('Student\'s Signature: ', $fontStyle);
            $advisorName = strtoupper($studentData['advisor_name'] ?? 'N/A');
            $footerTable->addCell(5000, $cellStyle)->addText('Adviser\'s Printed Name: ' . $advisorName, $fontStyle);
    
            $footerTable->addRow();
            $footerTable->addCell(5000, $cellStyle)->addText('', $fontStyle);
            $studentName = strtoupper($studentData['student_name'] ?? 'N/A');
            $footerTable->addCell(5000, $cellStyle)->addText('Student\'s Printed Name: ' . $studentName, $fontStyle);
        }
    
        // Save the document
        $filename = "Advising_Forms_" . date('Ymd_His') . ".docx";
        
        // Clear any output
        while (ob_get_level()) {
            ob_end_clean();
        }
        
        header("Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        header("Content-Disposition: attachment;filename=\"" . $filename . "\"");
        header('Cache-Control: max-age=0');
        header('Pragma: public');
        
        $objWriter = \PhpOffice\PhpWord\IOFactory::createWriter($phpWord, 'Word2007');
        $objWriter->save('php://output');
        exit;

    } elseif ($format === 'pdf') {
        // Generate PDF file using Dompdf
        $dompdf = new Dompdf\Dompdf();

        $html = '';
        $html .= '<style>';
        $html .= 'body { font-family: Arial, sans-serif; }';
        $html .= '.advising-form { margin-bottom: 30px; }'; // Added margin for spacing
        $html .= 'table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }';
        $html .= 'th, td { border: 1px solid #000; padding: 4px; text-align: left; font-size: 10px; }';
        $html .= 'th { background-color: #f2f2f2; }';
        $html .= 'h1, h3 { text-align: center; }';
        $html .= '.student-info p { margin: 2px 0; }';
        $html .= '.new-page { page-break-before: always; }'; // Custom class for page breaks
        $html .= '</style>';

        $formCount = 0;
        foreach ($groupedAdvisingData as $studentId => $studentData) {
            $formCount++;
            if ($formCount > 1 && ($formCount % 2) === 1) {
                $html .= '<div class="new-page"></div>'; // Add a page break before every odd form after the first
            }
            
            // Start of a new advising form for a student
          // Start of a new advising form for a student
         // Start of a new advising form for a student
         $html .= '<div class="advising-form">';

         // Single Combined Table
         $html .= '<table>';
         $html .= '<thead>';
         
         // Student Info Rows
         $html .= '<tr>';
         $html .= '<th colspan="4" style="width:60%; text-align:left; font-weight:normal;"><strong>Name :</strong> ' . htmlspecialchars($studentData['student_name'] ?? '') . '</th>';
         $html .= '<th colspan="3" style="width:40%; text-align:left; font-weight:normal;"><strong>Student No :</strong> ' . htmlspecialchars($studentData['student_number'] ?? '') . '</th>';
         $html .= '</tr>';
         
         $html .= '<tr>';
         $html .= '<th colspan="2" style="width:30%; text-align:left; font-weight:normal;"><strong>Institute :</strong> ' . htmlspecialchars($studentData['institute_name'] ?? '') . '</th>';
         $html .= '<th colspan="2" style="width:30%; text-align:left; font-weight:normal;"><strong>Program/Year/Section :</strong> ' . htmlspecialchars($studentData['section_name'] ?? '') . '</th>';
         $html .= '<th colspan="3" style="width:40%; text-align:left; font-weight:normal;"><strong>Status :</strong> ' . htmlspecialchars($studentData['student_status'] ?? '') . '</th>';
         $html .= '</tr>';
         
         $html .= '<tr>';
         $html .= '<th colspan="4" style="width:60%; text-align:left; font-weight:normal;"><strong>LAST ENROLLMENT :</strong> ' . htmlspecialchars($studentData['academic_year_name'] ?? '') . ' ' . htmlspecialchars($studentData['semester_name'] ?? '') . '</th>';
         $html .= '<th colspan="3" style="width:40%; text-align:left; font-weight:normal;"><strong>CURRENT ENROLLMENT :</strong> ' . htmlspecialchars($studentData['academic_year_name'] ?? '') . ' ' . htmlspecialchars($studentData['semester_name'] ?? '') . '</th>';
         $html .= '</tr>';
         
         // Column Headers
         $html .= '<tr>';
         $html .= '<th class="header-label" style="width:12.5%; text-align:center;">Course Code</th>';
         $html .= '<th class="header-label" style="width:25%; text-align:center;">Course Title</th>';
         $html .= '<th class="header-label" style="width:10%; text-align:center;">Grade</th>';
         $html .= '<th class="header-label" style="width:12.5%; text-align:center;">Pre-requisite</th>';
         $html .= '<th class="header-label" style="width:25%; text-align:center;">Course Code and Title</th>';
         $html .= '<th class="header-label" style="width:5%; text-align:center;">Units</th>';
         $html .= '<th class="header-label" style="width:10%; text-align:center;">Adviser\'s Signature</th>';
         $html .= '</tr>';
         $html .= '</thead>';
            $html .= '<tbody>';

            // Advised Courses Table Body
            if (empty($studentData['advised_courses'])) {
                $html .= '<tr><td colspan="7" style="text-align: center;">No advising records found for this academic year and semester.</td></tr>';
            } else {
                foreach ($studentData['advised_courses'] as $course) {
                    $html .= '<tr>';
                    $html .= '<td>' . htmlspecialchars($course['course_code'] ?? '') . '</td>';
                    $html .= '<td>' . htmlspecialchars($course['course_title'] ?? '') . '</td>';
                    $html .= '<td style="text-align: center;">' . htmlspecialchars($course['grade'] ?? '') . '</td>';
                    $html .= '<td>' . htmlspecialchars($course['prerequisite_code'] ? $course['prerequisite_code'] . ' - ' . ($course['prerequisite_title'] ?? '') : 'N/A') . '</td>';
                    $html .= '<td>' . htmlspecialchars($course['course_code'] . ' - ' . ($course['course_title'] ?? '')) . '</td>';
                    $html .= '<td style="text-align: center;">' . htmlspecialchars($course['units'] ?? '') . '</td>';
                    $html .= '<td></td>'; // Adviser's Signature
                    $html .= '</tr>';
                }
            }

            // Failed Courses Section
            $failedCourses = array_filter($studentData['advised_courses'], function($c) { return ($c['remarks'] ?? '') === 'Failed'; });
            if (!empty($failedCourses)) {
                $html .= '<tr><td colspan="7"><strong>Failed course/s</strong></td></tr>';
                $html .= '<tr>';
                $html .= '<td style="width:12.5%;">Course Code</td>';
                $html .= '<td style="width:25%;">Course Title</td>';
                $html .= '<td style="width:10%;">Grade</td>';
                $html .= '<td style="width:12.5%;">Term</td>';
                $html .= '<td style="width:25%;">AY</td>';
                $html .= '<td style="width:5%;"></td>';
                $html .= '<td style="width:10%;"></td>';
                $html .= '</tr>';
                foreach ($failedCourses as $failedCourse) {
                    $html .= '<tr>';
                    $html .= '<td>' . htmlspecialchars($failedCourse['course_code'] ?? '') . '</td>';
                    $html .= '<td>' . htmlspecialchars($failedCourse['course_title'] ?? '') . '</td>';
                    $html .= '<td style="text-align: center;">' . htmlspecialchars($failedCourse['grade'] ?? 'N/A') . '</td>';
                    $html .= '<td>' . htmlspecialchars($studentData['semester_name'] ?? '') . '</td>'; // Assuming semester name for term
                    $html .= '<td>' . htmlspecialchars($studentData['academic_year_name'] ?? '') . '</td>'; // Assuming academic year for AY
                    $html .= '<td></td>';
                    $html .= '<td></td>';
                    $html .= '</tr>';
                }
            } else {
                // Placeholder rows for Failed courses if none exist (mimicking JSX)
                for ($i = 0; $i < 3; $i++) {
                    $html .= '<tr><td colspan="7">&nbsp;</td></tr>';
                }
            }

            $html .= '</tbody>';
            $html .= '<tfoot>';
            $html .= '<tr>';
            $html .= '<td colspan="3"><strong>Total number of units enrolled:</strong> ' . array_reduce($studentData['advised_courses'], function($sum, $item) { return $sum + (($item['units'] ?? 0) ?: 0); }, 0) . ' Units</td>';
            $html .= '<td colspan="4"><strong>Total number of units to be enrolled:</strong> 16 Units</td>'; // Hardcoded as in JSX
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
        }

        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        ob_clean(); // Clean the output buffer before sending the file
        $filename = "Advising_Forms_" . date('Ymd_His') . ".pdf";
        header("Content-Type: application/pdf");
        header("Content-Disposition: attachment;filename=\"" . $filename . "\"");
        header('Cache-Control: max-age=0');
        echo $dompdf->output();
        exit;

    } else {
        http_response_code(400);
        header("Content-Type: application/json; charset=UTF-8"); // Ensure JSON header for errors
        echo json_encode(array("message" => "Invalid format specified."));
        exit();
    }

} catch (PDOException $e) {
    http_response_code(500);
    header("Content-Type: application/json; charset=UTF-8"); // Ensure JSON header for errors
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    exit(); // Add exit here
} catch (Exception $e) { // Catch any other exceptions
    http_response_code(500);
    header("Content-Type: application/json; charset=UTF-8"); // Ensure JSON header for errors
    echo json_encode(array("message" => "Server error: " . $e->getMessage()));
    exit(); // Add exit here
}

?>
