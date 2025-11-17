<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS request (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("Access-Control-Allow-Methods: GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    exit(0);
}

// Start session for user context
session_start();

// Include database configuration
include_once '../../config/database.php';

// Validate database connection
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in get_dashboard_data.php.");
    echo json_encode(["success" => false, "message" => "Database connection failed."]);
    exit();
}

// Resolve faculty ID (query parameter takes precedence for testing)
$facultyId = isset($_GET['faculty_id']) ? $_GET['faculty_id'] : null;

if (!$facultyId && isset($_SESSION['user_id'])) {
    $facultyId = $_SESSION['user_id'];

    if (isset($_SESSION['user_roles'])) {
        $allowedRoles = ['faculty', 'advisor', 'programchair', 'dean'];
        $hasPermission = false;
        foreach ($_SESSION['user_roles'] as $role) {
            if (in_array($role, $allowedRoles)) {
                $hasPermission = true;
                break;
            }
        }

        if (!$hasPermission) {
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "Forbidden: User is not allowed to access faculty dashboards."]);
            exit();
        }
    } else {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Forbidden: User roles not found in session."]);
        exit();
    }
}

if (!$facultyId) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Unauthorized: Missing faculty identifier."]);
    exit();
}

$academicYearId = isset($_GET['academic_year_id']) ? (int)$_GET['academic_year_id'] : null;
$semesterId = isset($_GET['semester_id']) ? (int)$_GET['semester_id'] : null;

