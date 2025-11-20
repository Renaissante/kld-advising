<?php
// Include CORS headers
include_once '../../config/cors.php';

// Set headers for content type
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS request (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header("Access-Control-Allow-Methods: PUT, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    exit(0);
}

// Include database configuration
include_once '../../config/database.php';

// Start session
// session_start();

// // Check if user is logged in and is an admin
// if (!isset($_SESSION['user_id']) || !in_array('admin', $_SESSION['user_roles'])) {
//     http_response_code(403);
//     echo json_encode(array("message" => "Forbidden: You do not have permission to update assignments."));
//     exit();
// }

// Check if the connection variable exists and is valid
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in update_assignment.php. Check config/database.php and ensure $conn is set.");
    echo json_encode(array("message" => "Database connection failed."));
    exit();
}

// Get data from request body
$data = json_decode(file_get_contents("php://input"));

// Validate input
if (empty($data->assignment_id) || empty($data->course_id) || empty($data->section_id)) {
    http_response_code(400);
    echo json_encode(array("message" => "Missing required parameters: assignment_id, course_id, or section_id."));
    exit();
}

$assignment_id = $data->assignment_id;
$course_id = $data->course_id;
$section_id = $data->section_id;

// TODO: Implement Authorization: Only Program Chairs or Deans should be able to update assignments.
// This could involve checking user roles from a session or JWT token.

try {
    // Update query for the section_faculty table
    $query = "UPDATE section_faculty
              SET course_id = :course_id, section_id = :section_id
              WHERE id = :assignment_id";

    $stmt = $conn->prepare($query);

    if ($stmt === false) {
        throw new PDOException("Failed to prepare the update query. Error: " . implode(" - ", $conn->errorInfo()));
    }

    // Bind parameters
    $stmt->bindParam(':course_id', $course_id);
    $stmt->bindParam(':section_id', $section_id);
    $stmt->bindParam(':assignment_id', $assignment_id);

    // Execute the query
    if ($stmt->execute()) {
        if ($stmt->rowCount() > 0) {
            // Fetch the updated assignment to return to the frontend
            $read_query = "SELECT
                                sf.id as assignment_id,
                                c.id as course_id, c.course_code as course_code, c.course_title as course_title,
                                sec.id as section_id, sec.name as section_name,
                                yl.level as year_level,
                                sem.semester_name as semester
                            FROM section_faculty sf
                            JOIN courses c ON sf.course_id = c.id
                            JOIN sections sec ON sf.section_id = sec.id
                            LEFT JOIN year_levels yl ON sec.year_level_id = yl.id
                            LEFT JOIN semesters sem ON sec.semester_id = sem.semester_id
                            WHERE sf.id = :assignment_id";

            $read_stmt = $conn->prepare($read_query);
            $read_stmt->bindParam(':assignment_id', $assignment_id);
            $read_stmt->execute();
            $updated_assignment = $read_stmt->fetch(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode(array("message" => "Assignment updated successfully.", "updatedAssignment" => $updated_assignment));
        } else {
            http_response_code(404);
            echo json_encode(array("message" => "No assignment found with the provided ID or no changes were made."));
        }
    } else {
        http_response_code(500);
        error_log("Error updating assignment: " . implode(" - ", $stmt->errorInfo()));
        echo json_encode(array("message" => "Failed to update assignment."));
    }

} catch (PDOException $exception) {
    http_response_code(500);
    error_log("Database error in update_assignment.php: " . $exception->getMessage());
    echo json_encode(array(
        "message" => "Unable to update assignment due to a database error.",
        "error_details_debug" => $exception->getMessage()
    ));
} catch (Exception $exception) {
    http_response_code(500);
    error_log("General error in update_assignment.php: " . $exception->getMessage());
    echo json_encode(array(
        "message" => "An unexpected error occurred.",
        "error_details_debug" => $exception->getMessage()
    ));
}
?>
