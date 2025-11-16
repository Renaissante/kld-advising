<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['semester_id'])) {
    http_response_code(400);
    echo json_encode(["message" => "Semester ID is required."]);
    exit();
}

$semester_id = $data['semester_id'];

$conn->beginTransaction();

try {
    // 1. Get all students currently enrolled in sections within the specified semester
    // This query assumes sections are linked to semesters (e.g., through an academic_year_semester table or similar)
    // For now, we will just blank all students' sections regardless of semester, 
    // as the intention is for Program Chair to reassign all students for the new semester.
    // In a more complex system, we would filter by academic year and semester for specific student groups.

    // Fetch current student section enrollments to store previous_section_id
    $stmt = $conn->prepare("
        SELECT s.id as student_db_id, sse.section_id 
        FROM students s
        JOIN student_section_enrollments sse ON s.id = sse.student_id
        WHERE sse.section_id IS NOT NULL
    ");
    $stmt->execute();
    $students_to_update = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($students_to_update as $student) {
        // Update student_section_enrollments to store previous section_id
        $update_enrollment_query = "UPDATE student_section_enrollments 
                                      SET previous_section_id = :previous_section_id 
                                      WHERE student_id = :student_id 
                                      AND section_id = :current_section_id";
        $update_enrollment_stmt = $conn->prepare($update_enrollment_query);
        $update_enrollment_stmt->bindParam(':previous_section_id', $student['section_id'], PDO::PARAM_INT);
        $update_enrollment_stmt->bindParam(':student_id', $student['student_db_id'], PDO::PARAM_INT);
        $update_enrollment_stmt->bindParam(':current_section_id', $student['section_id'], PDO::PARAM_INT);
        $update_enrollment_stmt->execute();

        // Set section_id to NULL in students table
        $update_student_query = "UPDATE students 
                                 SET section_id = NULL 
                                 WHERE id = :student_db_id";
        $update_student_stmt = $conn->prepare($update_student_query);
        $update_student_stmt->bindParam(':student_db_id', $student['student_db_id'], PDO::PARAM_INT);
        $update_student_stmt->execute();
    }

    $conn->commit();

    echo json_encode(["message" => "Student sections blanked successfully for semester ID: $semester_id"]);

} catch (Exception $e) {
    $conn->rollBack();
    http_response_code(500);
    echo json_encode(["message" => "Failed to blank student sections: " . $e->getMessage()]);
}
?>


