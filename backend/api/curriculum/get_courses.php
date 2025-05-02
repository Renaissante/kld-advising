<?php
// Allow Cross-Origin Resource Sharing
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Include database connection
include_once '../../config/database.php';

// Log request parameters
error_log("GET Params: " . print_r($_GET, true));

// Check if curriculum_id is provided
if (!isset($_GET['curriculum_id'])) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Missing curriculum_id parameter"));
    exit;
}

$curriculum_id = filter_var($_GET['curriculum_id'], FILTER_VALIDATE_INT);
if (!$curriculum_id) {
     http_response_code(400);
     echo json_encode(array("success" => false, "message" => "Invalid curriculum_id parameter"));
     exit;
}

error_log("Looking for courses with curriculum_id: " . $curriculum_id);

try {
    // Use the $conn variable directly from database.php
    error_log("Database connection established: " . ($conn ? "Yes" : "No"));
   
    // Query 1: Get all courses for the specified curriculum (without prerequisite info yet)
    $query_courses = "
        SELECT
            id,
            curriculum_id,
            course_code,
            course_title,
            unit_lec,
            unit_lab,
            hour_lec,
            hour_lab,
            year_level_id,
            semester_id
        FROM
            courses
        WHERE
            curriculum_id = :curriculum_id
        ORDER BY
            id"; // Added better sorting
            
    error_log("SQL Query (Courses): " . $query_courses);
   
    $stmt_courses = $conn->prepare($query_courses);
    $stmt_courses->bindParam(':curriculum_id', $curriculum_id, PDO::PARAM_INT);
    $stmt_courses->execute();
   
    error_log("Courses query executed. Found rows: " . $stmt_courses->rowCount());
   
    $courses_array = array();
    $course_ids = array();
   
    if ($stmt_courses->rowCount() > 0) {
        while ($row = $stmt_courses->fetch(PDO::FETCH_ASSOC)) {
            // Initialize prerequisites as an empty array for each course
            $row['prerequisites'] = [];
            $courses_array[$row['id']] = $row; // Use course ID as key for easy lookup
            $course_ids[] = $row['id'];
        }

        // Query 2: Get all prerequisite relationships for the fetched courses
        if (!empty($course_ids)) {
            // Create placeholders for the IN clause
            $placeholders = implode(',', array_fill(0, count($course_ids), '?'));
            
            $query_prereqs = "
                SELECT
                    cp.course_id, -- The course that HAS the prerequisite
                    cp.prerequisite_course_id, -- The ID of the prerequisite course
                    prereq_course.course_code AS prerequisite_code -- The code of the prerequisite course
                FROM
                    course_prerequisites cp
                JOIN
                    courses prereq_course ON cp.prerequisite_course_id = prereq_course.id
                WHERE
                    cp.course_id IN ($placeholders)";

            error_log("SQL Query (Prerequisites): " . $query_prereqs);
            $stmt_prereqs = $conn->prepare($query_prereqs);
            
            // Bind each course ID individually
            foreach ($course_ids as $k => $id) {
                $stmt_prereqs->bindValue(($k + 1), $id, PDO::PARAM_INT);
            }
            
            $stmt_prereqs->execute();
            error_log("Prerequisites query executed. Found rows: " . $stmt_prereqs->rowCount());

            // Map prerequisites back to their respective courses
            while ($prereq_row = $stmt_prereqs->fetch(PDO::FETCH_ASSOC)) {
                $course_id_key = $prereq_row['course_id'];
                if (isset($courses_array[$course_id_key])) {
                    $courses_array[$course_id_key]['prerequisites'][] = array(
                        'id' => $prereq_row['prerequisite_course_id'],
                        'code' => $prereq_row['prerequisite_code']
                    );
                }
            }
        }
       
        // Convert the associative array back to a simple indexed array for the JSON response
        $final_courses_list = array_values($courses_array);

        error_log("Courses processed: " . count($final_courses_list));
        error_log("First course data: " . print_r($final_courses_list[0] ?? 'none', true));
       
        http_response_code(200);
        // Return success=true and the courses array (which might be empty)
        echo json_encode(array("success" => true, "courses" => $final_courses_list));

    } else {
        // No courses found for this curriculum
        error_log("No courses found for curriculum_id: " . $curriculum_id);
        http_response_code(200);
        // Still return success=true, but with an empty courses array
        echo json_encode(array("success" => true, "courses" => array(), "message" => "No courses found for this curriculum"));
    }
} catch (PDOException $e) {
    error_log("Database error in get_courses.php: " . $e->getMessage());
    http_response_code(503);
    echo json_encode(array("success" => false, "message" => "Database error: " . $e->getMessage()));
}
?>