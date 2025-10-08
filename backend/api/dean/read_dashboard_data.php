<?php
// Include CORS headers
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

require_once '../../config/database.php';

// $conn is assumed to be available globally from database.php

// Get filter parameters from GET request
$selectedYear = isset($_GET['academic_year']) ? $_GET['academic_year'] : null;
$selectedSemester = isset($_GET['semester_name']) ? $_GET['semester_name'] : null;
$selectedProgram = isset($_GET['program_name']) && $_GET['program_name'] !== 'all' ? $_GET['program_name'] : null;

// Initialize data array
$dashboard_data = [
    'academicYears' => [],
    'semesters' => [],
    'programs' => [],
    'activeAcademicYear' => null, // Added for active academic year
    'activeSemester' => null,     // Added for active semester
    'overallStats' => [
        'advisingCompletionRate' => 0,
        'gradingCompletionRate' => 0,
        'totalStudentsAdvised' => 0,
        'totalCoursesGraded' => 0,
        'totalActiveStudents' => 0,
    ],
    'recentActivity' => [],
    'sectionData' => [],
    'programPerformance' => [],
    'advisingStatusBreakdown' => [],
    'gradingStatusBreakdown' => [],
    'advisingStatusByYear' => [],
    'gradingStatusByYear' => [],
    'yearLevels' => [], // Added for year levels
    'sections' => [], // Added for sections
];

// Helper function to get student counts for a section
function getStudentCounts($conn, $section_id) {
    $totalStudents = 0;
    $advisedStudents = 0;
    $gradedStudents = 0;

    // Total students in section
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM student_section_enrollments WHERE section_id = :section_id");
    $stmt->bindParam(':section_id', $section_id);
    $stmt->execute();
    $totalStudents = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

    // Advised students in section
    $stmt = $conn->prepare("SELECT COUNT(DISTINCT ac.student_id) as count FROM advised_courses ac JOIN students s ON ac.student_id = s.student_id JOIN student_section_enrollments sse ON s.id = sse.student_id WHERE sse.section_id = :section_id");
    $stmt->bindParam(':section_id', $section_id);
    $stmt->execute();
    $advisedStudents = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

    // Graded students in section
    $stmt = $conn->prepare("SELECT COUNT(DISTINCT cg.student_id) as count FROM course_grades cg JOIN students s ON cg.student_id = s.student_id JOIN student_section_enrollments sse ON s.id = sse.student_id WHERE sse.section_id = :section_id");
    $stmt->bindParam(':section_id', $section_id);
    $stmt->execute();
    $gradedStudents = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

    return [
        'totalStudents' => $totalStudents,
        'advisedStudents' => $advisedStudents,
        'gradedStudents' => $gradedStudents,
    ];
}

// Helper function to format time (you might want to put this in a separate utility file)
function time_elapsed_string($datetime, $full = false) {
    $now = new DateTime;
    $ago = new DateTime($datetime);
    $diff = $now->diff($ago);

    $string = array();
    if ($diff->y > 0) $string[] = $diff->y . ' year' . ($diff->y > 1 ? 's' : '');
    if ($diff->m > 0) $string[] = $diff->m . ' month' . ($diff->m > 1 ? 's' : '');
    
    // Calculate weeks from days explicitly
    $remainingDays = $diff->d;
    $weeks = floor($remainingDays / 7);
    if ($weeks > 0) {
        $string[] = $weeks . ' week' . ($weeks > 1 ? 's' : '');
        $remainingDays = $remainingDays % 7; // Update remaining days
    }
    
    if ($remainingDays > 0) $string[] = $remainingDays . ' day' . ($remainingDays > 1 ? 's' : '');
    if ($diff->h > 0) $string[] = $diff->h . ' hour' . ($diff->h > 1 ? 's' : '');
    if ($diff->i > 0) $string[] = $diff->i . ' minute' . ($diff->i > 1 ? 's' : '');
    if ($diff->s > 0) $string[] = $diff->s . ' second' . ($diff->s > 1 ? 's' : '');

    if (!$full) $string = array_slice($string, 0, 1);
    return $string ? implode(', ', $string) . ' ago' : 'just now';
}

