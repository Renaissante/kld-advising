<?php
include_once '../../config/cors.php';
include_once '../../config/database.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

$data = json_decode(file_get_contents("php://input"));

if (!isset($data->section_id) || !isset($data->student_ids) || !is_array($data->student_ids)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data. Provide section_id and an array of student_ids."]);
    exit();
}

$section_id = $data->section_id;
$student_ids = $data->student_ids;

$conn->beginTransaction();
$success_count = 0;
$failed_students = [];

try {
    // 1. Fetch section details
    $section_query = "SELECT capacity, year_level_id FROM kld_advising.sections WHERE id = :section_id";
    $section_stmt = $conn->prepare($section_query);
    $section_stmt->bindParam(':section_id', $section_id);
    $section_stmt->execute();
    $section = $section_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$section) throw new Exception("Section not found");

    $section_capacity = $section['capacity'];
    $section_year_level_id = $section['year_level_id'];

    // 2. Get current enrolled count
    $enrolled_count_query = "SELECT COUNT(*) FROM kld_advising.student_section_enrollments
                             WHERE section_id = :section_id AND enrollment_status = 'enrolled'";
    $enrolled_count_stmt = $conn->prepare($enrolled_count_query);
    $enrolled_count_stmt->bindParam(':section_id', $section_id);
    $enrolled_count_stmt->execute();
    $current_enrolled_count = $enrolled_count_stmt->fetchColumn();

    foreach ($student_ids as $student_db_id) {
        // 3. Fetch student's current section before updating
        $check_student_query = "SELECT section_id FROM kld_advising.students WHERE id = :student_db_id";
        $check_student_stmt = $conn->prepare($check_student_query);
        $check_student_stmt->bindParam(':student_db_id', $student_db_id);
        $check_student_stmt->execute();
        $current_section = $check_student_stmt->fetchColumn();

        // Skip if already assigned
        if ($current_section == $section_id) {
            $failed_students[] = ["student_id" => $student_db_id, "reason" => "Already in this section."];
            continue;
        } elseif (!is_null($current_section)) {
            $failed_students[] = ["student_id" => $student_db_id, "reason" => "Already in another section."];
            continue;
        }

        // 4. Check capacity
        if (($current_enrolled_count + $success_count) >= $section_capacity) {
            $failed_students[] = ["student_id" => $student_db_id, "reason" => "Section full."];
            continue;
        }

        // 5. Update students table (section_id + year_level_id)
        $update_student_query = "UPDATE kld_advising.students
                                 SET section_id = :section_id,
                                     year_level_id = :year_level_id
                                 WHERE id = :student_db_id";
        $update_student_stmt = $conn->prepare($update_student_query);
        $update_student_stmt->bindParam(':section_id', $section_id);
        $update_student_stmt->bindParam(':year_level_id', $section_year_level_id);
        $update_student_stmt->bindParam(':student_db_id', $student_db_id);
        $update_student_stmt->execute();

        // 6. Insert or update student_section_enrollments with previous_section_id
        $enroll_query = "INSERT INTO kld_advising.student_section_enrollments
                         (student_id, section_id, enrollment_status, enrolled_at, previous_section_id)
                         VALUES (:student_id, :section_id, 'enrolled', NOW(), :previous_section_id)
                         ON CONFLICT (student_id, section_id) DO UPDATE
                         SET enrollment_status = 'enrolled',
                             completed_at = NULL";
        $enroll_stmt = $conn->prepare($enroll_query);
        $enroll_stmt->bindParam(':student_id', $student_db_id);
        $enroll_stmt->bindParam(':section_id', $section_id);
        $enroll_stmt->bindParam(':previous_section_id', $current_section);
        $enroll_stmt->execute();

        $success_count++;
    }

    $conn->commit();

    if (count($failed_students) > 0) {
        http_response_code(207); // Multi-status
        echo json_encode([
            "message" => "Some students could not be assigned.",
            "success_count" => $success_count,
            "failed_students" => $failed_students
        ]);
    } else {
        http_response_code(200);
        echo json_encode([
            "message" => "Students assigned successfully.",
            "success_count" => $success_count
        ]);
    }

} catch (Exception $e) {
    $conn->rollBack();
    http_response_code(503);
    echo json_encode(["message" => "Unable to assign students: " . $e->getMessage()]);
}
?>
