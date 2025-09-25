<?php
// Required headers
include_once '../../config/cors.php';
require_once '../../config/database.php';

// Set content type to JSON
header("Content-Type: application/json; charset=UTF-8");

// Check if student_id, academic_year, and semester are provided
$student_id = isset($_GET['student_id']) ? trim($_GET['student_id'], '\" ') : die("Missing student_id parameter.");
$academic_year = isset($_GET['academic_year']) ? trim($_GET['academic_year'], '\" ') : die("Missing academic_year parameter.");
$semester = isset($_GET['semester']) ? trim($_GET['semester'], '\" ') : die("Missing semester parameter.");

// Add logging for received parameters
error_log("Received student_id: " . $student_id);
error_log("Received academic_year: " . $academic_year);
error_log("Received semester: " . $semester);

// Prepare a SQL query to select advised courses with joins
$query = "SELECT
            ac.advised_course_id,
            s.name as student_name,
            c.course_code,
            c.course_title,
            cg.transmutation AS grade,
            cg.remarks AS remarks,
            (c.unit_lec + c.unit_lab) AS units,
            pr.course_code AS prerequisite_code,
            pr.course_title AS prerequisite_title,
            ay.academic_year_name as academic_year_name,
            sem.semester_name,
            e.name as advisor_name,
            ac.advising_date
          FROM advised_courses ac
          LEFT JOIN students s ON ac.student_id = s.student_id
          LEFT JOIN courses c ON ac.course_id = c.id
          LEFT JOIN course_prerequisites cp ON c.id = cp.course_id
          LEFT JOIN courses pr ON cp.prerequisite_course_id = pr.id
          LEFT JOIN academic_years ay ON ac.academic_year_id = ay.academic_year_id
          LEFT JOIN semesters sem ON ac.semester_id = sem.semester_id
          LEFT JOIN employees e ON ac.advisor_id = e.employee_id
          LEFT JOIN course_grades cg ON ac.student_id = cg.student_id AND ac.course_id = cg.course_id
          WHERE ac.student_id = :student_id
            AND ay.academic_year_name = :academic_year
            AND sem.semester_name = :semester
          ORDER BY ac.advising_date DESC";

// Add logging for the prepared query
error_log("Prepared SQL query: " . $query);

$stmt = $conn->prepare($query);

// Bind parameters
$stmt->bindParam(':student_id', $student_id);
$stmt->bindParam(':academic_year', $academic_year);
$stmt->bindParam(':semester', $semester);

// Add logging for bound parameters
error_log("Bound student_id: " . $student_id);
error_log("Bound academic_year: " . $academic_year);
error_log("Bound semester: " . $semester);

// Execute query
try {
    if ($stmt->execute()) {
        $num = $stmt->rowCount();
        error_log("Query executed successfully. Rows found: " . $num);
        $advised_courses_arr = [];

        if ($num > 0) {
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                extract($row);

                $advised_course_item = [
                    "advised_course_id" => $advised_course_id,
                    "student_name" => $student_name,
                    "course_code" => $course_code,
                    "course_title" => $course_title,
                    "grade" => $grade,
                    "remarks" => $remarks,
                    "units" => $units,
                    "prerequisite_code" => $prerequisite_code,
                    "prerequisite_title" => $prerequisite_title,
                    "academic_year_name" => $academic_year_name,
                    "semester_name" => $semester_name,
                    "advisor_name" => $advisor_name,
                    "advising_date" => $advising_date
                ];
                array_push($advised_courses_arr, $advised_course_item);
            }
        }

        http_response_code(200);
        echo json_encode($advised_courses_arr);
    } else {
        $error_info = $stmt->errorInfo();
        error_log("Query execution failed: " . $error_info[2]);
        http_response_code(500);
        echo json_encode(["message" => "Unable to fetch advised courses. Error: " . $error_info[2]]);
    }
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["message" => "Database error: " . $e->getMessage()]);
}

?>
