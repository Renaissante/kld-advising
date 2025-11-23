<?php
// Allow requests from your frontend development server
include_once '../../config/cors.php';
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS request (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// --- Includes ---
include_once '../../config/database.php';

// --- Get parameters from the GET request ---
$student_id = isset($_GET['student_id']) ? $_GET['student_id'] : null;
$academic_year_id = isset($_GET['academic_year_id']) ? intval($_GET['academic_year_id']) : null;
$semester_id = isset($_GET['semester_id']) ? intval($_GET['semester_id']) : null;

if (!$student_id || !$academic_year_id || !$semester_id) {
    http_response_code(400); // Bad Request
    echo json_encode(['message' => 'Student ID, Academic Year ID, and Semester ID are required.']);
    exit;
}

try {
    // Query to fetch approved advised courses for the current semester
    $query = "SELECT ac.course_id, c.course_code, c.course_title, c.unit_lec, c.unit_lab
              FROM kld_advising.advised_courses ac
              JOIN kld_advising.courses c ON ac.course_id = c.id
              WHERE ac.student_id = :student_id
                AND ac.academic_year_id = :academic_year_id
                AND ac.semester_id = :semester_id
                AND ac.status = 'approved'";

    $stmt = $conn->prepare($query);
    $stmt->bindParam(':student_id', $student_id);
    $stmt->bindParam(':academic_year_id', $academic_year_id);
    $stmt->bindParam(':semester_id', $semester_id);
    $stmt->execute();

    $advised_courses = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $advised_courses[] = [
            'id' => $row['course_id'],
            'course_code' => $row['course_code'],
            'course_title' => $row['course_title'],
            'units' => (float)$row['unit_lec'] + (float)$row['unit_lab'],
        ];
    }

    http_response_code(200);
    echo json_encode(['advised_courses' => $advised_courses]);

} catch (PDOException $e) {
    http_response_code(503); // Service Unavailable
    error_log("Database error in get_current_semester_advised_courses.php: " . $e->getMessage());
    echo json_encode(["message" => "Database error: " . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500); // Internal Server Error
    error_log("Error in get_current_semester_advised_courses.php: " . $e->getMessage());
    echo json_encode(["message" => "An unexpected error occurred: " . $e->getMessage()]);
}
?>
