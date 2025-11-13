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
// Use your existing database connection script
include_once '../../config/database.php';

// --- Remove Authentication ---
// session_start();

// --- Get student_id from the GET request ---
$student_id = isset($_GET['student_id']) ? $_GET['student_id'] : null;

if (!$student_id) {
    http_response_code(400); // Bad Request
    echo json_encode(['message' => 'Student ID is required.']);
    exit;
}

try {
    // $conn variable is expected from database.php

    // 1. Get the student's curriculum_id
    $student_query = "SELECT curriculum_id, name FROM students WHERE student_id = :student_id";
    $student_stmt = $conn->prepare($student_query);
    $student_stmt->bindParam(':student_id', $student_id);
    $student_stmt->execute();

    $student_row = $student_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$student_row) {
        http_response_code(404);
        echo json_encode(array("message" => "Student not found."));
        exit;
    }

    $curriculum_id = $student_row['curriculum_id'];
    $student_name = $student_row['name']; // Fetch student's name

    if (!$curriculum_id) {
        http_response_code(404);
        echo json_encode(array("message" => "Curriculum not assigned to student."));
        exit;
    }

    // --- 2. Fetch Curriculum Details ---
    $curriculum_details_query = "SELECT name, program_id, academic_year_id FROM curriculums WHERE curriculum_id = :curriculum_id";
    $curriculum_details_stmt = $conn->prepare($curriculum_details_query);
    $curriculum_details_stmt->bindParam(':curriculum_id', $curriculum_id);
    $curriculum_details_stmt->execute();
    $curriculum_details = $curriculum_details_stmt->fetch(PDO::FETCH_ASSOC);

    // --- Fetch program name and academic year ---
    $program_query = "SELECT name FROM programs WHERE id = :program_id";
    $program_stmt = $conn->prepare($program_query);
    $program_stmt->bindParam(':program_id', $curriculum_details['program_id']);
    $program_stmt->execute();
    $program_row = $program_stmt->fetch(PDO::FETCH_ASSOC);
    $program_name = $program_row ? $program_row['name'] : null;

    $academic_year_query = "SELECT academic_year_name FROM academic_years WHERE academic_year_id = :academic_year_id";
    $academic_year_stmt = $conn->prepare($academic_year_query);
    $academic_year_stmt->bindParam(':academic_year_id', $curriculum_details['academic_year_id']);
    $academic_year_stmt->execute();
    $academic_year_row = $academic_year_stmt->fetch(PDO::FETCH_ASSOC);
    $academic_year = $academic_year_row ? $academic_year_row['academic_year_name'] : null;

    // --- 3. Fetch Year Levels ---
    $year_levels_query = "SELECT id, level AS name FROM year_levels ORDER BY id ASC";
    $year_levels_stmt = $conn->prepare($year_levels_query);
    $year_levels_stmt->execute();
    $year_levels = $year_levels_stmt->fetchAll(PDO::FETCH_ASSOC);

    // --- 4. Fetch Semesters ---
    $semesters_query = "SELECT semester_id as id, semester_name as name FROM semesters ORDER BY semester_id ASC";
    $semesters_stmt = $conn->prepare($semesters_query);
    $semesters_stmt->execute();
    $semesters = $semesters_stmt->fetchAll(PDO::FETCH_ASSOC);

    // 5. Query to fetch ALL courses for the curriculum and their grades IF available for the student
    $query = "SELECT
                c.id,
                c.course_code,
                c.course_title,
                c.year_level_id,
                c.semester_id,
                c.unit_lec,
                c.unit_lab,
                c.hour_lec,
                c.hour_lab,
                cg.transmutation,    -- Get transmutation from course_grades if available
                STRING_AGG(DISTINCT cp.prerequisite_course_id::text, ', ' ORDER BY cp.prerequisite_course_id::text ASC) AS prerequisite_ids -- Use DISTINCT for prerequisites
            FROM courses c
            LEFT JOIN course_grades cg ON c.id = cg.course_id AND cg.student_id = :student_id -- LEFT JOIN grades for THIS student
            LEFT JOIN course_prerequisites cp ON c.id = cp.course_id -- LEFT JOIN prerequisites
            WHERE c.curriculum_id = :curriculum_id -- Filter courses by the student's curriculum
            GROUP BY c.id, c.course_code, c.course_title, c.year_level_id, c.semester_id, c.unit_lec, c.unit_lab, c.hour_lec, c.hour_lab, cg.transmutation -- Group by course to aggregate prerequisites
            ORDER BY c.year_level_id ASC, c.semester_id ASC, c.id ASC"; // Order logically

    $stmt = $conn->prepare($query);
    $stmt->bindParam(':student_id', $student_id); // Still needed for the LEFT JOIN condition
    $stmt->bindParam(':curriculum_id', $curriculum_id);
    $stmt->execute();

    // --- Process results (This part remains largely the same) ---
    $curriculum_data = array(); // Initialize array to store course data

    // Check if any courses were found for the curriculum
    if ($stmt->rowCount() > 0) {
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            // Ensure prerequisite_ids is an array, even if null or empty string
            $prereq_ids = [];
            if (!empty($row['prerequisite_ids'])) {
                $prereq_ids = explode(',', $row['prerequisite_ids']);
            }

            $course = array(
                "id" => $row['id'],
                "course_code" => $row['course_code'],
                "course_title" => $row['course_title'],
                "year_level_id" => $row['year_level_id'],
                "semester_id" => $row['semester_id'],
                "unit_lec" => $row['unit_lec'],
                "unit_lab" => $row['unit_lab'],
                "hour_lec" => $row['hour_lec'],
                "hour_lab" => $row['hour_lab'],
                 // Use transmutation if not null, otherwise null. Format if not null.
                "grade" => $row['transmutation'] !== null ? $row['transmutation']: null,
                "prerequisite_ids" => $prereq_ids // Assign the processed array
            );
            array_push($curriculum_data, $course);
        }
    }
    // --- End of processing results ---


    // --- Structure the JSON response (This part remains the same) ---
    http_response_code(200);
    echo json_encode(array(
        'curriculumName' => array(
            'name' => $curriculum_details['name'],
            'program' => $program_name,
            'academicYear' => $academic_year,
            'studentName' => $student_name // Add student's name to the response
        ),
        'yearLevels' => $year_levels,
        'semesters' => $semesters,
        'courses' => $curriculum_data // Send the potentially larger list of courses
    ));
    // --- End of JSON response ---

} catch (PDOException $e) {
    // Use 503 like in get_courses.php for database errors
    http_response_code(503);
    error_log("Database error in get_student_curriculum.php: " . $e->getMessage()); // Log error
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
} catch (Exception $e) {
    http_response_code(500); // Internal Server Error for other exceptions
    error_log("Error in get_student_curriculum.php: " . $e->getMessage()); // Log error
    echo json_encode(array("message" => "An unexpected error occurred: " . $e->getMessage()));
}
?>