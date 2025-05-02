<?php
// Turn off error display in response
error_reporting(0);
ini_set('display_errors', 0);

// Include CORS headers
include_once '../../config/cors.php';

// Set content type to JSON
header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Validate input
if (!isset($data->course_code) || !isset($data->course_title) || !isset($data->track_id) ||
    empty(trim($data->course_code)) || empty(trim($data->course_title)) || empty($data->track_id)) {
    http_response_code(400);
    echo json_encode(array(
        "success" => false,
        "message" => "Course code, course title, and track ID are required."
    ));
    exit();
}

try {
    // Ensure database connection is valid
    if (!$conn) {
        throw new PDOException("Database connection failed");
    }

    $conn->beginTransaction();

    // Check if course code already exists
    $code_check = "SELECT id, course_code FROM courses 
                  WHERE UPPER(course_code) = UPPER(:course_code)";
    
    $code_stmt = $conn->prepare($code_check);
    $code_stmt->bindParam(':course_code', $data->course_code);
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

    // Check if course title already exists
    $title_check = "SELECT id, course_title FROM courses 
                   WHERE UPPER(course_title) = UPPER(:course_title)";
    
    $title_stmt = $conn->prepare($title_check);
    $title_stmt->bindParam(':course_title', $data->course_title);
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

    // Insert into courses table
    $course_query = "INSERT INTO courses (course_code, course_title) 
                    VALUES (:course_code, :course_title)";
    
    $course_stmt = $conn->prepare($course_query);
    $course_stmt->bindParam(':course_code', $data->course_code);
    $course_stmt->bindParam(':course_title', $data->course_title);
    
    if (!$course_stmt->execute()) {
        $conn->rollBack();
        http_response_code(503);
        echo json_encode(array(
            "success" => false,
            "message" => "Unable to create course."
        ));
        exit();
    }

    $course_id = $conn->lastInsertId();

    // Insert into elective_courses table
    $elective_query = "INSERT INTO elective_courses (course_id, track_id) 
                      VALUES (:course_id, :track_id)";
    
    $elective_stmt = $conn->prepare($elective_query);
    $elective_stmt->bindParam(':course_id', $course_id);
    $elective_stmt->bindParam(':track_id', $data->track_id);
    
    if ($elective_stmt->execute()) {
        // Fetch the created elective course with all details
        $fetch_query = "SELECT ec.id, c.course_code, c.course_title, ec.track_id, t.track_name
                       FROM elective_courses ec
                       JOIN courses c ON ec.course_id = c.id
                       JOIN tracks t ON ec.track_id = t.id
                       WHERE ec.id = :elective_id";
        
        $fetch_stmt = $conn->prepare($fetch_query);
        $fetch_stmt->bindParam(':elective_id', $conn->lastInsertId());
        $fetch_stmt->execute();
        
        $new_elective = $fetch_stmt->fetch(PDO::FETCH_ASSOC);

        $conn->commit();
        http_response_code(201);
        echo json_encode(array(
            "success" => true,
            "message" => "Elective course created successfully.",
            "elective" => $new_elective
        ));
    } else {
        $conn->rollBack();
        http_response_code(503);
        echo json_encode(array(
            "success" => false,
            "message" => "Unable to create elective course."
        ));
    }
} catch (PDOException $e) {
    if ($conn) {
        $conn->rollBack();
    }
    http_response_code(503);
    echo json_encode(array(
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ));
} catch (Exception $e) {
    if ($conn) {
        $conn->rollBack();
    }
    http_response_code(503);
    echo json_encode(array(
        "success" => false,
        "message" => "Error: " . $e->getMessage()
    ));
}
?>