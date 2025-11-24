<?php
// Allow requests from your frontend development server
include_once '../../config/cors.php';
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS request (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Include database connection
include_once '../../config/database.php';

// Get parameters from the GET request
$student_id = isset($_GET['student_id']) ? $_GET['student_id'] : null;
$next_academic_year_id = isset($_GET['next_academic_year_id']) ? intval($_GET['next_academic_year_id']) : null;
$next_semester_id = isset($_GET['next_semester_id']) ? intval($_GET['next_semester_id']) : null;

// Validate parameters
if (!$student_id || !$next_semester_id) {
    http_response_code(400); // Bad Request
    echo json_encode(['message' => 'Student ID and next semester ID are required.']);
    exit;
}

try {
    // Query to fetch failed courses for retake in the NEXT semester
    $query = "SELECT
                c.id,
                c.course_code,
                c.course_title,
                c.year_level_id,
                c.semester_id,
                c.unit_lec,
                c.unit_lab,
                cg.remarks AS grade_remarks -- Select remarks to check for 'Failed'
            FROM courses c
            JOIN course_grades cg ON c.id = cg.course_id
            WHERE cg.student_id = :student_id
              AND cg.remarks = 'Failed' -- Filter by remarks being 'Failed' or 'F'
              AND c.semester_id = :next_semester_id
              AND NOT EXISTS (
                    SELECT 1
                    FROM course_prerequisites cp
                    JOIN course_grades prereq_cg ON cp.prerequisite_course_id = prereq_cg.course_id
                    WHERE cp.course_id = c.id
                      AND prereq_cg.student_id = :student_id
                      AND prereq_cg.remarks IN ('Failed', 'F') -- If any prerequisite is failed, do not include the course
                )
            GROUP BY c.id, c.course_code, c.course_title, c.year_level_id, c.semester_id, c.unit_lec, c.unit_lab, cg.remarks -- Remove academic_year_id from GROUP BY
            ORDER BY c.year_level_id ASC, c.semester_id ASC, c.id ASC";

    $stmt = $conn->prepare($query);
    $stmt->bindParam(':student_id', $student_id);
    $stmt->bindParam(':next_semester_id', $next_semester_id);
    $stmt->execute();

    $failed_courses_for_retake = [];
    if ($stmt->rowCount() > 0) {
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $course = array(
                "id" => $row['id'],
                "course_code" => $row['course_code'],
                "course_title" => $row['course_title'],
                "year_level_id" => $row['year_level_id'],
                "semester_id" => $row['semester_id'],
                "unit_lec" => $row['unit_lec'],
                "unit_lab" => $row['unit_lab'],
                "units" => (float)$row['unit_lec'] + (float)$row['unit_lab'],
                "grade_remarks" => $row['grade_remarks']
            );
            array_push($failed_courses_for_retake, $course);
        }
    }

    http_response_code(200);
    echo json_encode([
        'failed_courses_for_retake' => $failed_courses_for_retake
    ]);

} catch (PDOException $e) {
    http_response_code(503); // Service Unavailable
    error_log("Database error in get_failed_courses_for_retake.php: " . $e->getMessage());
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
} catch (Exception $e) {
    http_response_code(500); // Internal Server Error
    error_log("Error in get_failed_courses_for_retake.php: " . $e->getMessage());
    echo json_encode(array("message" => "An unexpected error occurred: " . $e->getMessage()));
}

?>
