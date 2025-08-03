<?php
// Include CORS headers
include_once '../../config/cors.php';

// Set headers for content type
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS request (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header("Access-Control-Allow-Methods: GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    exit(0);
}

// Start session to check for logged in user
session_start();

// Include database configuration
include_once '../../config/database.php';

// Check connection
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in get_student_advising_data.php.");
    echo json_encode(array("success" => false, "message" => "Database connection failed."));
    exit();
}

// Get faculty ID - check query parameter first, then session
$facultyId = isset($_GET['faculty_id']) ? $_GET['faculty_id'] : null;

// If no query parameter, check session
if (!$facultyId && isset($_SESSION['user_id'])) {
    $facultyId = $_SESSION['user_id'];

    // Also verify role if available in session
    if (isset($_SESSION['role']) && $_SESSION['role'] !== 'faculty') {
        http_response_code(403);
        echo json_encode(array("success" => false, "message" => "Forbidden: User is not a faculty member"));
        exit();
    }
}

// If still no faculty ID, return unauthorized
if (!$facultyId) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Unauthorized: You must be logged in as faculty"));
    exit();
}

// Get student ID, active AY and Semester IDs from GET parameters
$studentId = isset($_GET['student_id']) ? $_GET['student_id'] : null;
$activeAcademicYearId = isset($_GET['active_academic_year_id']) ? (int)$_GET['active_academic_year_id'] : null;
$activeSemesterId = isset($_GET['active_semester_id']) ? (int)$_GET['active_semester_id'] : null;

// Validate required parameters
if (!$studentId || !$activeAcademicYearId || !$activeSemesterId) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Missing required parameters: student_id, active_academic_year_id, and active_semester_id are required."));
    exit();
}

