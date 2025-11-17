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
        // Count students query (matches progression logic)
        $query = "SELECT COUNT(DISTINCT s.id) as count
                  FROM students s
                  JOIN sections sec ON s.section_id = sec.id
                  WHERE sec.academic_year_id = :from_academic_year_id
                    AND sec.semester_id = :from_semester_id
                    AND s.section_id IS NOT NULL";

        $stmt = $conn->prepare($query);
        $stmt->bindParam(":from_academic_year_id", $from_academic_year_id);
        $stmt->bindParam(":from_semester_id", $from_semester_id);
        $stmt->execute();
        
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $affected_students_count = (int)$row['count'];

        // Count sections
        $sections_query = "SELECT COUNT(*) as count
                          FROM sections
                          WHERE academic_year_id = :from_academic_year_id
                            AND semester_id = :from_semester_id";
        
        $sections_stmt = $conn->prepare($sections_query);
        $sections_stmt->bindParam(":from_academic_year_id", $from_academic_year_id);
        $sections_stmt->bindParam(":from_semester_id", $from_semester_id);
        $sections_stmt->execute();
        
        $sections_row = $sections_stmt->fetch(PDO::FETCH_ASSOC);
        $sections_count = (int)$sections_row['count'];

        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Preview data retrieved successfully.",
            "affected_students_count" => $affected_students_count,
            "sections_count" => $sections_count
        ));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array(
            "success" => false,
            "message" => "Database error: " . $e->getMessage()
        ));
    }
} else {
    http_response_code(400);
    echo json_encode(array(
        "success" => false,
        "message" => "Missing required fields."
    ));
}
?>