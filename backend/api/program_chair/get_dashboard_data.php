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

include_once '../../config/database.php';

if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in program chair dashboard endpoint.");
    echo json_encode(["success" => false, "message" => "Database connection failed."]);
    exit();
}

$programChairId = isset($_GET['program_chair_id']) ? $_GET['program_chair_id'] : null;

if (!$programChairId && isset($_SESSION['user_id'])) {
    $programChairId = $_SESSION['user_id'];
}

if (!$programChairId) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Unauthorized: Missing program chair identifier."]);
    exit();
}

$academicYearId = isset($_GET['academic_year_id']) ? (int)$_GET['academic_year_id'] : null;
$semesterId = isset($_GET['semester_id']) ? (int)$_GET['semester_id'] : null;

try {
    // Determine active academic year if none supplied
    if (!$academicYearId) {
        $activeAyStmt = $conn->prepare("SELECT academic_year_id FROM academic_years WHERE is_current = TRUE LIMIT 1");
        $activeAyStmt->execute();
        $activeAy = $activeAyStmt->fetch(PDO::FETCH_ASSOC);
        if ($activeAy) {
            $academicYearId = (int)$activeAy['academic_year_id'];
        }
    }

    // Determine active semester if none supplied
    if (!$semesterId) {
        $activeSemStmt = $conn->prepare("SELECT semester_id FROM semesters WHERE status = 'active' LIMIT 1"); // Assuming 'status' is still used for semesters
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

    // Determine programs managed by this chair
    $programStmt = $conn->prepare("SELECT program FROM program_chairs WHERE employee_id = :chair_id");
    $programStmt->bindParam(':chair_id', $programChairId);
    $programStmt->execute();
    $programIds = $programStmt->fetchAll(PDO::FETCH_COLUMN);

    if (empty($programIds)) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "No programs found for this program chair."]);
        exit();
    }

    // Build placeholder list for program filtering
    $programPlaceholders = [];
    foreach ($programIds as $index => $programId) {
        $programPlaceholders[] = ":program_$index";
    }
    $programInClause = implode(',', $programPlaceholders);

    $bindProgramParams = function ($stmt) use ($programIds) {
        foreach ($programIds as $index => $programId) {
            $stmt->bindValue(":program_$index", $programId, PDO::PARAM_INT);
        }
    };

    // Summary: Total sections
    $sectionsQuery = "SELECT COUNT(DISTINCT s.id) AS total_sections
                      FROM sections s
                      WHERE s.status = 'active'
                        AND s.academic_year_id = :academic_year_id
                        AND s.semester_id = :semester_id
                        AND s.program_id IN ($programInClause)";
    $sectionsStmt = $conn->prepare($sectionsQuery);
    $bindProgramParams($sectionsStmt);
    $sectionsStmt->bindParam(':academic_year_id', $academicYearId, PDO::PARAM_INT);
    $sectionsStmt->bindParam(':semester_id', $semesterId, PDO::PARAM_INT);
    $sectionsStmt->execute();
    $totalSections = (int)$sectionsStmt->fetchColumn();

    // Total faculty
    $facultyQuery = "SELECT COUNT(DISTINCT sf.faculty_id) AS total_faculty
                     FROM section_faculty sf
                     JOIN sections s ON sf.section_id = s.id
                     WHERE s.academic_year_id = :academic_year_id
                       AND s.semester_id = :semester_id
                       AND s.program_id IN ($programInClause)";
    $facultyStmt = $conn->prepare($facultyQuery);
    $bindProgramParams($facultyStmt);
    $facultyStmt->bindParam(':academic_year_id', $academicYearId, PDO::PARAM_INT);
    $facultyStmt->bindParam(':semester_id', $semesterId, PDO::PARAM_INT);
    $facultyStmt->execute();
    $totalFaculty = (int)$facultyStmt->fetchColumn();

    // Total courses (distinct scheduled course assignments)
    $coursesQuery = "SELECT COUNT(DISTINCT sf.course_id) AS total_courses
                     FROM section_faculty sf
                     JOIN sections s ON sf.section_id = s.id
                     WHERE s.academic_year_id = :academic_year_id
                       AND s.semester_id = :semester_id
                       AND s.program_id IN ($programInClause)";
    $coursesStmt = $conn->prepare($coursesQuery);
    $bindProgramParams($coursesStmt);
    $coursesStmt->bindParam(':academic_year_id', $academicYearId, PDO::PARAM_INT);
    $coursesStmt->bindParam(':semester_id', $semesterId, PDO::PARAM_INT);
    $coursesStmt->execute();
    $totalCourses = (int)$coursesStmt->fetchColumn();

    // Total students
    $studentsQuery = "SELECT COUNT(DISTINCT st.student_id) AS total_students
                      FROM students st
                      JOIN sections s ON st.section_id = s.id
                      WHERE s.academic_year_id = :academic_year_id
                        AND s.semester_id = :semester_id
                        AND s.program_id IN ($programInClause)";
    $studentsStmt = $conn->prepare($studentsQuery);
    $bindProgramParams($studentsStmt);
    $studentsStmt->bindParam(':academic_year_id', $academicYearId, PDO::PARAM_INT);
    $studentsStmt->bindParam(':semester_id', $semesterId, PDO::PARAM_INT);
    $studentsStmt->execute();
    $totalStudents = (int)$studentsStmt->fetchColumn();

    $summary = [
        "totalFaculty" => $totalFaculty,
        "totalStudents" => $totalStudents,
        "totalCourses" => $totalCourses,
        "totalSections" => $totalSections
    ];

    // Top faculty workload
    $workloadQuery = "SELECT e.name AS faculty_name, COUNT(DISTINCT sf.section_id) AS workload
                      FROM section_faculty sf
                      JOIN sections s ON sf.section_id = s.id
                      JOIN employees e ON sf.faculty_id = e.employee_id
                      WHERE s.academic_year_id = :academic_year_id
                        AND s.semester_id = :semester_id
                        AND s.program_id IN ($programInClause)
                      GROUP BY e.employee_id, e.name
                      ORDER BY workload DESC, e.name ASC
                      LIMIT 5";
    $workloadStmt = $conn->prepare($workloadQuery);
    $bindProgramParams($workloadStmt);
    $workloadStmt->bindParam(':academic_year_id', $academicYearId, PDO::PARAM_INT);
    $workloadStmt->bindParam(':semester_id', $semesterId, PDO::PARAM_INT);
    $workloadStmt->execute();
    $topWorkload = [];
    while ($row = $workloadStmt->fetch(PDO::FETCH_ASSOC)) {
        $topWorkload[] = [
            "name" => $row['faculty_name'],
            "workload" => (int)$row['workload']
        ];
    }

    // Faculty assignment distribution
    $assignedSectionsQuery = "SELECT COUNT(DISTINCT s.id) AS assigned_sections
                              FROM sections s
                              WHERE s.status = 'active'
                                AND s.academic_year_id = :academic_year_id
                                AND s.semester_id = :semester_id
                                AND s.program_id IN ($programInClause)
                                AND EXISTS (
                                    SELECT 1 FROM section_faculty sf WHERE sf.section_id = s.id
                                )";
    $assignedStmt = $conn->prepare($assignedSectionsQuery);
    $bindProgramParams($assignedStmt);
    $assignedStmt->bindParam(':academic_year_id', $academicYearId, PDO::PARAM_INT);
    $assignedStmt->bindParam(':semester_id', $semesterId, PDO::PARAM_INT);
    $assignedStmt->execute();
    $assignedSections = (int)$assignedStmt->fetchColumn();
    $unassignedSections = max($totalSections - $assignedSections, 0);

    $facultyAssignment = [
        "assigned" => $assignedSections,
        "notAssigned" => $unassignedSections
    ];

    // Section enrollment grouped by year level
    $enrollmentQuery = "SELECT 
                            COALESCE(yl.level, 'Unspecified Year') AS year_label,
                            s.name AS section_name,
                            COUNT(st.student_id) AS student_count
                        FROM sections s
                        LEFT JOIN year_levels yl ON s.year_level_id = yl.id
                        LEFT JOIN students st ON st.section_id = s.id
                        WHERE s.academic_year_id = :academic_year_id
                          AND s.semester_id = :semester_id
                          AND s.program_id IN ($programInClause)
                        GROUP BY s.id, yl.id, year_label, section_name
                        ORDER BY yl.id ASC, s.name ASC";
    $enrollmentStmt = $conn->prepare($enrollmentQuery);
    $bindProgramParams($enrollmentStmt);
    $enrollmentStmt->bindParam(':academic_year_id', $academicYearId, PDO::PARAM_INT);
    $enrollmentStmt->bindParam(':semester_id', $semesterId, PDO::PARAM_INT);
    $enrollmentStmt->execute();
    $sectionEnrollment = [];
    while ($row = $enrollmentStmt->fetch(PDO::FETCH_ASSOC)) {
        $label = $row['year_label'] ?: 'Unspecified Year';
        if (!isset($sectionEnrollment[$label])) {
            $sectionEnrollment[$label] = [];
        }
        $sectionEnrollment[$label][] = [
            "section" => $row['section_name'],
            "students" => (int)$row['student_count']
        ];
    }

    // Active curriculums info
    $curriculumQuery = "SELECT 
                            c.curriculum_id,
                            c.name,
                            c.status,
                            ay.academic_year_name,
                            COUNT(DISTINCT crs.id) AS subject_count,
                            COUNT(DISTINCT st.student_id) AS student_count
                        FROM curriculums c
                        LEFT JOIN academic_years ay ON c.academic_year_id = ay.academic_year_id
                        LEFT JOIN courses crs ON crs.curriculum_id = c.curriculum_id
                        LEFT JOIN students st ON st.curriculum_id = c.curriculum_id
                        WHERE c.program_id IN ($programInClause)
                        GROUP BY c.curriculum_id, c.name, c.status, ay.academic_year_name
                        ORDER BY c.status DESC, c.name ASC";
    $curriculumStmt = $conn->prepare($curriculumQuery);
    $bindProgramParams($curriculumStmt);
    $curriculumStmt->execute();
    $curriculums = [];
    while ($row = $curriculumStmt->fetch(PDO::FETCH_ASSOC)) {
        $curriculums[] = [
            "id" => (int)$row['curriculum_id'],
            "name" => $row['name'],
            "year" => $row['academic_year_name'],
            "subjects" => (int)$row['subject_count'],
            "students" => (int)$row['student_count'],
            "status" => $row['status']
        ];
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => [
            "summary" => $summary,
            "top_faculty_workload" => $topWorkload,
            "faculty_assignment" => $facultyAssignment,
            "section_enrollment" => $sectionEnrollment,
            "curriculums" => $curriculums,
            "metadata" => [
                "program_ids" => array_map('intval', $programIds),
                "academic_year_id" => $academicYearId,
                "semester_id" => $semesterId
            ]
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(503);
    error_log("Database error in program chair dashboard endpoint: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    error_log("General error in program chair dashboard endpoint: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "Server error: " . $e->getMessage()]);
}
?>

