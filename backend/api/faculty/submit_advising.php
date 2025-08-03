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
if (empty($data->student_id) || empty($data->advisor_id) || empty($data->active_academic_year_id) || empty($data->active_semester_id) || !isset($data->selected_course_ids) || !is_array($data->selected_course_ids) || count($data->selected_course_ids) === 0) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid input. Required fields: student_id, advisor_id, active_academic_year_id, active_semester_id, and non-empty selected_course_ids array."]);
    exit;
}

$studentId = $data->student_id;
$advisorId = $data->advisor_id;
$academicYearId = $data->active_academic_year_id;
$semesterId = $data->active_semester_id;
$selectedCourseIds = $data->selected_course_ids;

try {
    $conn->beginTransaction();

    // Prepare the INSERT statement for advised_courses
    $sql = "INSERT INTO advised_courses (student_id, course_id, advisor_id, academic_year_id, semester_id, advising_date)
            VALUES (:student_id, :course_id, :advisor_id, :academic_year_id, :semester_id, CURDATE())";
    $stmt = $conn->prepare($sql);

    $insertedCount = 0;
    $failedInsertions = [];

    // Loop through selected course IDs and insert into the table
    foreach ($selectedCourseIds as $courseId) {
        try {
            $stmt->bindParam(':student_id', $studentId);
            $stmt->bindParam(':course_id', $courseId);
            $stmt->bindParam(':advisor_id', $advisorId);
            $stmt->bindParam(':academic_year_id', $academicYearId);
            $stmt->bindParam(':semester_id', $semesterId);

            $stmt->execute();
            $insertedCount++;

        } catch (PDOException $e) {
            // Log the specific course ID that failed and the error
            error_log("Failed to insert advised course for student {$studentId}, course {$courseId}: " . $e->getMessage());
            $failedInsertions[] = [
                'course_id' => $courseId,
                'error' => $e->getMessage()
            ];
            // Continue to try inserting other courses
        }
    }

    // Check if any courses were successfully inserted
    if ($insertedCount > 0) {
        $conn->commit();
        $message = "Advising submitted successfully. {$insertedCount} course(s) advised.";
        $statusCode = 201; // Created

        if (count($failedInsertions) > 0) {
             $message .= " However, " . count($failedInsertions) . " course(s) failed to be advised.";
             $statusCode = 207; // Multi-Status
        }

        http_response_code($statusCode);
        echo json_encode([
            "success" => true,
            "message" => $message,
            "inserted_count" => $insertedCount,
            "failed_insertions" => $failedInsertions
        ]);

    } else {
        // If the loop finished but no courses were inserted (e.g., all failed)
        $conn->rollBack();
        http_response_code(500); // Internal Server Error or 422 Unprocessable Entity
        echo json_encode([
            "success" => false,
            "message" => "Failed to advise any courses.",
            "failed_insertions" => $failedInsertions
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