try {
    // Fetch Academic Years
    $stmt = $conn->prepare("SELECT academic_year_name FROM academic_years ORDER BY academic_year_name DESC");
    $stmt->execute();
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $dashboard_data['academicYears'][] = $row['academic_year_name'];
    }

    // Fetch Semesters
    $stmt = $conn->prepare("SELECT semester_name FROM semesters ORDER BY semester_name DESC");
    $stmt->execute();
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $dashboard_data['semesters'][] = $row['semester_name'];
    }

    // Fetch Active Academic Year
    $stmt = $conn->prepare("SELECT academic_year_id, academic_year_name FROM academic_years WHERE status = 'active' LIMIT 1");
    $stmt->execute();
    $dashboard_data['activeAcademicYear'] = $stmt->fetch(PDO::FETCH_ASSOC);

    // Fetch Active Semester
    $stmt = $conn->prepare("SELECT semester_id, semester_name FROM semesters WHERE status = 'active' LIMIT 1");
    $stmt->execute();
    $dashboard_data['activeSemester'] = $stmt->fetch(PDO::FETCH_ASSOC);

    // Fetch Programs
    $stmt = $conn->prepare("SELECT id, name FROM programs ORDER BY name ASC");
    $stmt->execute();
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $dashboard_data['programs'][] = ['id' => $row['id'], 'name' => $row['name']];
    }

    // Fetch Overall Stats and Section Data
    $total_students_advised_overall = 0;
    $total_students_with_grades_overall = 0;
    $total_sections_with_advising_data = 0;
    $total_sections_with_grading_data = 0;

    $query = "SELECT 
                                s.id as section_id, 
                                s.name as section_name,
                                p.name as program_name,
                                yl.level as year_level,
                                sem.semester_name as semester,
                                ay.academic_year_name as academic_year
                            FROM 
                                sections s
                            JOIN 
                                programs p ON s.program_id = p.id
                            JOIN 
                                year_levels yl ON s.year_level_id = yl.id
                            JOIN 
                                semesters sem ON s.semester_id = sem.semester_id
                            JOIN
                                academic_years ay ON s.academic_year_id = ay.academic_year_id
                            WHERE 1=1";
    $params = [];

    if ($selectedYear) {
        $query .= " AND ay.academic_year_name = :academic_year_name";
        $params[':academic_year_name'] = $selectedYear;
    }
    if ($selectedSemester) {
        $query .= " AND sem.semester_name = :semester_name";
        $params[':semester_name'] = $selectedSemester;
    }
    if ($selectedProgram) {
        $query .= " AND p.name = :program_name";
        $params[':program_name'] = $selectedProgram;
    }

    $query .= " ORDER BY s.name ASC";

    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    $sections = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($sections as $section) {
        $counts = getStudentCounts($conn, $section['section_id']);
        
        $advisingCompletion = $counts['totalStudents'] > 0 ? round(($counts['advisedStudents'] / $counts['totalStudents']) * 100, 2) : 0;
        $gradingCompletion = $counts['totalStudents'] > 0 ? round(($counts['gradedStudents'] / $counts['totalStudents']) * 100, 2) : 0;

        $dashboard_data['sectionData'][] = [
            'section' => $section['section_name'],
            'program' => $section['program_name'],
            'yearLevel' => $section['year_level'],
            'semester' => $section['semester'],
            'academicYear' => $section['academic_year'], // Add academic year
            'totalStudents' => $counts['totalStudents'],
            'advisedStudents' => $counts['advisedStudents'],
            'advisingCompletion' => $advisingCompletion,
            'gradedStudents' => $counts['gradedStudents'],
            'gradingCompletion' => $gradingCompletion,
        ];

        $total_students_advised_overall += $counts['advisedStudents'];
        $total_students_with_grades_overall += $counts['gradedStudents'];
        if ($counts['totalStudents'] > 0) {
            $total_sections_with_advising_data++;
            $total_sections_with_grading_data++;
        }
    }

    $dashboard_data['overallStats']['totalStudentsAdvised'] = $total_students_advised_overall;

    $totalCoursesGradedQuery = "SELECT COUNT(DISTINCT sse.section_id) FROM course_grades cg
                                JOIN students s ON cg.student_id = s.student_id
                                JOIN student_section_enrollments sse ON s.id = sse.student_id
                                JOIN sections sect ON sse.section_id = sect.id
                                JOIN programs p ON s.program_id = p.id
                                JOIN semesters sem ON sect.semester_id = sem.semester_id
                                JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                WHERE 1=1";
    $totalCoursesGradedParams = [];

    if ($selectedYear) {
        $totalCoursesGradedQuery .= " AND ay.academic_year_name = :academic_year_name";
        $totalCoursesGradedParams[':academic_year_name'] = $selectedYear;
    }
    if ($selectedSemester) {
        $totalCoursesGradedQuery .= " AND sem.semester_name = :semester_name";
        $totalCoursesGradedParams[':semester_name'] = $selectedSemester;
    }
    if ($selectedProgram) {
        $totalCoursesGradedQuery .= " AND p.name = :program_name";
        $totalCoursesGradedParams[':program_name'] = $selectedProgram;
    }

    $stmt = $conn->prepare($totalCoursesGradedQuery);
    $stmt->execute($totalCoursesGradedParams);
    $dashboard_data['overallStats']['totalCoursesGraded'] = $stmt->fetchColumn();

    $totalActiveStudentsQuery = "SELECT COUNT(DISTINCT s.id) FROM students s
                                JOIN student_section_enrollments sse ON s.id = sse.student_id
                                JOIN sections sect ON sse.section_id = sect.id
                                JOIN programs p ON s.program_id = p.id
                                JOIN semesters sem ON sect.semester_id = sem.semester_id
                                JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                WHERE 1=1";
    $totalActiveStudentsParams = [];

    if ($selectedYear) {
        $totalActiveStudentsQuery .= " AND ay.academic_year_name = :academic_year_name";
        $totalActiveStudentsParams[':academic_year_name'] = $selectedYear;
    }
    if ($selectedSemester) {
        $totalActiveStudentsQuery .= " AND sem.semester_name = :semester_name";
        $totalActiveStudentsParams[':semester_name'] = $selectedSemester;
    }
    if ($selectedProgram) {
        $totalActiveStudentsQuery .= " AND p.name = :program_name";
        $totalActiveStudentsParams[':program_name'] = $selectedProgram;
    }

    $stmt = $conn->prepare($totalActiveStudentsQuery);
    $stmt->execute($totalActiveStudentsParams);
    $total_active_students_filtered = $stmt->fetchColumn();

    $dashboard_data['overallStats']['totalActiveStudents'] = $total_active_students_filtered;

    $totalAdvisedStudentsQuery = "SELECT COUNT(DISTINCT ac.student_id) FROM advised_courses ac
                                    JOIN students s ON ac.student_id = s.student_id
                                    JOIN student_section_enrollments sse ON s.id = sse.student_id
                                    JOIN sections sect ON sse.section_id = sect.id
                                    JOIN programs p ON s.program_id = p.id
                                    JOIN semesters sem ON sect.semester_id = sem.semester_id
                                    JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                    WHERE 1=1";
    $totalAdvisedStudentsParams = [];

    if ($selectedYear) {
        $totalAdvisedStudentsQuery .= " AND ay.academic_year_name = :academic_year_name";
        $totalAdvisedStudentsParams[':academic_year_name'] = $selectedYear;
    }
    if ($selectedSemester) {
        $totalAdvisedStudentsQuery .= " AND sem.semester_name = :semester_name";
        $totalAdvisedStudentsParams[':semester_name'] = $selectedSemester;
    }
    if ($selectedProgram) {
        $totalAdvisedStudentsQuery .= " AND p.name = :program_name";
        $totalAdvisedStudentsParams[':program_name'] = $selectedProgram;
    }

    $stmt = $conn->prepare($totalAdvisedStudentsQuery);
    $stmt->execute($totalAdvisedStudentsParams);
    $total_unique_students_advised = $stmt->fetchColumn();

    $dashboard_data['overallStats']['advisingCompletionRate'] = $total_active_students_filtered > 0 ? 
        round(($total_unique_students_advised / $total_active_students_filtered) * 100, 2) : 0;

    $totalGradedStudentsQuery = "SELECT COUNT(DISTINCT cg.student_id) FROM course_grades cg
                                JOIN students s ON cg.student_id = s.student_id
                                JOIN student_section_enrollments sse ON s.id = sse.student_id
                                JOIN sections sect ON sse.section_id = sect.id
                                JOIN programs p ON s.program_id = p.id
                                JOIN semesters sem ON sect.semester_id = sem.semester_id
                                JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                WHERE 1=1";
    $totalGradedStudentsParams = [];

    if ($selectedYear) {
        $totalGradedStudentsQuery .= " AND ay.academic_year_name = :academic_year_name";
        $totalGradedStudentsParams[':academic_year_name'] = $selectedYear;
    }
    if ($selectedSemester) {
        $totalGradedStudentsQuery .= " AND sem.semester_name = :semester_name";
        $totalGradedStudentsParams[':semester_name'] = $selectedSemester;
    }
    if ($selectedProgram) {
        $totalGradedStudentsQuery .= " AND p.name = :program_name";
        $totalGradedStudentsParams[':program_name'] = $selectedProgram;
    }

    $stmt = $conn->prepare($totalGradedStudentsQuery);
    $stmt->execute($totalGradedStudentsParams);
    $total_unique_students_graded = $stmt->fetchColumn();

    $dashboard_data['overallStats']['gradingCompletionRate'] = $total_active_students_filtered > 0 ? 
        round(($total_unique_students_graded / $total_active_students_filtered) * 100, 2) : 0;

    // Fetch Program Performance
    $program_performance_raw = [];
    foreach ($dashboard_data['programs'] as $program) {
        $program_id = $program['id'];
        $program_name = htmlspecialchars($program['name']);

        // Create an abbreviated program name for chart display
        $program_abbreviation = preg_replace('/(Bachelor of Science in|of|in|and)/i', '', $program_name);
        $program_abbreviation = preg_replace('/\s+/', ' ', $program_abbreviation); // Remove extra spaces
        $program_abbreviation = trim($program_abbreviation);

        // Total students in program (filtered by academic year and semester)
        $totalProgramStudentsQuery = "SELECT COUNT(DISTINCT s.id) as count FROM students s
                                        JOIN student_section_enrollments sse ON s.id = sse.student_id
                                        JOIN sections sect ON sse.section_id = sect.id
                                        JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                        JOIN semesters sem ON sect.semester_id = sem.semester_id
                                        WHERE s.program_id = :program_id";
        $totalProgramStudentsParams = [':program_id' => $program_id];

        if ($selectedYear) {
            $totalProgramStudentsQuery .= " AND ay.academic_year_name = :academic_year_name";
            $totalProgramStudentsParams[':academic_year_name'] = $selectedYear;
        }
        if ($selectedSemester) {
            $totalProgramStudentsQuery .= " AND sem.semester_name = :semester_name";
            $totalProgramStudentsParams[':semester_name'] = $selectedSemester;
        }

        $stmt = $conn->prepare($totalProgramStudentsQuery);
        $stmt->execute($totalProgramStudentsParams);
        $totalProgramStudents = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        // Advised students in program (filtered by academic year and semester)
        $advisedProgramStudentsQuery = "SELECT COUNT(DISTINCT ac.student_id) as count FROM advised_courses ac
                                            JOIN students s ON ac.student_id = s.student_id
                                            JOIN student_section_enrollments sse ON s.id = sse.student_id
                                            JOIN sections sect ON sse.section_id = sect.id
                                            JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                            JOIN semesters sem ON sect.semester_id = sem.semester_id
                                            WHERE s.program_id = :program_id";
        $advisedProgramStudentsParams = [':program_id' => $program_id];

        if ($selectedYear) {
            $advisedProgramStudentsQuery .= " AND ay.academic_year_name = :academic_year_name";
            $advisedProgramStudentsParams[':academic_year_name'] = $selectedYear;
        }
        if ($selectedSemester) {
            $advisedProgramStudentsQuery .= " AND sem.semester_name = :semester_name";
            $advisedProgramStudentsParams[':semester_name'] = $selectedSemester;
        }
        
        $stmt = $conn->prepare($advisedProgramStudentsQuery);
        $stmt->execute($advisedProgramStudentsParams);
        $advisedProgramStudents = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        // Graded students in program (filtered by academic year and semester)
        $gradedProgramStudentsQuery = "SELECT COUNT(DISTINCT cg.student_id) as count FROM course_grades cg
                                        JOIN students s ON cg.student_id = s.student_id
                                        JOIN student_section_enrollments sse ON s.id = sse.student_id
                                        JOIN sections sect ON sse.section_id = sect.id
                                        JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                        JOIN semesters sem ON sect.semester_id = sem.semester_id
                                        WHERE s.program_id = :program_id";
        $gradedProgramStudentsParams = [':program_id' => $program_id];

        if ($selectedYear) {
            $gradedProgramStudentsQuery .= " AND ay.academic_year_name = :academic_year_name";
            $gradedProgramStudentsParams[':academic_year_name'] = $selectedYear;
        }
        if ($selectedSemester) {
            $gradedProgramStudentsQuery .= " AND sem.semester_name = :semester_name";
            $gradedProgramStudentsParams[':semester_name'] = $selectedSemester;
        }

        $stmt = $conn->prepare($gradedProgramStudentsQuery);
        $stmt->execute($gradedProgramStudentsParams);
        $gradedProgramStudents = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        $advisingRate = $totalProgramStudents > 0 ? round(($advisedProgramStudents / $totalProgramStudents) * 100, 2) : 0;
        $gradingRate = $totalProgramStudents > 0 ? round(($gradedProgramStudents / $totalProgramStudents) * 100, 2) : 0;

        $program_performance_raw[] = [
            'program' => $program_name,
            'id' => $program_id,
            'advisingRate' => $advisingRate,
            'gradingRate' => $gradingRate,
            'programAbbreviation' => $program_abbreviation,
        ];
    }

    // Assign program performance to dashboard data (sorted by program name for chart display)
    usort($program_performance_raw, function($a, $b) {
        return $a['program'] <=> $b['program'];
    });
    $dashboard_data['programPerformance'] = $program_performance_raw;

    // Fetch Year Levels (all)
    $stmt = $conn->prepare("SELECT id, level FROM year_levels ORDER BY level ASC");
    $stmt->execute();
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $dashboard_data['yearLevels'][] = ['id' => $row['id'], 'level' => $row['level']];
    }

    // Fetch Sections (all) - including program and year level for filtering on frontend
    $stmt = $conn->prepare("SELECT 
                                s.id as section_id,
                                s.name as section_name,
                                p.id as program_id,
                                p.name as program_name,
                                yl.id as year_level_id,
                                yl.level as year_level_name
                            FROM 
                                sections s
                            JOIN 
                                programs p ON s.program_id = p.id
                            JOIN 
                                year_levels yl ON s.year_level_id = yl.id
                            ORDER BY s.name ASC");
    $stmt->execute();
    $dashboard_data['sections'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fetch Recent Activity (last 10 entries from audit_trail)
    $auditTrailQuery = "SELECT 
                                at.id, 
                                at.user_id, 
                                u.email as user_name, 
                                at.action, 
                                at.timestamp, 
                                GROUP_CONCAT(DISTINCT r.role_name) as role_name
                            FROM audit_trail at
                            JOIN users u ON at.user_id = u.id
                            JOIN user_roles ur ON u.id = ur.user_id
                            JOIN roles r ON ur.role_id = r.id
                            WHERE 1=1";
    $auditTrailParams = [];

    // Note: Filtering audit_trail by academic year, semester, or program is complex
    // as these are not directly stored in the audit_trail table. This would require
    // joining with other tables based on the 'action' content, which is beyond
    // the scope of simple parameter filtering. For now, recent activity will remain
    // unfiltered by these criteria.

    $auditTrailQuery .= " GROUP BY at.id ORDER BY at.timestamp DESC LIMIT 10";
    $stmt = $conn->prepare($auditTrailQuery);
    $stmt->execute($auditTrailParams);
    $recent_activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($recent_activities as $activity) {
        $type = 'other';
        if (strpos(strtolower($activity['action']), 'advising') !== false) {
            $type = 'advising';
        } elseif (strpos(strtolower($activity['action']), 'grade') !== false) {
            $type = 'grading';
        } elseif (strpos(strtolower($activity['action']), 'update') !== false) {
            $type = 'update';
        }

        $dashboard_data['recentActivity'][] = [
            'id' => $activity['id'], // Use audit_trail.id for unique key
            'user' => $activity['user_name'],
            'action' => $activity['action'],
            'time' => time_elapsed_string($activity['timestamp']),
            'type' => $type,
            'role' => $activity['role_name'], // Add role to activity
            'icon' => '', // This will be handled on the frontend
        ];
    }

    // Fetch Advising and Grading Status Breakdown
    $totalAdvisedStudentsBreakdownQuery = "SELECT COUNT(DISTINCT ac.student_id) FROM advised_courses ac
                                            JOIN students s ON ac.student_id = s.student_id
                                            LEFT JOIN student_section_enrollments sse ON s.id = sse.student_id
                                            LEFT JOIN sections sect ON sse.section_id = sect.id
                                            LEFT JOIN programs p ON s.program_id = p.id
                                            LEFT JOIN semesters sem ON sect.semester_id = sem.semester_id
                                            LEFT JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                            WHERE 1=1";
    $totalAdvisedStudentsBreakdownParams = [];

    if ($selectedYear) {
        $totalAdvisedStudentsBreakdownQuery .= " AND ay.academic_year_name = :academic_year_name";
        $totalAdvisedStudentsBreakdownParams[':academic_year_name'] = $selectedYear;
    }
    if ($selectedSemester) {
        $totalAdvisedStudentsBreakdownQuery .= " AND sem.semester_name = :semester_name";
        $totalAdvisedStudentsBreakdownParams[':semester_name'] = $selectedSemester;
    }
    if ($selectedProgram) {
        $totalAdvisedStudentsBreakdownQuery .= " AND p.name = :program_name";
        $totalAdvisedStudentsBreakdownParams[':program_name'] = $selectedProgram;
    }

    $stmt = $conn->prepare($totalAdvisedStudentsBreakdownQuery);
    $stmt->execute($totalAdvisedStudentsBreakdownParams);
    $total_advised_students = $stmt->fetchColumn();

    $totalPendingAdvisingStudentsQuery = "SELECT COUNT(DISTINCT s.id) FROM students s
                                            LEFT JOIN advised_courses ac ON s.student_id = ac.student_id
                                            LEFT JOIN student_section_enrollments sse ON s.id = sse.student_id
                                            LEFT JOIN sections sect ON sse.section_id = sect.id
                                            LEFT JOIN programs p ON s.program_id = p.id
                                            LEFT JOIN semesters sem ON sect.semester_id = sem.semester_id
                                            LEFT JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                            WHERE ac.student_id IS NULL";
    $totalPendingAdvisingStudentsParams = [];

    if ($selectedYear) {
        $totalPendingAdvisingStudentsQuery .= " AND ay.academic_year_name = :academic_year_name";
        $totalPendingAdvisingStudentsParams[':academic_year_name'] = $selectedYear;
    }
    if ($selectedSemester) {
        $totalPendingAdvisingStudentsQuery .= " AND sem.semester_name = :semester_name";
        $totalPendingAdvisingStudentsParams[':semester_name'] = $selectedSemester;
    }
    if ($selectedProgram) {
        $totalPendingAdvisingStudentsQuery .= " AND p.name = :program_name";
        $totalPendingAdvisingStudentsParams[':program_name'] = $selectedProgram;
    }

    $stmt = $conn->prepare($totalPendingAdvisingStudentsQuery);
    $stmt->execute($totalPendingAdvisingStudentsParams);
    $total_pending_advising_students = $stmt->fetchColumn();

    $dashboard_data['advisingStatusBreakdown'] = [
        ['name' => 'Advised', 'value' => $total_advised_students, 'color' => '#22c55e'],
        ['name' => 'Pending Advising', 'value' => $total_pending_advising_students, 'color' => '#f59e0b'],
    ];

    $totalGradedStudentsBreakdownQuery = "SELECT COUNT(DISTINCT cg.student_id) FROM course_grades cg
                                            JOIN students s ON cg.student_id = s.student_id
                                            LEFT JOIN student_section_enrollments sse ON s.id = sse.student_id
                                            LEFT JOIN sections sect ON sse.section_id = sect.id
                                            LEFT JOIN programs p ON s.program_id = p.id
                                            LEFT JOIN semesters sem ON sect.semester_id = sem.semester_id
                                            LEFT JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                            WHERE 1=1";
    $totalGradedStudentsBreakdownParams = [];

    if ($selectedYear) {
        $totalGradedStudentsBreakdownQuery .= " AND ay.academic_year_name = :academic_year_name";
        $totalGradedStudentsBreakdownParams[':academic_year_name'] = $selectedYear;
    }
    if ($selectedSemester) {
        $totalGradedStudentsBreakdownQuery .= " AND sem.semester_name = :semester_name";
        $totalGradedStudentsBreakdownParams[':semester_name'] = $selectedSemester;
    }
    if ($selectedProgram) {
        $totalGradedStudentsBreakdownQuery .= " AND p.name = :program_name";
        $totalGradedStudentsBreakdownParams[':program_name'] = $selectedProgram;
    }

    $stmt = $conn->prepare($totalGradedStudentsBreakdownQuery);
    $stmt->execute($totalGradedStudentsBreakdownParams);
    $total_graded_students = $stmt->fetchColumn();

    $totalPendingGradesStudentsQuery = "SELECT COUNT(DISTINCT s.id) FROM students s
                                        LEFT JOIN course_grades cg ON s.student_id = cg.student_id
                                        LEFT JOIN student_section_enrollments sse ON s.id = sse.student_id
                                        LEFT JOIN sections sect ON sse.section_id = sect.id
                                        LEFT JOIN programs p ON s.program_id = p.id
                                        LEFT JOIN semesters sem ON sect.semester_id = sem.semester_id
                                        LEFT JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                        WHERE cg.student_id IS NULL";
    $totalPendingGradesStudentsParams = [];

    if ($selectedYear) {
        $totalPendingGradesStudentsQuery .= " AND ay.academic_year_name = :academic_year_name";
        $totalPendingGradesStudentsParams[':academic_year_name'] = $selectedYear;
    }
    if ($selectedSemester) {
        $totalPendingGradesStudentsQuery .= " AND sem.semester_name = :semester_name";
        $totalPendingGradesStudentsParams[':semester_name'] = $selectedSemester;
    }
    if ($selectedProgram) {
        $totalPendingGradesStudentsQuery .= " AND p.name = :program_name";
        $totalPendingGradesStudentsParams[':program_name'] = $selectedProgram;
    }

    $stmt = $conn->prepare($totalPendingGradesStudentsQuery);
    $stmt->execute($totalPendingGradesStudentsParams);
    $total_pending_grades_students = $stmt->fetchColumn();

    $dashboard_data['gradingStatusBreakdown'] = [
        ['name' => 'Graded', 'value' => $total_graded_students, 'color' => '#3b82f6'],
        ['name' => 'Pending Grades', 'value' => $total_pending_grades_students, 'color' => '#ef4444'],
    ];

    // Fetch Advising and Grading Status by Year Level
    $year_levels_data = $conn->query("SELECT id, level FROM year_levels ORDER BY level ASC")->fetchAll(PDO::FETCH_ASSOC);

    foreach ($year_levels_data as $yl) {
        $year_level_id = $yl['id'];
        $year_level_name = $yl['level'];

        // Students in this year level (filtered)
        $totalStudentsInYearQuery = "SELECT COUNT(DISTINCT s.id) FROM students s
                                        LEFT JOIN student_section_enrollments sse ON s.id = sse.student_id
                                        LEFT JOIN sections sect ON sse.section_id = sect.id
                                        LEFT JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                        LEFT JOIN semesters sem ON sect.semester_id = sem.semester_id
                                        LEFT JOIN programs p ON s.program_id = p.id
                                        WHERE s.year_level_id = :year_level_id";
        $totalStudentsInYearParams = [':year_level_id' => $year_level_id];

        if ($selectedYear) {
            $totalStudentsInYearQuery .= " AND ay.academic_year_name = :academic_year_name";
            $totalStudentsInYearParams[':academic_year_name'] = $selectedYear;
        }
        if ($selectedSemester) {
            $totalStudentsInYearQuery .= " AND sem.semester_name = :semester_name";
            $totalStudentsInYearParams[':semester_name'] = $selectedSemester;
        }
        if ($selectedProgram) {
            $totalStudentsInYearQuery .= " AND p.name = :program_name";
            $totalStudentsInYearParams[':program_name'] = $selectedProgram;
        }
        
        $stmt = $conn->prepare($totalStudentsInYearQuery);
        $stmt->execute($totalStudentsInYearParams);
        $totalStudentsInYear = $stmt->fetchColumn();

        // Advised students in this year level (filtered)
        $advisedInYearQuery = "SELECT COUNT(DISTINCT ac.student_id) as count FROM advised_courses ac
                                JOIN students s ON ac.student_id = s.student_id
                                LEFT JOIN student_section_enrollments sse ON s.id = sse.student_id
                                LEFT JOIN sections sect ON sse.section_id = sect.id
                                LEFT JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                LEFT JOIN semesters sem ON sect.semester_id = sem.semester_id
                                LEFT JOIN programs p ON s.program_id = p.id
                                WHERE s.year_level_id = :year_level_id";
        $advisedInYearParams = [':year_level_id' => $year_level_id];

        if ($selectedYear) {
            $advisedInYearQuery .= " AND ay.academic_year_name = :academic_year_name";
            $advisedInYearParams[':academic_year_name'] = $selectedYear;
        }
        if ($selectedSemester) {
            $advisedInYearQuery .= " AND sem.semester_name = :semester_name";
            $advisedInYearParams[':semester_name'] = $selectedSemester;
        }
        if ($selectedProgram) {
            $advisedInYearQuery .= " AND p.name = :program_name";
            $advisedInYearParams[':program_name'] = $selectedProgram;
        }

        $stmt = $conn->prepare($advisedInYearQuery);
        $stmt->execute($advisedInYearParams);
        $advisedInYear = $stmt->fetchColumn();

        // Graded students in this year level (filtered)
        $gradedInYearQuery = "SELECT COUNT(DISTINCT cg.student_id) as count FROM course_grades cg
                                JOIN students s ON cg.student_id = s.student_id
                                LEFT JOIN student_section_enrollments sse ON s.id = sse.student_id
                                LEFT JOIN sections sect ON sse.section_id = sect.id
                                LEFT JOIN academic_years ay ON sect.academic_year_id = ay.academic_year_id
                                LEFT JOIN semesters sem ON sect.semester_id = sem.semester_id
                                LEFT JOIN programs p ON s.program_id = p.id
                                WHERE s.year_level_id = :year_level_id";
        $gradedInYearParams = [':year_level_id' => $year_level_id];

        if ($selectedYear) {
            $gradedInYearQuery .= " AND ay.academic_year_name = :academic_year_name";
            $gradedInYearParams[':academic_year_name'] = $selectedYear;
        }
        if ($selectedSemester) {
            $gradedInYearQuery .= " AND sem.semester_name = :semester_name";
            $gradedInYearParams[':semester_name'] = $selectedSemester;
        }
        if ($selectedProgram) {
            $gradedInYearQuery .= " AND p.name = :program_name";
            $gradedInYearParams[':program_name'] = $selectedProgram;
        }

        $stmt = $conn->prepare($gradedInYearQuery);
        $stmt->execute($gradedInYearParams);
        $gradedInYear = $stmt->fetchColumn();

        $dashboard_data['advisingStatusByYear'][] = [
            'yearLevel' => $year_level_name,
            'advised' => $advisedInYear,
            'pendingAdvising' => $totalStudentsInYear - $advisedInYear,
        ];

        $dashboard_data['gradingStatusByYear'][] = [
            'yearLevel' => $year_level_name,
            'graded' => $gradedInYear,
            'pendingGrades' => $totalStudentsInYear - $gradedInYear,
        ];
    }

    http_response_code(200);
    echo json_encode($dashboard_data);

} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>
