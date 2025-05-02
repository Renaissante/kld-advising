<?php
// Include CORS headers
include_once '../../config/cors.php';

// Set headers for content type
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS request (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header("Access-Control-Allow-Methods: GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    exit(0);
}

// Start session to check for logged in user
session_start();

// Include database configuration
include_once '../../config/database.php';

// Check connection
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in get_courses.php.");
    echo json_encode(array("success" => false, "message" => "Database connection failed."));
    exit();
}

// Get faculty ID - check query parameter first (for testing), then session
$facultyId = isset($_GET['faculty_id']) ? $_GET['faculty_id'] : null;

// If no query parameter, check session
if (!$facultyId && isset($_SESSION['user_id'])) {
    $facultyId = $_SESSION['user_id'];
    
    // Also verify role if available
    if (isset($_SESSION['role']) && $_SESSION['role'] !== 'faculty') {
        http_response_code(403);
        echo json_encode(array("success" => false, "message" => "Forbidden: User is not a faculty member"));
        exit();
    }
}

// If still no faculty ID, return unauthorized
if (!$facultyId) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Unauthorized: You must be logged in as faculty"));
    exit();
}

try {
    // Query to get distinct courses, sections, AY, and Semester for the faculty
    $query = "SELECT
                c.id AS course_id,
                c.course_code,
                c.course_title,
                s.id AS section_id,
                s.name,
                ay.academic_year_name AS academic_year,
                sem.semester_name AS semester_name,
                sem.semester_id,
                yl.level AS year_level
            FROM section_faculty sf
            JOIN courses c ON sf.course_id = c.id
            JOIN sections s ON sf.section_id = s.id
            JOIN academic_years ay ON s.academic_year_id = ay.academic_year_id
            JOIN semesters sem ON s.semester_id = sem.semester_id
            LEFT JOIN year_levels yl ON s.year_level_id = yl.id
            WHERE sf.faculty_id = :faculty_id
            ORDER BY ay.academic_year_name DESC, sem.semester_id, c.course_code, s.name";

    // Prepare statement
    $stmt = $conn->prepare($query);
    if ($stmt === false) {
        throw new PDOException("Failed to prepare query: " . implode(" - ", $conn->errorInfo()));
    }

    // Bind faculty ID
    $stmt->bindParam(':faculty_id', $facultyId);

    // Execute query
    $stmt->execute();
    $num = $stmt->rowCount();

    // Check if courses were found
    if ($num > 0) {
        // Fetch all results
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Process the results to group sections by course, AY, and Semester
        $coursesMap = array();

        foreach ($results as $row) {
            $courseKey = $row['course_id'] . '-' . $row['academic_year'] . '-' . $row['semester_name'];

            if (!isset($coursesMap[$courseKey])) {
                $coursesMap[$courseKey] = array(
                    "id" => $row['course_id'],
                    "code" => $row['course_code'],
                    "title" => $row['course_title'],
                    "ay" => $row['academic_year'],
                    "sem" => $row['semester_name'],
                    "semester_id" => $row['semester_id'],
                    "year_level" => $row['year_level'],
                    "sections" => array(),
                );
            }

            // Add the section information to the corresponding course entry
            $coursesMap[$courseKey]['sections'][] = array(
                "id" => $row['section_id'],
                "name" => $row['name']
            );
        }

        // Convert the map values to a simple indexed array for the final JSON output
        $formattedCourses = array_values($coursesMap);

        // Set response code - 200 OK
        http_response_code(200);

        // Send response
        echo json_encode(array(
            "success" => true,
            "count" => count($formattedCourses),
            "data" => $formattedCourses
        ));

    } else {
        // Set response code - 200 OK
        http_response_code(200);
        // Send response indicating no courses found for this faculty
        echo json_encode(array(
            "success" => true, 
            "count" => 0, 
            "data" => [], 
            "message" => "No courses found assigned to this faculty member."
        ));
    }
} catch (PDOException $e) {
    http_response_code(503);
    error_log("Database error in get_courses.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false, 
        "message" => "Database error: " . $e->getMessage()
    ));
} catch (Exception $e) {
    // Catch other potential errors
    http_response_code(500);
    error_log("General error in get_courses.php: " . $e->getMessage());
    echo json_encode(array(
        "success" => false, 
        "message" => "Server error: " . $e->getMessage()
    ));
}
?>