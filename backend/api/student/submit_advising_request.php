<?php

header("Content-Type: application/json");
include_once '../../config/cors.php';
require_once "../../config/database.php";

error_reporting(E_ALL);
ini_set('display_errors', 1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method Not Allowed"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

// Validate input - now only requires student_id and grades array
if (empty($data->student_id) || !isset($data->grades) || !is_array($data->grades)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid input. Required fields: student_id and grades array."]);
    exit;
}

$studentId = $data->student_id;
$currentGrades = $data->grades; // Grades for current semester
$selectedCourses = isset($data->selected_courses) ? $data->selected_courses : []; // Courses for next semester
$academicYearId = isset($data->academic_year_id) ? intval($data->academic_year_id) : null; // Required for advised_courses
$semesterId = isset($data->semester_id) ? intval($data->semester_id) : null; // Required for advised_courses

if (!empty($selectedCourses) && (empty($academicYearId) || empty($semesterId))) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Academic year and semester IDs are required for selected courses."]);
    exit;
}

try {
    $conn->beginTransaction();

    $updatedGradesCount = 0;
    $insertedAdvisedCoursesCount = 0;
    $failedUpdates = [];
    $failedInsertions = [];

    // Function to get remarks based on transmutation (5-point grading scale)
    function getRemarksFromTransmutation($transmutation) {
        if ($transmutation === null || $transmutation === "") return null;

        // Check for non-numeric special grades first
        $lowerTransmutation = strtolower($transmutation);
        if ($lowerTransmutation === 'inc') return 'Incomplete';
        if ($lowerTransmutation === 'ud') return 'Unofficially Dropped';
        if ($lowerTransmutation === 'od') return 'Officially Dropped';

        $numTransmutation = floatval($transmutation);

        if (is_nan($numTransmutation)) {
            return null; // It's not a known text grade or a valid number
        }

        // 5-point grading scale: 1.00-3.00 is Passed, 3.25-5.00 is Failed
        if ($numTransmutation >= 1.00 && $numTransmutation <= 3.00) return "Passed";
        if ($numTransmutation >= 3.25 && $numTransmutation <= 5.00) return "Failed";
        return null; // Should not happen with valid input range
    }

    // 1. Process current semester grades (update course_grades table)
    if (!empty($currentGrades)) {
        $updateGradeSql = "UPDATE kld_advising.course_grades
                           SET transmutation = :grade, remarks = :remarks, is_submitted = 1
                           WHERE student_id = :student_id AND course_id = :course_id";
        $updateGradeStmt = $conn->prepare($updateGradeSql);

        foreach ($currentGrades as $gradeEntry) {
            if (empty($gradeEntry->course_id) || empty($gradeEntry->grade)) {
                $failedUpdates[] = [
                    'course_id' => $gradeEntry->course_id ?? 'N/A',
                    'error' => 'Missing course_id or grade'
                ];
                continue;
            }
            try {
                $remarks = getRemarksFromTransmutation($gradeEntry->grade);
                $updateGradeStmt->bindParam(':grade', $gradeEntry->grade);
                $updateGradeStmt->bindParam(':remarks', $remarks);
                $updateGradeStmt->bindParam(':student_id', $studentId);
                $updateGradeStmt->bindParam(':course_id', $gradeEntry->course_id, PDO::PARAM_INT);
                $updateGradeStmt->execute();
                $updatedGradesCount += $updateGradeStmt->rowCount(); // Count rows affected
            } catch (PDOException $e) {
                error_log("Submit Grades Request: Grade update for Course ID: {$gradeEntry->course_id} failed with error: " . $e->getMessage());
                $failedUpdates[] = [
                    'course_id' => $gradeEntry->course_id,
                    'error' => $e->getMessage()
                ];
            }
        }
    }

    // 2. Process selected courses for next semester (insert into advised_courses table)
    if (!empty($selectedCourses)) {
        $insertAdvisedCourseSql = "INSERT INTO kld_advising.advised_courses
                                   (student_id, course_id, academic_year_id, semester_id, advising_date)
                                   VALUES (:student_id, :course_id, :academic_year_id, :semester_id, CURRENT_DATE)
                                   ON CONFLICT (student_id, course_id, academic_year_id, semester_id) DO UPDATE SET advising_date = CURRENT_DATE"; // Removed status from INSERT and UPDATE
        $insertAdvisedCourseStmt = $conn->prepare($insertAdvisedCourseSql);

        foreach ($selectedCourses as $courseId) {
            if (empty($courseId)) {
                $failedInsertions[] = [
                    'course_id' => 'N/A',
                    'error' => 'Missing course_id in selected_courses'
                ];
                continue;
            }
            try {
                $insertAdvisedCourseStmt->bindParam(':student_id', $studentId);
                $insertAdvisedCourseStmt->bindParam(':course_id', $courseId, PDO::PARAM_INT);
                $insertAdvisedCourseStmt->bindParam(':academic_year_id', $academicYearId);
                $insertAdvisedCourseStmt->bindParam(':semester_id', $semesterId);
                $insertAdvisedCourseStmt->execute();
                $insertedAdvisedCoursesCount += $insertAdvisedCourseStmt->rowCount(); // Count actual insertions
            } catch (PDOException $e) {
                error_log("Submit Advising Request: Advised Course ID: {$courseId} failed with error: " . $e->getMessage());
                $failedInsertions[] = [
                    'course_id' => $courseId,
                    'error' => $e->getMessage()
                ];
            }
        }
    }

    // Determine overall success message and status code
    $success = true;
    $message = [];
    $statusCode = 200;

    if ($updatedGradesCount > 0) {
        $message[] = "Successfully submitted {$updatedGradesCount} grades.";
    }
    if (count($failedUpdates) > 0) {
        $message[] = "Failed to update " . count($failedUpdates) . " grades.";
        $success = false;
        $statusCode = 207; // Multi-Status
    }

    if ($insertedAdvisedCoursesCount > 0) {
        $message[] = "Successfully submitted {$insertedAdvisedCoursesCount} courses for next semester.";
    }
    if (count($failedInsertions) > 0) {
        $message[] = "Failed to advise " . count($failedInsertions) . " courses for next semester.";
        $success = false;
        $statusCode = 207; // Multi-Status
    }

    if (empty($message)) {
        $message[] = "No grades or courses submitted for advising.";
        $success = false;
        $statusCode = 200;
    }

    $conn->commit();

    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => implode(" ", $message),
        "updated_grades_count" => $updatedGradesCount,
        "failed_grade_updates" => $failedUpdates,
        "inserted_advised_courses_count" => $insertedAdvisedCoursesCount,
        "failed_advised_course_insertions" => $failedInsertions
    ]);

} catch (PDOException $e) {
    $conn->rollBack();
    error_log("Submit Advising Request (PDO Error): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
} catch (Exception $e) {
    $conn->rollBack();
    error_log("Submit Advising Request (General Error): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Server error: " . $e->getMessage()]);
}

?>
