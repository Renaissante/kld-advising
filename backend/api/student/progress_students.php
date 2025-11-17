<?php

include_once '../../config/cors.php';
include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

if (
    !empty($data->from_academic_year_id) &&
    !empty($data->from_semester_id) &&
    !empty($data->to_academic_year_id) &&
    !empty($data->to_semester_id)
) {
    $from_academic_year_id = htmlspecialchars(strip_tags($data->from_academic_year_id));
    $from_semester_id = htmlspecialchars(strip_tags($data->from_semester_id));
    $to_academic_year_id = htmlspecialchars(strip_tags($data->to_academic_year_id));
    $to_semester_id = htmlspecialchars(strip_tags($data->to_semester_id));

    try {
        $conn->beginTransaction();

        // 1. Find all sections in the FROM period
        $find_sections_query = "SELECT id FROM sections
                               WHERE academic_year_id = :from_academic_year_id
                                 AND semester_id = :from_semester_id";
        $find_sections_stmt = $conn->prepare($find_sections_query);
        $find_sections_stmt->bindParam(':from_academic_year_id', $from_academic_year_id);
        $find_sections_stmt->bindParam(':from_semester_id', $from_semester_id);
        $find_sections_stmt->execute();
        $from_sections = $find_sections_stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($from_sections)) {
            throw new Exception("No sections found in the specified period.");
        }

        // Create placeholders for IN clause
        $placeholders = implode(',', array_fill(0, count($from_sections), '?'));

        // 2. Find all students currently enrolled in those sections
        $find_students_query = "SELECT id FROM students
                               WHERE section_id IN ($placeholders)
                                 AND section_id IS NOT NULL";
        $find_students_stmt = $conn->prepare($find_students_query);
        $find_students_stmt->execute($from_sections);
        $affected_students = $find_students_stmt->fetchAll(PDO::FETCH_COLUMN);

        $affected_students_count = count($affected_students);

        if ($affected_students_count > 0) {
            $student_placeholders = implode(',', array_fill(0, count($affected_students), '?'));

            // 3. Mark enrollments as completed in history
            $update_enrollment_query = "UPDATE student_section_enrollments
                                       SET enrollment_status = 'completed',
                                           completed_at = CURRENT_TIMESTAMP
                                       WHERE student_id IN ($student_placeholders)
                                         AND section_id IN ($placeholders)
                                         AND enrollment_status = 'enrolled'";
            $update_enrollment_stmt = $conn->prepare($update_enrollment_query);
            $update_enrollment_stmt->execute(array_merge($affected_students, $from_sections));

            // 4. Clear section_id AND year_level_id for affected students
            $clear_student_data_query = "UPDATE students
                                         SET section_id = NULL,
                                             year_level_id = NULL
                                         WHERE id IN ($student_placeholders)";
            $clear_student_data_stmt = $conn->prepare($clear_student_data_query);
            $clear_student_data_stmt->execute($affected_students);
        }

        // 5. Mark section advisors as completed
        $update_advisors_query = "UPDATE section_advisors
                                 SET status = 'completed'
                                 WHERE section_id IN ($placeholders)
                                   AND status = 'active'";
        $update_advisors_stmt = $conn->prepare($update_advisors_query);
        $update_advisors_stmt->execute($from_sections);

        // 6. Mark section faculty as completed
        $update_faculty_query = "UPDATE section_faculty
                                SET status = 'completed'
                                WHERE section_id IN ($placeholders)
                                  AND status = 'active'";
        $update_faculty_stmt = $conn->prepare($update_faculty_query);
        $update_faculty_stmt->execute($from_sections);

        // 7. Mark sections as completed
        $update_sections_status_query = "UPDATE sections
                                         SET status = 'completed'
                                         WHERE academic_year_id = :from_academic_year_id
                                           AND semester_id = :from_semester_id
                                           AND status != 'completed'";
        $update_sections_status_stmt = $conn->prepare($update_sections_status_query);
        $update_sections_status_stmt->bindParam(':from_academic_year_id', $from_academic_year_id);
        $update_sections_status_stmt->bindParam(':from_semester_id', $from_semester_id);
        $update_sections_status_stmt->execute();

        // 8. Update current academic year
        $clear_current_ay_query = "UPDATE academic_years SET is_current = false";
        $conn->exec($clear_current_ay_query);

        $set_current_ay_query = "UPDATE academic_years
                                SET is_current = true
                                WHERE academic_year_id = :to_academic_year_id";
        $set_current_ay_stmt = $conn->prepare($set_current_ay_query);
        $set_current_ay_stmt->bindParam(':to_academic_year_id', $to_academic_year_id);
        $set_current_ay_stmt->execute();

        // 9. Update current semester
        $clear_current_sem_query = "UPDATE semesters SET is_current = false";
        $conn->exec($clear_current_sem_query);

        $set_current_sem_query = "UPDATE semesters
                                 SET is_current = true
                                 WHERE semester_id = :to_semester_id";
        $set_current_sem_stmt = $conn->prepare($set_current_sem_query);
        $set_current_sem_stmt->bindParam(':to_semester_id', $to_semester_id);
        $set_current_sem_stmt->execute();

        $conn->commit();

        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Students successfully progressed to new period.",
            "affected_students_count" => $affected_students_count,
            "from_period" => array(
                "academic_year_id" => $from_academic_year_id,
                "semester_id" => $from_semester_id
            ),
            "to_period" => array(
                "academic_year_id" => $to_academic_year_id,
                "semester_id" => $to_semester_id
            )
        ));

    } catch (PDOException $e) {
        $conn->rollBack();
        http_response_code(500);
        echo json_encode(array(
            "success" => false,
            "message" => "Database error: " . $e->getMessage()
        ));
    } catch (Exception $e) {
        $conn->rollBack();
        http_response_code(500);
        echo json_encode(array(
            "success" => false,
            "message" => "Error: " . $e->getMessage()
        ));
    }

} else {
    http_response_code(400);
    echo json_encode(array(
        "success" => false,
        "message" => "Unable to progress students. Required fields: from_academic_year_id, from_semester_id, to_academic_year_id, to_semester_id."
    ));
}
?>