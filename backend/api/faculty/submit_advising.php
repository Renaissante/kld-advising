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

// Validate input
if (empty($data->student_id) || empty($data->advisor_id) || empty($data->academic_year_id) || empty($data->semester_id) || !isset($data->selected_course_ids) || !is_array($data->selected_course_ids) || count($data->selected_course_ids) === 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid input. Required fields: student_id, advisor_id, academic_year_id, semester_id, and non-empty selected_course_ids array."]);
    exit;
}

$studentId = $data->student_id;
$advisorId = $data->advisor_id;
$academicYearId = $data->academic_year_id;
$semesterId = $data->semester_id;
$selectedCourseIds = $data->selected_course_ids;
$gradesToUpdate = isset($data->grades) ? $data->grades : []; // Expect an array of grades

try {
    $conn->beginTransaction();

    // Fetch the current active academic year and semester
    $currentAcademicYearQuery = "SELECT academic_year_id FROM academic_years WHERE is_current = TRUE LIMIT 1";
    $currentAcademicYearStmt = $conn->prepare($currentAcademicYearQuery);
    $currentAcademicYearStmt->execute();
    $currentAcademicYearRow = $currentAcademicYearStmt->fetch(PDO::FETCH_ASSOC);
    $currentAcademicYearId = $currentAcademicYearRow ? $currentAcademicYearRow['academic_year_id'] : null;

    $currentSemesterQuery = "SELECT semester_id FROM semesters WHERE is_current = TRUE LIMIT 1";
    $currentSemesterStmt = $conn->prepare($currentSemesterQuery);
    $currentSemesterStmt->execute();
    $currentSemesterRow = $currentSemesterStmt->fetch(PDO::FETCH_ASSOC);
    $currentSemesterId = $currentSemesterRow ? $currentSemesterRow['semester_id'] : null;

    if (!$currentAcademicYearId || !$currentSemesterId) {
        throw new Exception("Could not determine current academic year or semester.");
    }

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

    $updatedGradesCount = 0;
    $failedGradeUpdates = [];

    // 1. Process current semester grades (update course_grades table and set is_verified = 1)
    if (!empty($gradesToUpdate)) {
        $updateGradeSql = "UPDATE kld_advising.course_grades
                           SET transmutation = :grade, remarks = :remarks, is_verified = 1, academic_year_id = :current_academic_year_id, semester_id = :current_semester_id
                           WHERE student_id = :student_id AND course_id = :course_id";
        $updateGradeStmt = $conn->prepare($updateGradeSql);

        foreach ($gradesToUpdate as $gradeEntry) {
            if (empty($gradeEntry->course_id) || empty($gradeEntry->grade)) {
                $failedGradeUpdates[] = [
                    'course_id' => $gradeEntry->course_id ?? 'N/A',
                    'error' => 'Missing course_id or grade'
                ];
                continue;
            }
            try {
                $remarks = getRemarksFromTransmutation($gradeEntry->grade);
                $updateGradeStmt->bindParam(':grade', $gradeEntry->grade);
                $updateGradeStmt->bindParam(':remarks', $remarks);
                $updateGradeStmt->bindParam(':current_academic_year_id', $currentAcademicYearId, PDO::PARAM_INT);
                $updateGradeStmt->bindParam(':current_semester_id', $currentSemesterId, PDO::PARAM_INT);
                $updateGradeStmt->bindParam(':student_id', $studentId);
                $updateGradeStmt->bindParam(':course_id', $gradeEntry->course_id, PDO::PARAM_INT);
                $updateGradeStmt->execute();
                $updatedGradesCount += $updateGradeStmt->rowCount(); // Count rows affected
            } catch (PDOException $e) {
                error_log("Submit Advising (Faculty): Grade update for Course ID: {$gradeEntry->course_id} failed with error: " . $e->getMessage());
                $failedGradeUpdates[] = [
                    'course_id' => $gradeEntry->course_id,
                    'error' => $e->getMessage()
                ];
            }
        }
    }

    // Prepare the INSERT statement for advised_courses
    $sql = "INSERT INTO kld_advising.advised_courses (student_id, course_id, advisor_id, academic_year_id, semester_id, advising_date)
            VALUES (:student_id, :course_id, :advisor_id, :academic_year_id, :semester_id, CURRENT_DATE)";
    $stmt = $conn->prepare($sql);

    $insertedCount = 0;
    $failedInsertions = [];

    // 1. Fetch existing advised courses for the student, academic year, and semester
    $existingAdvisedCoursesQuery = "SELECT course_id, advised_course_id, status FROM advised_courses WHERE student_id = :student_id AND academic_year_id = :academic_year_id AND semester_id = :semester_id";
    $stmtExistingAdvisedCourses = $conn->prepare($existingAdvisedCoursesQuery);
    $stmtExistingAdvisedCourses->bindParam(':student_id', $studentId);
    $stmtExistingAdvisedCourses->bindParam(':academic_year_id', $academicYearId);
    $stmtExistingAdvisedCourses->bindParam(':semester_id', $semesterId);
    $stmtExistingAdvisedCourses->execute();
    $existingAdvisedCourses = $stmtExistingAdvisedCourses->fetchAll(PDO::FETCH_ASSOC);

    $existingAdvisedCourseMap = [];
    foreach ($existingAdvisedCourses as $course) {
        $existingAdvisedCourseMap[$course['course_id']] = $course;
    }

    $coursesToApprove = [];
    $coursesToInsert = [];
    $coursesToMarkVerified = []; // This will now be used for current semester grades

    foreach ($selectedCourseIds as $courseId) {
        $courseId = (int)$courseId;
        if (isset($existingAdvisedCourseMap[$courseId])) {
            // Course exists, mark for update if not already approved by this advisor
            if (!($existingAdvisedCourseMap[$courseId]['status'] === 'approved' && $existingAdvisedCourseMap[$courseId]['advisor_id'] === $advisorId)) {
                $coursesToApprove[] = $courseId;
            }
        } else {
            // New course, mark for insertion
            $coursesToInsert[] = $courseId;
        }
    }

    // Use gradesToVerifyCourseIds for setting is_verified flag
    // This is no longer needed as grades are explicitly updated above.
    // $coursesToMarkVerified = $gradesToVerifyCourseIds;

    // Handle deletions: courses that were previously advised (pending) but are not in the current selection
    $coursesToDelete = [];
    foreach ($existingAdvisedCourses as $course) {
        // If it was pending and not in the new selection, delete it.
        // If it was already approved by THIS advisor, we assume it remains approved unless explicitly removed (which is handled by not being in selectedCourseIds)
        if (!in_array((int)$course['course_id'], $selectedCourseIds) && $course['status'] === 'pending') {
            $coursesToDelete[] = (int)$course['course_id'];
        }
    }

    // Perform updates, insertions, deletions, and grade verification
    $totalProcessed = 0;

    // 2. Update existing advised_courses to 'approved'
    if (!empty($coursesToApprove)) {
        $placeholders = implode(',', array_fill(0, count($coursesToApprove), '?'));
        $sqlUpdate = "UPDATE advised_courses SET status = 'approved', advisor_id = ?, advising_date = CURRENT_DATE WHERE student_id = ? AND academic_year_id = ? AND semester_id = ? AND course_id IN ($placeholders)";
        $stmtUpdate = $conn->prepare($sqlUpdate);
        $stmtUpdate->execute(array_merge([$advisorId, $studentId, $academicYearId, $semesterId], $coursesToApprove));
        $totalProcessed += $stmtUpdate->rowCount();
    }

    // 3. Insert new advised_courses
    if (!empty($coursesToInsert)) {
        $sqlInsert = "INSERT INTO advised_courses (student_id, course_id, advisor_id, academic_year_id, semester_id, advising_date, status)
                      VALUES (:student_id, :course_id, :advisor_id, :academic_year_id, :semester_id, CURRENT_DATE, 'approved')";
        $stmtInsert = $conn->prepare($sqlInsert);
        foreach ($coursesToInsert as $courseId) {
            try {
                $stmtInsert->bindParam(':student_id', $studentId);
                $stmtInsert->bindParam(':course_id', $courseId, PDO::PARAM_INT);
                $stmtInsert->bindParam(':advisor_id', $advisorId);
                $stmtInsert->bindParam(':academic_year_id', $academicYearId);
                $stmtInsert->bindParam(':semester_id', $semesterId);
                $stmtInsert->execute();
                $totalProcessed++;
            } catch (PDOException $e) {
                error_log("Submit Advising: New Course ID {$courseId} failed insertion: " . $e->getMessage());
                $failedInsertions[] = [
                    'course_id' => $courseId,
                    'error' => $e->getMessage()
                ];
            }
        }
    }

    // 4. Delete unselected pending advised_courses
    if (!empty($coursesToDelete)) {
        $placeholders = implode(',', array_fill(0, count($coursesToDelete), '?'));
        $sqlDelete = "DELETE FROM advised_courses WHERE student_id = ? AND academic_year_id = ? AND semester_id = ? AND course_id IN ($placeholders) AND status = 'pending'";
        $stmtDelete = $conn->prepare($sqlDelete);
        $stmtDelete->execute(array_merge([$studentId, $academicYearId, $semesterId], $coursesToDelete));
        // Note: Not adding to totalProcessed as it's a removal, not an addition/approval
    }

    // 5. Update course_grades.is_verified for current semester grades that were reviewed/approved
    // This logic is moved and integrated into the grade update section.
    // if (!empty($gradesToVerifyCourseIds)) {
    //     $placeholders = implode(',', array_fill(0, count($gradesToVerifyCourseIds), '?'));
    //     $sqlVerifyGrades = "UPDATE course_grades SET is_verified = 1 WHERE student_id = ? AND course_id IN ($placeholders)";
    //     $stmtVerifyGrades = $conn->prepare($sqlVerifyGrades);
    //     $stmtVerifyGrades->execute(array_merge([$studentId], $gradesToVerifyCourseIds));
    // }

    // Check if any courses were successfully processed (inserted or updated)
    if ($totalProcessed > 0 || !empty($failedInsertions) || !empty($failedGradeUpdates)) { // Include grade updates in success check
        $conn->commit();
        $message = "Advising processed successfully.";
        $statusCode = 200; // OK

        if (!empty($failedInsertions)) {
             $message .= " Some courses could not be processed.";
             $statusCode = 207; // Multi-Status
        }

        http_response_code($statusCode);
        echo json_encode([
            "success" => true,
            "message" => $message,
            "processed_count" => $totalProcessed,
            "failed_insertions" => $failedInsertions,
            "updated_grades_count" => $updatedGradesCount, // Add this
            "failed_grade_updates" => $failedGradeUpdates // Add this
        ]);

    } else {
        // If no courses were processed at all (e.g., no courses selected, or all failed unexpectedly)
        $conn->rollBack();
        http_response_code(400); // Bad Request or Unprocessable Entity
        echo json_encode([
            "success" => false,
            "message" => "No courses were approved, submitted, or grades updated. Please ensure you select courses for advising or provide grades.", // Updated message
            "failed_insertions" => $failedInsertions,
            "failed_grade_updates" => $failedGradeUpdates // Add this
        ]);
    }


} catch (PDOException $e) {
    $conn->rollBack();
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
} catch (Exception $e) {
    $conn->rollBack(); // Ensure rollback even for non-PDO exceptions
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Server error: " . $e->getMessage()]);
}

?>