try {
    // Fallback to active academic year if not provided
    if (!$academicYearId) {
        $activeAyStmt = $conn->prepare("SELECT academic_year_id FROM academic_years WHERE status = 'active' LIMIT 1");
        $activeAyStmt->execute();
        $activeAy = $activeAyStmt->fetch(PDO::FETCH_ASSOC);
        if ($activeAy) {
            $academicYearId = (int)$activeAy['academic_year_id'];
        }
    }

    // Fallback to active semester if not provided
    if (!$semesterId) {
        $activeSemStmt = $conn->prepare("SELECT semester_id FROM semesters WHERE status = 'active' LIMIT 1");
        $activeSemStmt->execute();
        $activeSem = $activeSemStmt->fetch(PDO::FETCH_ASSOC);
        if ($activeSem) {
            $semesterId = (int)$activeSem['semester_id'];
        }
    }

    if (!$academicYearId || !$semesterId) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Missing academic year or semester identifier."]);
        exit();
    }

    // -----------------------------
    // Advising Progress by Section
    // -----------------------------
    $sectionsQuery = "
        SELECT
            s.id AS section_id,
            s.name AS section_name,
            COALESCE(p.name, '') AS program_name,
            COALESCE(yl.level, '') AS year_level,
            COUNT(DISTINCT st.student_id) AS total_students,
            COUNT(DISTINCT CASE WHEN ac.student_id IS NOT NULL THEN st.student_id END) AS advised_students
        FROM section_advisors sa
        JOIN sections s ON sa.section_id = s.id
        LEFT JOIN programs p ON s.program_id = p.id
        LEFT JOIN year_levels yl ON s.year_level_id = yl.id
        LEFT JOIN students st ON st.section_id = s.id
        LEFT JOIN advised_courses ac
            ON ac.student_id = st.student_id
            AND ac.academic_year_id = :academic_year_id
            AND ac.semester_id = :semester_id
        WHERE sa.advisor_id = :faculty_id
            AND s.academic_year_id = :academic_year_id
            AND s.semester_id = :semester_id
            AND s.status = 'active'
        GROUP BY s.id, s.name, p.name, yl.level
        ORDER BY s.name ASC
    ";

    $stmtSections = $conn->prepare($sectionsQuery);
    if ($stmtSections === false) {
        throw new PDOException("Failed to prepare sections query: " . implode(" - ", $conn->errorInfo()));
    }
    $stmtSections->bindParam(':faculty_id', $facultyId);
    $stmtSections->bindParam(':academic_year_id', $academicYearId, PDO::PARAM_INT);
    $stmtSections->bindParam(':semester_id', $semesterId, PDO::PARAM_INT);
    $stmtSections->execute();
    $sectionsRaw = $stmtSections->fetchAll(PDO::FETCH_ASSOC);

    $advisingData = [];
    foreach ($sectionsRaw as $row) {
        $totalStudents = (int)$row['total_students'];
        $advisedStudents = (int)$row['advised_students'];
        $pendingStudents = max($totalStudents - $advisedStudents, 0);

        $advisingData[] = [
            "section_id" => (int)$row['section_id'],
            "section" => $row['section_name'],
            "program" => $row['program_name'],
            "year_level" => $row['year_level'],
            "total_students" => $totalStudents,
            "advised_students" => $advisedStudents,
            "pending_students" => $pendingStudents
        ];
    }

    // -----------------------------
    // Grades Progress by Course
    // -----------------------------
    $coursesQuery = "
        SELECT
            c.id AS course_id,
            c.course_code,
            c.course_title,
            COUNT(DISTINCT st.student_id) AS total_students,
            COUNT(DISTINCT CASE WHEN cg.student_id IS NOT NULL THEN st.student_id END) AS graded_students
        FROM section_faculty sf
        JOIN sections s ON sf.section_id = s.id
        JOIN courses c ON sf.course_id = c.id
        LEFT JOIN students st ON st.section_id = s.id
        LEFT JOIN course_grades cg
            ON cg.student_id = st.student_id
            AND cg.course_id = c.id
        WHERE sf.faculty_id = :faculty_id
            AND sf.status = 'active'
            AND s.status = 'active'
            AND s.academic_year_id = :academic_year_id
            AND s.semester_id = :semester_id
        GROUP BY c.id, c.course_code, c.course_title
        ORDER BY c.course_code ASC, c.course_title ASC
    ";

    $stmtCourses = $conn->prepare($coursesQuery);
    if ($stmtCourses === false) {
        throw new PDOException("Failed to prepare courses query: " . implode(" - ", $conn->errorInfo()));
    }
    $stmtCourses->bindParam(':faculty_id', $facultyId);
    $stmtCourses->bindParam(':academic_year_id', $academicYearId, PDO::PARAM_INT);
    $stmtCourses->bindParam(':semester_id', $semesterId, PDO::PARAM_INT);
    $stmtCourses->execute();
    $coursesRaw = $stmtCourses->fetchAll(PDO::FETCH_ASSOC);

    $gradesData = [];
    foreach ($coursesRaw as $row) {
        $totalStudents = (int)$row['total_students'];
        $gradedStudents = (int)$row['graded_students'];
        $pendingStudents = max($totalStudents - $gradedStudents, 0);

        $gradesData[] = [
            "course_id" => (int)$row['course_id'],
            "subject" => $row['course_code'] ?: $row['course_title'],
            "course_code" => $row['course_code'],
            "course_title" => $row['course_title'],
            "total_students" => $totalStudents,
            "graded" => $gradedStudents,
            "pendingGrades" => $pendingStudents
        ];
    }

    // -----------------------------
    // Summary Metrics
    // -----------------------------
    $totalSubjects = count($gradesData);
    $totalAdvisees = array_reduce($advisingData, fn($carry, $item) => $carry + $item['total_students'], 0);
    $gradedCount = array_reduce($gradesData, fn($carry, $item) => $carry + $item['graded'], 0);
    $pendingGradesCount = array_reduce($gradesData, fn($carry, $item) => $carry + $item['pendingGrades'], 0);
    $advisedCount = array_reduce($advisingData, fn($carry, $item) => $carry + $item['advised_students'], 0);
    $pendingAdvisingCount = array_reduce($advisingData, fn($carry, $item) => $carry + $item['pending_students'], 0);

    $summary = [
        "totalSubjects" => $totalSubjects,
        "totalAdvisees" => $totalAdvisees,
        "gradedCount" => $gradedCount,
        "pendingGradesCount" => $pendingGradesCount,
        "advisedCount" => $advisedCount,
        "pendingAdvisingCount" => $pendingAdvisingCount
    ];

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => [
            "summary" => $summary,
            "grades" => $gradesData,
            "advising" => $advisingData,
            "metadata" => [
                "academic_year_id" => $academicYearId,
                "semester_id" => $semesterId
            ]
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(503);
    error_log("Database error in get_dashboard_data.php: " . $e->getMessage());
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    error_log("General error in get_dashboard_data.php: " . $e->getMessage());
    echo json_encode([
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ]);
}
?>

