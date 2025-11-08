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

// --- Get POST data ---
$data = json_decode(file_get_contents("php://input"));

// Check if all required data is present
if (!isset($data->student_id) || !isset($data->grades) || !is_array($data->grades)) {
    http_response_code(400); // Bad Request
    echo json_encode(['message' => 'Missing required data: student_id or grades array.']);
    exit;
}

$student_id = $data->student_id;
$grades = $data->grades;

try {
    $conn->beginTransaction();

    foreach ($grades as $grade_entry) {
        if (!isset($grade_entry->course_id) || !isset($grade_entry->grade)) {
            throw new Exception('Invalid grade entry: missing course_id or grade.');
        }

        $course_id = $grade_entry->course_id;
        $grade_value = $grade_entry->grade;
        
        // Determine remarks based on grade_value (5-point grading scale: 5.00 is failed, 3.00 and above is passed)
        $remarks_value = null;
        if (is_numeric($grade_value)) {
            $numeric_grade = (float)$grade_value;
            if ($numeric_grade >= 1.00 && $numeric_grade <= 3.00) {
                $remarks_value = "Passed";
            } else if ($numeric_grade == 5.00) {
                $remarks_value = "Failed";
            } else if ($numeric_grade > 3.00 && $numeric_grade < 5.00) { // Values like 3.25, 3.50, 4.00, 4.50
                $remarks_value = "Failed";
            }
        } else if (strtolower($grade_value) === 'inc') {
            $remarks_value = 'Incomplete';
        } else if (strtolower($grade_value) === 'drp') {
            $remarks_value = 'Dropped';
        }

        // Prepare SQL for INSERT ... ON DUPLICATE KEY UPDATE
        // This assumes 'student_id' and 'course_id' form a unique key in 'course_grades'
        $query = "INSERT INTO course_grades (student_id, course_id, transmutation, remarks, is_credited) VALUES (:student_id, :course_id, :grade, :remarks, TRUE)
                  ON DUPLICATE KEY UPDATE transmutation = :grade, remarks = :remarks, is_credited = TRUE";
        
        $stmt = $conn->prepare($query);
        $stmt->bindParam(':student_id', $student_id);
        $stmt->bindParam(':course_id', $course_id);
        $stmt->bindParam(':grade', $grade_value);
        $stmt->bindParam(':remarks', $remarks_value);
        $stmt->execute();
    }

    $conn->commit();

    http_response_code(200);
    echo json_encode(['message' => 'Grades saved successfully.']);

} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(500); // Internal Server Error
    error_log("Error saving grades: " . $e->getMessage());
    echo json_encode(['message' => 'Failed to save grades.', 'error' => $e->getMessage()]);
} catch (PDOException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(503); // Service Unavailable for database errors
    error_log("Database error saving grades: " . $e->getMessage());
    echo json_encode(['message' => 'Database error.', 'error' => $e->getMessage()]);
}

?>
