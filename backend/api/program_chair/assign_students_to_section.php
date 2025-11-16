<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (!isset($data->section_id) || !isset($data->student_ids) || !is_array($data->student_ids)) {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data. Provide section_id and an array of student_ids."));
    exit();
}

$section_id = $data->section_id;
$student_ids = $data->student_ids;

$conn->beginTransaction();
$success_count = 0;
$failed_students = [];

try {
    // First, check section capacity (optional but recommended)
    $capacity_query = "SELECT capacity FROM sections WHERE id = :section_id";
    $capacity_stmt = $conn->prepare($capacity_query);
    $capacity_stmt->bindParam(':section_id', $section_id);
    $capacity_stmt->execute();
    $section_capacity = $capacity_stmt->fetchColumn();

    if ($section_capacity === false) {
        throw new Exception("Section not found.");
    }

    // Get current enrolled count from student_section_enrollments where enrollment_status is 'enrolled'
    $enrolled_count_query = "SELECT COUNT(*) FROM student_section_enrollments WHERE section_id = :section_id AND enrollment_status = 'enrolled'";
    $enrolled_count_stmt = $conn->prepare($enrolled_count_query);
    $enrolled_count_stmt->bindParam(':section_id', $section_id);
    $enrolled_count_stmt->execute();
    $current_enrolled_count = $enrolled_count_stmt->fetchColumn();

    // Initial check: if the section is already full before attempting any assignments
    if ($current_enrolled_count >= $section_capacity) {
        $conn->rollBack(); // No assignments were made, so rollback transaction
        http_response_code(409); // Conflict
        echo json_encode(array("message" => "Section capacity already reached."));
        exit();
    }

    foreach ($student_ids as $student_db_id) {
        // Check if student is already enrolled in this section or any other active section
        $check_student_query = "SELECT section_id FROM students WHERE id = :student_db_id";
        $check_student_stmt = $conn->prepare($check_student_query);
        $check_student_stmt->bindParam(':student_db_id', $student_db_id);
        $check_student_stmt->execute();
        $current_student_section_id = $check_student_stmt->fetchColumn();

        if ($current_student_section_id !== false && $current_student_section_id == $section_id) {
            array_push($failed_students, array("student_id" => $student_db_id, "reason" => "Already assigned to this section."));
            continue;
        } else if ($current_student_section_id !== false && $current_student_section_id !== null) {
             array_push($failed_students, array("student_id" => $student_db_id, "reason" => "Already assigned to another active section."));
             continue;
        }

        // Check capacity again for each assignment attempt
        if (($current_enrolled_count + $success_count) >= $section_capacity) {
            array_push($failed_students, array("student_id" => $student_db_id, "reason" => "Section capacity reached."));
            continue;
        }

        // 1. Update students table to set their current section_id
        $update_student_query = "UPDATE students SET section_id = :section_id WHERE id = :student_db_id";
        $update_student_stmt = $conn->prepare($update_student_query);
        $update_student_stmt->bindParam(':section_id', $section_id);
        $update_student_stmt->bindParam(':student_db_id', $student_db_id);
        $update_student_stmt->execute();

        // 2. Insert record into student_section_enrollments or update if exists
        $enroll_query = "INSERT INTO student_section_enrollments (student_id, section_id, enrollment_status)
                         VALUES (:student_id, :section_id, 'enrolled')
                         ON CONFLICT (student_id, section_id) DO UPDATE SET
                         enrollment_status = 'enrolled',
                         completed_at = NULL"; // Reset completed_at if re-enrolling
        $enroll_stmt = $conn->prepare($enroll_query);
        $enroll_stmt->bindParam(':student_id', $student_db_id);
        $enroll_stmt->bindParam(':section_id', $section_id);
        $enroll_stmt->execute();

        $success_count++;
    }

    $conn->commit();

    if (count($failed_students) > 0) {
        http_response_code(207); // Multi-Status
        echo json_encode(array("message" => "Some students could not be assigned.", "success_count" => $success_count, "failed_students" => $failed_students));
    } else {
        http_response_code(200);
        echo json_encode(array("message" => "Students assigned successfully.", "success_count" => $success_count));
    }

} catch (Exception $e) {
    $conn->rollBack();
    http_response_code(503);
    echo json_encode(array("message" => "Unable to assign students: " . $e->getMessage()));
}