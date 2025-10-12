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

// Include database configuration
include_once '../../config/database.php';

// Check if the connection variable exists and is valid
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    error_log("Database connection failed in read_students_by_unavailable_advisor.php. Check config/database.php and ensure $conn is set.");
    echo json_encode(array("message" => "Database connection failed."));
    exit();
}

// Get academic_year_id and semester_id from URL query parameters
$academic_year_id = isset($_GET['academic_year_id']) ? $_GET['academic_year_id'] : die();
$semester_id = isset($_GET['semester_id']) ? $_GET['semester_id'] : die();

try {
    // TODO: Implement Authorization: Only faculty (advisors) should be able to view this list.
    // This could involve checking user roles from a session or JWT token.

    // Query to get students whose assigned advisor is 'unavailable'
    $query = "SELECT
                s.student_id AS id,
                s.name,
                s.status,
                -- Subquery to calculate total units of courses ACTUALLY advised for this student
                (SELECT COALESCE(SUM(c.unit_lec + c.unit_lab), 0)
                 FROM advised_courses ac
                 JOIN courses c ON ac.course_id = c.id
                 WHERE ac.student_id = s.student_id
                   AND ac.academic_year_id = :academic_year_id
                   AND ac.semester_id = :semester_id
                ) AS units,
                -- Determine advising status
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM advised_courses ac
                        WHERE ac.student_id = s.student_id
                        AND ac.academic_year_id = :academic_year_id
                        AND ac.semester_id = :semester_id
                    ) THEN 'Done'
                    ELSE 'Pending'
                END AS advising_status
              FROM students s
              JOIN sections sec ON s.section_id = sec.id
              JOIN section_advisors sa ON sec.id = sa.section_id
              JOIN faculty f ON sa.advisor_id = f.employee_id
              WHERE f.advisor_status = 'unavailable'
                AND sec.academic_year_id = :academic_year_id
                AND sec.semester_id = :semester_id
                AND NOT EXISTS (
                    SELECT 1
                    FROM advised_courses ac
                    WHERE ac.student_id = s.student_id
                    AND ac.academic_year_id = :academic_year_id
                    AND ac.semester_id = :semester_id
                ) -- Only include students who have NOT completed advising
              ORDER BY s.name ASC";

    $stmt = $conn->prepare($query);

    if ($stmt === false) {
        throw new PDOException("Failed to prepare the query for unavailable advisors. Error: " . implode(" - ", $conn->errorInfo()));
    }

    // Bind parameters
    $stmt->bindParam(':academic_year_id', $academic_year_id, PDO::PARAM_INT);
    $stmt->bindParam(':semester_id', $semester_id, PDO::PARAM_INT);

    $stmt->execute();

    $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $num = count($students);

    if ($num > 0) {
        http_response_code(200);
        // Ensure units is an integer
        $students_data = array_map(function($student) {
            $student['units'] = (int)$student['units'];
            return $student;
        }, $students);

        echo json_encode(array("success" => true, "count" => $num, "data" => $students_data, "message" => "Students with unavailable advisors retrieved successfully."));
    } else {
        http_response_code(200); // Changed to 200 with empty data array if no students found
        echo json_encode(array("success" => true, "count" => 0, "data" => [], "message" => "No students found with unavailable advisors for the specified academic year and semester."));
    }

} catch (PDOException $exception) {
    http_response_code(500);
    error_log("Database error in read_students_by_unavailable_advisor.php: " . $exception->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "Unable to fetch students due to a database error.",
        "error_details_debug" => $exception->getMessage()
    ));
} catch (Exception $exception) {
    http_response_code(500);
    error_log("General error in read_students_by_unavailable_advisor.php: " . $exception->getMessage());
    echo json_encode(array(
        "success" => false,
        "message" => "An unexpected error occurred.",
        "error_details_debug" => $exception->getMessage()
    ));
}
?>
