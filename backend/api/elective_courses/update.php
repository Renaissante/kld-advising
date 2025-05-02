<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// For debugging - comment these out after fixing the issue
error_reporting(E_ALL);
ini_set('display_errors', 1);

try {
    // Get posted data
    $data = json_decode(file_get_contents("php://input"));

    // Debug received data
    if ($data === null) {
        throw new Exception("Invalid JSON input");
    }

    // Validate input
    if (!isset($data->id) || !isset($data->course_code) || !isset($data->course_title) || 
        empty($data->id) || empty(trim($data->course_code)) || empty(trim($data->course_title))) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "ID, course code, and course title are required."
        ));
        exit();
    }

    // Start transaction
    $conn->beginTransaction();

    // First check if elective course exists and get course_id
    $check_query = "SELECT ec.id, ec.course_id, c.course_code 
                   FROM elective_courses ec 
                   JOIN courses c ON ec.course_id = c.id 
                   WHERE ec.id = :id";
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(':id', $data->id);
    $check_stmt->execute();

    if ($check_stmt->rowCount() === 0) {
        $conn->rollBack();
        http_response_code(404);
        echo json_encode(array(
            "success" => false,
            "message" => "Elective course not found."
        ));
        exit();
    }

    $elective = $check_stmt->fetch(PDO::FETCH_ASSOC);

    // Check if course code already exists (excluding current course)
    $code_check = "SELECT id, course_code 
                   FROM courses 
                   WHERE UPPER(course_code) = UPPER(:course_code)
                   AND id != :course_id";
    
    $code_stmt = $conn->prepare($code_check);
    $code_stmt->bindParam(':course_code', $data->course_code);
    $code_stmt->bindParam(':course_id', $elective['course_id']);
    $code_stmt->execute();

    if ($code_stmt->rowCount() > 0) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "A course with code '{$data->course_code}' already exists."
        ));
        exit();
    }

    // Check if course title already exists (excluding current course)
    $title_check = "SELECT id, course_title 
                    FROM courses 
                    WHERE UPPER(course_title) = UPPER(:course_title)
                    AND id != :course_id";
    
    $title_stmt = $conn->prepare($title_check);
    $title_stmt->bindParam(':course_title', $data->course_title);
    $title_stmt->bindParam(':course_id', $elective['course_id']);
    $title_stmt->execute();

    if ($title_stmt->rowCount() > 0) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "A course with title '{$data->course_title}' already exists."
        ));
        exit();
    }

    // Update the course
    $update_query = "UPDATE courses 
                    SET course_code = :course_code, 
                        course_title = :course_title
                    WHERE id = :course_id";
    
    $update_stmt = $conn->prepare($update_query);
    $update_stmt->bindParam(':course_code', $data->course_code);
    $update_stmt->bindParam(':course_title', $data->course_title);
    $update_stmt->bindParam(':course_id', $elective['course_id']);
    $update_stmt->execute();

    // Commit transaction
    $conn->commit();

    // Fetch the updated data
    $fetch_query = "SELECT ec.id, ec.course_id, ec.track_id, c.course_code, c.course_title
                   FROM elective_courses ec
                   JOIN courses c ON ec.course_id = c.id
                   WHERE ec.id = :id";
    
    $fetch_stmt = $conn->prepare($fetch_query);
    $fetch_stmt->bindParam(':id', $data->id);
    $fetch_stmt->execute();
    
    $updated_elective = $fetch_stmt->fetch(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "message" => "Elective course updated successfully.",
        "elective" => array(
            "id" => $updated_elective['id'],
            "course_id" => $updated_elective['course_id'],
            "track_id" => $updated_elective['track_id'],
            "course_code" => $updated_elective['course_code'],
            "course_title" => $updated_elective['course_title']
        )
    ));

} catch (Exception $e) {
    // Rollback transaction on error
    if (isset($conn) && $conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(503);
    echo json_encode(array(
        "success" => false,
        "message" => "Error: " . $e->getMessage()
    ));
}

// Make sure there's no extra output
exit();
?>