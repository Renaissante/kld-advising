<?php
// Include CORS headers
include_once '../../config/cors.php';
header("Content-Type: application/json; charset=UTF-8");
include_once '../../config/database.php';

// Get data from request
$input = file_get_contents("php://input");
$data = json_decode($input);

// Check if json_decode failed
if ($data === null) {
    http_response_code(400);
    echo json_encode(array("message" => "Invalid JSON", "error" => json_last_error_msg()));
    exit();
}

// Validate required fields (prerequisites are now an array, optional)
$required_fields = [
    'curriculum_id', 'course_code', 'course_title', 'unit_lec', 
    'unit_lab', 'hour_lec', 'hour_lab', 'year_level_id', 'semester_id'
];

$missing_fields = [];
foreach ($required_fields as $field) {
    // Check for undefined or null values
    if (!isset($data->$field) || $data->$field === null || $data->$field === 'undefined') {
         // Allow 0 for numeric fields
         if (!is_numeric($data->$field) || $data->$field !== 0) {
            $missing_fields[] = $field;
         }
    }
}

if (!empty($missing_fields)) {
    http_response_code(400);
    echo json_encode(array(
        "message" => "Unable to create course. Data is incomplete.",
        "missing_fields" => $missing_fields
    ));
    exit();
}

// Begin transaction
$conn->beginTransaction();