try {
    // --- 1. Fetch Student's Section Info and Curriculum for Active AY/Sem ---
    // This is needed to determine the student's current year level and semester within the curriculum
    // and to find courses for the next semester/year level.
    // Also verify that the student belongs to a section assigned to this faculty as an ADVISOR
    $studentSectionQuery = "SELECT
                                s.id AS section_id,
                                s.year_level_id AS current_year_level_id,
                                s.semester_id AS current_semester_id,
                                st.curriculum_id
                             FROM students st
                             JOIN sections s ON st.section_id = s.id
                             JOIN section_advisors sa ON s.id = sa.section_id -- Corrected join to section_advisors
                             WHERE st.student_id = :student_id
                             AND s.academic_year_id = :active_academic_year_id
                             AND s.semester_id = :active_semester_id
                             AND sa.advisor_id = :faculty_id -- Corrected condition to check advisor_id
                             LIMIT 1";


    $stmtStudentSection = $conn->prepare($studentSectionQuery);
    if ($stmtStudentSection === false) {
         throw new PDOException("Failed to prepare student section query: " . implode(" - ", $conn->errorInfo()));
    }
    $stmtStudentSection->bindParam(':student_id', $studentId);
    $stmtStudentSection->bindParam(':active_academic_year_id', $activeAcademicYearId);
    $stmtStudentSection->bindParam(':active_semester_id', $activeSemesterId);
    $stmtStudentSection->bindParam(':faculty_id', $facultyId); // Still binding facultyId, but used for advisor_id
    $stmtStudentSection->execute();
    $studentSectionInfo = $stmtStudentSection->fetch(PDO::FETCH_ASSOC);

    if (!$studentSectionInfo) {
        // Student not found in a section for the active AY/Sem assigned to this faculty as an ADVISOR
        http_response_code(404);
        echo json_encode(array("success" => false, "message" => "Student not found in your assigned advising sections for the active academic year/semester.")); // Updated message
        exit();
    }

    $sectionId = $studentSectionInfo['section_id'];
    $currentYearLevelId = $studentSectionInfo['current_year_level_id'];
    $currentSemesterId = $studentSectionInfo['current_semester_id'];
    $curriculumId = $studentSectionInfo['curriculum_id'];

    // --- 2. Check if Advising is Already Completed for this AY/Semester ---
    $advisedCoursesQuery = "SELECT
                                ac.advised_course_id,
                                ac.course_id,
                                c.course_code,
                                c.course_title,
                                (c.unit_lec + c.unit_lab) AS units
                            FROM advised_courses ac
                            JOIN courses c ON ac.course_id = c.id
                            WHERE ac.student_id = :student_id
                              AND ac.academic_year_id = :academic_year_id
                              AND ac.semester_id = :semester_id";

    $stmtAdvisedCourses = $conn->prepare($advisedCoursesQuery);
    if ($stmtAdvisedCourses === false) {
         throw new PDOException("Failed to prepare advised courses query: " . implode(" - ", $conn->errorInfo()));
    }
    $stmtAdvisedCourses->bindParam(':student_id', $studentId);
    $stmtAdvisedCourses->bindParam(':academic_year_id', $activeAcademicYearId);
    $stmtAdvisedCourses->bindParam(':semester_id', $activeSemesterId);
    $stmtAdvisedCourses->execute();
    $advisedCoursesList = $stmtAdvisedCourses->fetchAll(PDO::FETCH_ASSOC);

    $advisingCompleted = count($advisedCoursesList) > 0;

    $fullGradeHistory = []; // Initialize array
    $eligibleCourses = []; // Initialize array
    $gradeHistoryMap = []; // Map course_id to grade entry for quick lookup

    if (!$advisingCompleted) {
        // --- 3. Fetch Student's Complete Grade History (Only if advising is NOT completed) ---
        // This is needed to check prerequisites from any previous semester
        $fullGradeHistoryQuery = "SELECT
                                       cg.id,
                                       cg.midterm,
                                       cg.final,
                                       cg.average,
                                       cg.transmutation,
                                       cg.remarks,
                                       c.id AS course_id,
                                       c.course_code,
                                       c.course_title,
                                       (c.unit_lec + c.unit_lab) AS units,
                                       c.year_level_id,
                                       c.semester_id
                                   FROM course_grades cg
                                   JOIN courses c ON cg.course_id = c.id
                                   WHERE cg.student_id = :student_id";

        $stmtFullGradeHistory = $conn->prepare($fullGradeHistoryQuery);
         if ($stmtFullGradeHistory === false) {
             throw new PDOException("Failed to prepare full grade history query: " . implode(" - ", $conn->errorInfo()));
        }
        $stmtFullGradeHistory->bindParam(':student_id', $studentId);
        $stmtFullGradeHistory->execute();
        $fullGradeHistory = $stmtFullGradeHistory->fetchAll(PDO::FETCH_ASSOC);

        // Create a map for quick lookup by course_id
        foreach ($fullGradeHistory as $grade) {
            $gradeHistoryMap[$grade['course_id']] = $grade;
        }


        // --- 4. Determine Next Semester/Year Level in Curriculum (Only if advising is NOT completed) ---
        // Use the current year level and semester from the active section to find the next in the curriculum sequence
        $nextYearLevelId = $currentYearLevelId;
        $nextSemesterId = null;

        // Get all semesters ordered by ID
        $semestersQuery = "SELECT semester_id FROM semesters ORDER BY semester_id ASC";
        $stmtSemesters = $conn->query($semestersQuery);
        $allSemesters = $stmtSemesters->fetchAll(PDO::FETCH_COLUMN, 0); // Get just the IDs

        $currentSemIndex = array_search($currentSemesterId, $allSemesters);

        if ($currentSemIndex !== false && $currentSemIndex < count($allSemesters) - 1) {
            // If not the last semester, the next semester is the next one in the list
            $nextSemesterId = $allSemesters[$currentSemIndex + 1];
            $nextYearLevelId = $currentYearLevelId; // Stay in the same year level
        } else {
            // If it's the last semester (or not found, though that shouldn't happen if studentSectionInfo is valid)
            // Move to the next year level and the first semester
            $nextSemesterId = $allSemesters[0]; // First semester ID

            // Get all year levels ordered by ID
            $yearLevelsQuery = "SELECT id FROM year_levels ORDER BY id ASC";
            $stmtYearLevels = $conn->query($yearLevelsQuery);
            $allYearLevels = $stmtYearLevels->fetchAll(PDO::FETCH_COLUMN, 0); // Get just the IDs

            $currentYearIndex = array_search($currentYearLevelId, $allYearLevels);

            if ($currentYearIndex !== false && $currentYearIndex < count($allYearLevels) - 1) {
                $nextYearLevelId = $allYearLevels[$currentYearIndex + 1]; // Next year level
            } else {
                // Student is in the last semester of the last year level in the curriculum
                $nextYearLevelId = null; // No next year level in curriculum
                $nextSemesterId = null; // No next semester in curriculum
            }
        }

        // --- 5. Fetch Eligible Courses for Next Semester/Year Level in Curriculum (Only if advising is NOT completed) ---
        if ($curriculumId && $nextYearLevelId !== null && $nextSemesterId !== null) {
            $eligibleCoursesQuery = "SELECT
                                        id,
                                        course_code,
                                        course_title,
                                        (unit_lec + unit_lab) AS units
                                     FROM courses
                                     WHERE curriculum_id = :curriculum_id
                                       AND year_level_id = :next_year_level_id
                                       AND semester_id = :next_semester_id";

            $stmtEligibleCourses = $conn->prepare($eligibleCoursesQuery);
             if ($stmtEligibleCourses === false) {
                 throw new PDOException("Failed to prepare eligible courses query: " . implode(" - ", $conn->errorInfo()));
            }
            $stmtEligibleCourses->bindParam(':curriculum_id', $curriculumId);
            $stmtEligibleCourses->bindParam(':next_year_level_id', $nextYearLevelId);
            $stmtEligibleCourses->bindParam(':next_semester_id', $nextSemesterId);
            $stmtEligibleCourses->execute();
            $eligibleCourses = $stmtEligibleCourses->fetchAll(PDO::FETCH_ASSOC);

            // --- 6. Fetch All Courses in the Student's Curriculum (needed for prerequisite details) ---
            $allCurriculumCoursesQuery = "SELECT
                                              id,
                                              course_code,
                                              course_title
                                          FROM courses
                                          WHERE curriculum_id = :curriculum_id";
            $stmtAllCurriculumCourses = $conn->prepare($allCurriculumCoursesQuery);
            if ($stmtAllCurriculumCourses === false) {
                 throw new PDOException("Failed to prepare all curriculum courses query: " . implode(" - ", $conn->errorInfo()));
            }
            $stmtAllCurriculumCourses->bindParam(':curriculum_id', $curriculumId);
            $stmtAllCurriculumCourses->execute();
            $allCurriculumCourses = $stmtAllCurriculumCourses->fetchAll(PDO::FETCH_ASSOC);

            // Create a map for quick lookup by course_id
            $allCurriculumCoursesMap = [];
            foreach ($allCurriculumCourses as $course) {
                $allCurriculumCoursesMap[$course['id']] = $course;
            }


            // --- 7. Fetch Prerequisite Relationships for Eligible Courses ---
            $prerequisitesMap = []; // Map course_id to array of prerequisite_course_ids
            if (!empty($eligibleCourses)) {
                $eligibleCourseIds = array_column($eligibleCourses, 'id');
                $placeholders = implode(',', array_fill(0, count($eligibleCourseIds), '?'));

                $prerequisitesQuery = "SELECT
                                           course_id,
                                           prerequisite_course_id
                                       FROM course_prerequisites
                                       WHERE course_id IN ($placeholders)";

                $stmtPrerequisites = $conn->prepare($prerequisitesQuery);
                 if ($stmtPrerequisites === false) {
                     throw new PDOException("Failed to prepare prerequisites query: " . implode(" - ", $conn->errorInfo()));
                }
                $stmtPrerequisites->execute($eligibleCourseIds);
                // Fetch all prerequisites and group them by course_id for easier lookup
                $prerequisitesRaw = $stmtPrerequisites->fetchAll(PDO::FETCH_ASSOC);
                foreach ($prerequisitesRaw as $prereq) {
                    $prerequisitesMap[$prereq['course_id']][] = $prereq['prerequisite_course_id'];
                }
            }

            // --- 8. Determine Selectability and Prerequisite Reason for Eligible Courses ---
            foreach ($eligibleCourses as &$course) { // Use reference to modify array in place
                $course['can_select'] = true;
                $course['prerequisite_reason'] = null;

                $prereqIds = $prerequisitesMap[$course['id']] ?? [];

                if (!empty($prereqIds)) {
                    $failedPrereqCodes = [];
                    foreach ($prereqIds as $prereqId) {
                        $gradeEntry = $gradeHistoryMap[$prereqId] ?? null;

                        // Check if prerequisite was taken and passed (transmutation not 5.00 or 0.00)
                        if (!$gradeEntry || (floatval($gradeEntry['transmutation']) === 5.00 || floatval($gradeEntry['transmutation']) === 0.00)) {
                            $course['can_select'] = false;
                            // Find the course code for the failed prerequisite
                            $prereqCourse = $allCurriculumCoursesMap[$prereqId] ?? ['course_code' => 'Unknown Course'];
                            $failedPrereqCodes[] = $prereqCourse['course_code'];
                        }
                    }

                    if (!empty($failedPrereqCodes)) {
                        $course['prerequisite_reason'] = "Failed prerequisite" . (count($failedPrereqCodes) > 1 ? 's' : '') . ": " . implode(', ', $failedPrereqCodes);
                    }
                }
            }
            unset($course); // Unset the reference
        }
    }


    // --- 9. Prepare and Send Response ---
    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "data" => array(
            "full_grade_history" => $fullGradeHistory, // Kept for displaying current grades
            "advising_completed" => $advisingCompleted, // New flag
            "advised_courses" => $advisedCoursesList, // List of advised courses if completed
            "eligible_courses" => $eligibleCourses, // List of eligible courses if NOT completed
            "current_year_level_id" => $currentYearLevelId, // Added current year level ID
            "current_semester_id" => $currentSemesterId // Added current semester ID
        )
    ));

} catch (PDOException $e) {
    http_response_code(503);
    error_log("Database error in get_student_advising_data.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ));
} catch (Exception $e) {
    // Catch other potential errors
    http_response_code(500);
    error_log("General error in get_student_advising_data.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ));
}
?>