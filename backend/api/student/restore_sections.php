<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';

$data = json_decode(file_get_contents("php://input"), true);

$academic_year_id = $data['academic_year_id'] ?? null;
$semester_id = $data['semester_id'] ?? null;

if (!$academic_year_id && !$semester_id) {
    http_response_code(400);
    echo json_encode(["message" => "Academic Year ID or Semester ID is required."]);
    exit();
}

$conn->beginTransaction();

try {
    $students_restored_count = 0;

    if ($semester_id) {
        // Restore sections for students whose sections were blanked when this semester was activated
        // This logic assumes a relationship between student_section_enrollments and semesters through sections
        // For simplicity, we'll restore any student whose previous_section_id is set and was associated with sections that theoretically belong to this semester.
        // In a real application, you might need a more robust way to link a blanking action to a specific semester activation.

        $stmt = $conn->prepare("
            UPDATE students s
            SET section_id = sse.previous_section_id
            FROM student_section_enrollments sse
            JOIN sections sec ON sse.previous_section_id = sec.id
            WHERE s.id = sse.student_id 
            AND sse.previous_section_id IS NOT NULL
            AND sec.semester_id = :semester_id
        ");
        $stmt->bindParam(':semester_id', $semester_id, PDO::PARAM_INT);
        $stmt->execute();
        $students_restored_count += $stmt->rowCount();

    } else if ($academic_year_id) {
        // Restore sections for students whose sections were blanked when this academic year was activated
        // This logic assumes a relationship between student_section_enrollments and academic years through sections/semesters

        $stmt = $conn->prepare("
            UPDATE students s
            SET section_id = sse.previous_section_id
            FROM student_section_enrollments sse
            JOIN sections sec ON sse.previous_section_id = sec.id
            JOIN semesters sem ON sec.semester_id = sem.id
            JOIN academic_year_semesters ays ON sem.id = ays.semester_id
            WHERE s.id = sse.student_id 
            AND sse.previous_section_id IS NOT NULL
            AND ays.academic_year_id = :academic_year_id
        ");
        $stmt->bindParam(':academic_year_id', $academic_year_id, PDO::PARAM_INT);
        $stmt->execute();
        $students_restored_count += $stmt->rowCount();
    }

    // After restoring, clear the previous_section_id to prevent accidental re-restoration
    // For affected students only.
    $clear_previous_section_query = "UPDATE student_section_enrollments 
                                     SET previous_section_id = NULL 
                                     WHERE previous_section_id IS NOT NULL";
    $conn->exec($clear_previous_section_query);

    $conn->commit();

    echo json_encode(["message" => "Successfully restored $students_restored_count student sections."]);

} catch (Exception $e) {
    $conn->rollBack();
    http_response_code(500);
    echo json_encode(["message" => "Failed to restore student sections: " . $e->getMessage()]);
}
?>