try {
    // Check for duplicate course code in the curriculum
    $check_query = "SELECT COUNT(*) FROM courses WHERE course_code = :course_code AND curriculum_id = :curriculum_id";
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(":course_code", $data->course_code);
    $check_stmt->bindParam(":curriculum_id", $data->curriculum_id);
    $check_stmt->execute();
   
    if ($check_stmt->fetchColumn() > 0) {
        http_response_code(400);
        echo json_encode(array("message" => "Course code already exists in this curriculum."));
        $conn->rollBack(); // Rollback transaction
        exit();
    }
    
    // Check for duplicate course title in the curriculum
    $check_title_query = "SELECT COUNT(*) FROM courses WHERE course_title = :course_title AND curriculum_id = :curriculum_id";
    $check_title_stmt = $conn->prepare($check_title_query);
    $check_title_stmt->bindParam(":course_title", $data->course_title);
    $check_title_stmt->bindParam(":curriculum_id", $data->curriculum_id);
    $check_title_stmt->execute();

    if ($check_title_stmt->fetchColumn() > 0) {
        http_response_code(400);
        echo json_encode(array("message" => "Course title already exists in this curriculum."));
        $conn->rollBack(); // Rollback transaction
        exit();
    }


    // Sanitize input data
    $course_code = htmlspecialchars(strip_tags($data->course_code));
    $course_title = htmlspecialchars(strip_tags($data->course_title));

    // Prepare insert query for courses table (without prerequisite_id)
    $query = "INSERT INTO courses
              (curriculum_id, course_code, course_title, unit_lec, unit_lab,
               hour_lec, hour_lab, year_level_id, semester_id)
              VALUES
              (:curriculum_id, :course_code, :course_title, :unit_lec, :unit_lab,
               :hour_lec, :hour_lab, :year_level_id, :semester_id)";

    $stmt = $conn->prepare($query);

    // Bind parameters for courses table
    $stmt->bindParam(":curriculum_id", $data->curriculum_id, PDO::PARAM_INT);
    $stmt->bindParam(":course_code", $course_code);
    $stmt->bindParam(":course_title", $course_title);
    $stmt->bindParam(":unit_lec", $data->unit_lec);
    $stmt->bindParam(":unit_lab", $data->unit_lab);
    $stmt->bindParam(":hour_lec", $data->hour_lec);
    $stmt->bindParam(":hour_lab", $data->hour_lab);
    $stmt->bindParam(":year_level_id", $data->year_level_id, PDO::PARAM_INT);
    $stmt->bindParam(":semester_id", $data->semester_id, PDO::PARAM_INT);

    // Execute insert for the course
    if ($stmt->execute()) {
        $new_course_id = $conn->lastInsertId();

        // Get all students with the same curriculum_id
        $student_query = "SELECT student_id FROM students WHERE curriculum_id = :curriculum_id";
        $student_stmt = $conn->prepare($student_query);
        $student_stmt->bindParam(":curriculum_id", $data->curriculum_id, PDO::PARAM_INT);
        $student_stmt->execute();

        // Insert a record in course_grades for each student
        $insert_grade_query = "INSERT INTO course_grades (student_id, course_id) VALUES (:student_id, :course_id)";
        $insert_grade_stmt = $conn->prepare($insert_grade_query);
        $insert_grade_stmt->bindParam(":course_id", $new_course_id, PDO::PARAM_INT);

        while ($student_row = $student_stmt->fetch(PDO::FETCH_ASSOC)) {
            $student_id = $student_row['student_id'];
            $insert_grade_stmt->bindParam(":student_id", $student_id);
            if (!$insert_grade_stmt->execute()) {
                // Handle error during grade insertion
                throw new Exception("Failed to add grade for student ID: " . $student_id . " Error: " . print_r($insert_grade_stmt->errorInfo(), true));
            }
        }

        // Handle prerequisites (assuming $data->prerequisite_ids is an array)
        $prerequisites_added = [];
        if (isset($data->prerequisite_ids) && is_array($data->prerequisite_ids) && !empty($data->prerequisite_ids)) {
            $prereq_query = "INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (:course_id, :prerequisite_course_id)";
            $prereq_stmt = $conn->prepare($prereq_query);

            foreach ($data->prerequisite_ids as $prereq_id) {
                $prereq_id_sanitized = filter_var($prereq_id, FILTER_VALIDATE_INT);
                if ($prereq_id_sanitized && $prereq_id_sanitized > 0) {
                    // Optional: Check if prerequisite course exists and belongs to the same curriculum
                    // For simplicity, we assume valid IDs are sent from the frontend for now.
                    $prereq_stmt->bindParam(":course_id", $new_course_id, PDO::PARAM_INT);
                    $prereq_stmt->bindParam(":prerequisite_course_id", $prereq_id_sanitized, PDO::PARAM_INT);
                    if (!$prereq_stmt->execute()) {
                         // Handle error during prerequisite insertion
                         throw new Exception("Failed to add prerequisite ID: " . $prereq_id_sanitized . " Error: " . print_r($prereq_stmt->errorInfo(), true));
                    }
                    $prerequisites_added[] = $prereq_id_sanitized; // Keep track of successfully added ones
                }
            }
        }

        // Commit transaction
        $conn->commit();

        // Fetch the newly created course data along with its prerequisites
        // (Using the logic similar to get_courses.php for consistency)
        $select_query = "SELECT * FROM courses WHERE id = :id";
        $select_stmt = $conn->prepare($select_query);
        $select_stmt->bindParam(":id", $new_course_id);
        $select_stmt->execute();
        $new_record = $select_stmt->fetch(PDO::FETCH_ASSOC);

        // Fetch prerequisites for the new course
        $prereq_fetch_query = "
            SELECT cp.prerequisite_course_id, c.course_code
            FROM course_prerequisites cp
            JOIN courses c ON cp.prerequisite_course_id = c.id
            WHERE cp.course_id = :course_id";
        $prereq_fetch_stmt = $conn->prepare($prereq_fetch_query);
        $prereq_fetch_stmt->bindParam(":course_id", $new_course_id);
        $prereq_fetch_stmt->execute();
        $prerequisites_data = [];
        while ($prereq_row = $prereq_fetch_stmt->fetch(PDO::FETCH_ASSOC)) {
            $prerequisites_data[] = [
                'id' => $prereq_row['prerequisite_course_id'],
                'code' => $prereq_row['course_code']
            ];
        }

        http_response_code(201);
        echo json_encode(array(
            "success" => true,
            "message" => "Course was created.",
            "course" => array( // Match structure expected by frontend/get_courses
                "id" => $new_record['id'],
                "curriculum_id" => $new_record['curriculum_id'],
                "course_code" => $new_record['course_code'],
                "course_title" => $new_record['course_title'],
                "unit_lec" => $new_record['unit_lec'],
                "unit_lab" => $new_record['unit_lab'],
                "hour_lec" => $new_record['hour_lec'],
                "hour_lab" => $new_record['hour_lab'],
                "prerequisites" => $prerequisites_data, // Send array of prerequisites
                "year_level_id" => $new_record['year_level_id'],
                "semester_id" => $new_record['semester_id']
            )
        ));
    } else {
        $conn->rollBack(); // Rollback transaction on course insert failure
        http_response_code(503);
        echo json_encode(array("message" => "Unable to add course. Error: " . print_r($stmt->errorInfo(), true)));
    }
} catch (PDOException $e) {
    $conn->rollBack(); // Rollback on PDO exception
    http_response_code(503);
    error_log("PDOException in add_course.php: " . $e->getMessage());
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
} catch (Exception $e) {
    $conn->rollBack(); // Rollback on general exception
    http_response_code(500);
    error_log("Exception in add_course.php: " . $e->getMessage());
    echo json_encode(array("message" => "An error occurred: " . $e->getMessage()));
}
?>