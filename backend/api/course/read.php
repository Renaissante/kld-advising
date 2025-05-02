<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';

try {
    // Query to get courses
    $query = "SELECT 
                c.id,
                c.course_code,
                c.course_title as title,
                y.level as year_level,
                s.semester_name as semester,
                c.unit_lec,
                c.unit_lab,
                c.hour_lec,
                c.hour_lab
            FROM 
                courses c
            LEFT JOIN 
                year_levels y ON c.year_level_id = y.id
            LEFT JOIN 
                semesters s ON c.semester_id = s.semester_id
            ORDER BY 
                c.course_code ASC";

    // Prepare statement
    $stmt = $conn->prepare($query);

    // Execute query
    $stmt->execute();
    $num = $stmt->rowCount();

    // Check if courses were found
    if ($num > 0) {
        // Courses array
        $courses_arr = array();

        // Fetch courses into associative array
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            extract($row);

            $course_item = array(
                "id" => $id,
                "course_code" => $course_code,
                "title" => $title,
                "year_level" => $year_level,
                "semester" => $semester,
                "unit_lec" => $unit_lec,
                "unit_lab" => $unit_lab,
                "hour_lec" => $hour_lec,
                "hour_lab" => $hour_lab
            );

            array_push($courses_arr, $course_item);
        }

        // Set response code - 200 OK
        http_response_code(200);

        // Send response
        echo json_encode($courses_arr);
    } else {
        // Set response code - 404 Not found
        http_response_code(404);

        // Tell the user no courses found
        echo json_encode(array("message" => "No courses found."));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
} 