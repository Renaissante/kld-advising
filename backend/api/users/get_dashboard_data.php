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

session_start();

// Include database configuration
include_once '../../config/database.php';

if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in admin get_dashboard_data.php.");
    echo json_encode(["success" => false, "message" => "Database connection failed."]);
    exit();
}

$adminId = isset($_GET['admin_id']) ? $_GET['admin_id'] : null;

if (!$adminId && isset($_SESSION['user_id'])) {
    $adminId = $_SESSION['user_id'];

    if (isset($_SESSION['user_roles'])) {
        $hasPermission = in_array('admin', $_SESSION['user_roles'], true);

        if (!$hasPermission) {
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "Forbidden: User is not allowed to access admin dashboards."]);
            exit();
        }
    } else {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Forbidden: User roles not found in session."]);
        exit();
    }
}

if (!$adminId) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Unauthorized: Missing admin identifier."]);
    exit();
}

try {
    // Summary metrics
    $totalUsersStmt = $conn->query("SELECT COUNT(*) FROM users");
    $totalUsers = (int)$totalUsersStmt->fetchColumn();

    $programStatusColumnStmt = $conn->query("SELECT 1 FROM information_schema.columns WHERE table_name = 'programs' AND column_name = 'status'");
    $hasProgramStatus = $programStatusColumnStmt && $programStatusColumnStmt->rowCount() > 0;

if ($hasProgramStatus) {
        $activeProgramsStmt = $conn->prepare("SELECT COUNT(*) FROM programs WHERE status = 'active'");
    } else {
        $activeProgramsStmt = $conn->prepare("SELECT COUNT(*) FROM programs");
    }
    $activeProgramsStmt->execute();
    $activePrograms = (int)$activeProgramsStmt->fetchColumn();

    $formatSemesterName = function ($name) {
        $map = [
            'First Semester' => '1st Semester',
            'Second Semester' => '2nd Semester',
            'Third Semester' => '3rd Semester',
            'Fourth Semester' => '4th Semester',
        ];
        return $map[$name] ?? $name;
    };

    $semestersStmt = $conn->prepare("SELECT semester_id, semester_name, status FROM semesters ORDER BY semester_id ASC");
    $semestersStmt->execute();
    $semesters = $semestersStmt->fetchAll(PDO::FETCH_ASSOC);
    $semestersLabel = "Not configured";
    if (count($semesters) === 1) {
        $semestersLabel = $formatSemesterName($semesters[0]['semester_name']);
    } elseif (count($semesters) > 1) {
        $firstSemester = $formatSemesterName($semesters[0]['semester_name']);
        $lastSemester = $formatSemesterName($semesters[count($semesters) - 1]['semester_name']);
        $semestersLabel = $firstSemester . " to " . $lastSemester;
    }

    $yearLevelsStmt = $conn->prepare("SELECT MIN(level) AS min_level, MAX(level) AS max_level FROM year_levels");
    $yearLevelsStmt->execute();
    $yearLevelsRow = $yearLevelsStmt->fetch(PDO::FETCH_ASSOC);
    $yearLevelsLabel = "Not configured";
    if ($yearLevelsRow && $yearLevelsRow['min_level'] !== null && $yearLevelsRow['max_level'] !== null) {
        if ($yearLevelsRow['min_level'] === $yearLevelsRow['max_level']) {
            $yearLevelsLabel = $yearLevelsRow['min_level'];
        } else {
            $yearLevelsLabel = $yearLevelsRow['min_level'] . " to " . $yearLevelsRow['max_level'];
        }
    }

    $summary = [
        "totalUsers" => $totalUsers,
        "activePrograms" => $activePrograms,
        "semestersLabel" => $semestersLabel,
        "yearLevelsLabel" => $yearLevelsLabel,
    ];

    // Current academic year
    $academicYearStmt = $conn->prepare("SELECT academic_year_id, academic_year_name, start_date, end_date, is_current AS status
                                        FROM academic_years
                                        WHERE is_current = TRUE
                                        ORDER BY academic_year_id DESC
                                        LIMIT 1");
    $academicYearStmt->execute();
    $activeAcademicYear = $academicYearStmt->fetch(PDO::FETCH_ASSOC);

    $academicYearData = null;
    if ($activeAcademicYear) {
        $studentsActiveYearStmt = $conn->prepare("SELECT COUNT(DISTINCT st.student_id) AS total_students
                                                  FROM students st
                                                  JOIN sections s ON st.section_id = s.id
                                                  WHERE s.academic_year_id = :academic_year_id");
        $studentsActiveYearStmt->bindParam(':academic_year_id', $activeAcademicYear['academic_year_id'], PDO::PARAM_INT);
        $studentsActiveYearStmt->execute();
        $studentsInActiveYear = (int)$studentsActiveYearStmt->fetchColumn();

        $formatDate = function ($dateValue) {
            if (!$dateValue) {
                return "—";
            }
            try {
                $date = new DateTime($dateValue);
                return $date->format('F j, Y');
            } catch (Exception $e) {
                return $dateValue;
            }
        };

        $academicYearData = [
            "id" => (int)$activeAcademicYear['academic_year_id'],
            "name" => $activeAcademicYear['academic_year_name'],
            "start_date" => $formatDate($activeAcademicYear['start_date']),
            "end_date" => $formatDate($activeAcademicYear['end_date']),
            "status" => $activeAcademicYear['status'],
            "students" => $studentsInActiveYear,
        ];
    }

    // User distribution
    $roleNames = ['faculty', 'programchair', 'student', 'dean'];
    $rolePlaceholders = implode(',', array_map(function($i) { return ':role_' . $i; }, range(0, count($roleNames) - 1)));
    $roleCountsStmt = $conn->prepare("SELECT r.role_name, COUNT(DISTINCT ur.user_id) AS total
                                      FROM roles r
                                      LEFT JOIN user_roles ur ON ur.role_id = r.id
                                      WHERE r.role_name IN ($rolePlaceholders)
                                      GROUP BY r.role_name");
    foreach ($roleNames as $i => $roleName) {
        $roleCountsStmt->bindValue(':role_' . $i, $roleName, PDO::PARAM_STR);
    }
    $roleCountsStmt->execute();
    $roleCountsRaw = $roleCountsStmt->fetchAll(PDO::FETCH_KEY_PAIR);

    $roleDisplayNames = [
        'faculty' => 'Faculty',
        'programchair' => 'Program Chair',
        'student' => 'Student',
        'dean' => 'Dean',
    ];
    $roleColors = [
        'faculty' => '#3b82f6',
        'programchair' => '#10b981',
        'student' => '#ef4444',
        'dean' => '#f59e0b',
    ];

    $userDistribution = [];
    foreach ($roleDisplayNames as $key => $label) {
        $userDistribution[] = [
            "key" => $key,
            "name" => $label,
            "value" => isset($roleCountsRaw[$key]) ? (int)$roleCountsRaw[$key] : 0,
            "color" => $roleColors[$key] ?? "#94a3b8",
        ];
    }

    // Academic programs (student distribution)
    $programEnrollmentStmt = $conn->prepare("SELECT p.id, p.name, COUNT(DISTINCT st.student_id) AS student_total
                                             FROM programs p
                                             LEFT JOIN students st ON st.program_id = p.id
                                             GROUP BY p.id, p.name
                                             ORDER BY student_total DESC, p.name ASC");
    $programEnrollmentStmt->execute();
    $programEnrollment = [];
    while ($row = $programEnrollmentStmt->fetch(PDO::FETCH_ASSOC)) {
        $programEnrollment[] = [
            "name" => $row['name'],
            "students" => (int)$row['student_total'],
        ];
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => [
            "summary" => $summary,
            "academic_year" => $academicYearData,
            "user_distribution" => $userDistribution,
            "program_enrollment" => $programEnrollment,
        ],
    ]);
} catch (PDOException $e) {
    http_response_code(503);
    error_log("Database error in admin get_dashboard_data.php: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    error_log("General error in admin get_dashboard_data.php: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "Server error: " . $e->getMessage()]);
}
?>

