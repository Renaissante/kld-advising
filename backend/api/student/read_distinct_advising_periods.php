<?php
// Required headers
include_once '../../config/cors.php';
require_once '../../config/database.php';

// Set content type to JSON
header("Content-Type: application/json; charset=UTF-8");

// Check if student_id is provided
$student_id = isset($_GET['student_id']) ? trim($_GET['student_id'], '\" ') : die("Missing student_id parameter.");

// Add logging for received student_id
error_log("Received student_id: " . $student_id);

// Prepare a SQL query to select distinct academic years and semesters for a student
$query = "SELECT DISTINCT
            ay.academic_year_name as academic_year_name,
            sem.semester_name,
            ay.academic_year_id,
            sem.semester_id,
            COALESCE(e.name, 'N/A') as advisor_name,
            MAX(ac.advising_date) as latest_advising_date
          FROM advised_courses ac
          JOIN academic_years ay ON ac.academic_year_id = ay.academic_year_id
          JOIN semesters sem ON ac.semester_id = sem.semester_id
          LEFT JOIN employees e ON ac.advisor_id = e.employee_id
          WHERE ac.student_id = :student_id
          GROUP BY ay.academic_year_id, sem.semester_id
          ORDER BY ay.academic_year_name DESC, sem.semester_name DESC";

// Add logging for the prepared query
error_log("Prepared SQL query: " . $query);

$stmt = $conn->prepare($query);

// Bind parameters
$stmt->bindParam(':student_id', $student_id);

// Add logging for bound parameters
error_log("Bound student_id: " . $student_id);

// Execute query
try {
    if ($stmt->execute()) {
        $num = $stmt->rowCount();
        error_log("Query executed successfully. Rows found: " . $num);
        $advising_periods_arr = [];

        if ($num > 0) {
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                extract($row);

                $advising_period_item = [
                    "academic_year_name" => $academic_year_name,
                    "semester_name" => $semester_name,
                    "academic_year_id" => $academic_year_id,
                    "semester_id" => $semester_id,
                    "advisor_name" => $advisor_name,
                    "latest_advising_date" => $latest_advising_date
                ];
                array_push($advising_periods_arr, $advising_period_item);
            }
        }

        http_response_code(200);
        echo json_encode($advising_periods_arr);
    } else {
        $error_info = $stmt->errorInfo();
        error_log("Query execution failed: " . $error_info[2]);
        http_response_code(500);
        echo json_encode(["message" => "Unable to fetch distinct advising periods. Error: " . $error_info[2]]);
    }
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["message" => "Database error: " . $e->getMessage()]);
}

?>
