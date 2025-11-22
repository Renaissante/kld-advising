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
$active_academic_year_id = isset($_GET['active_academic_year_id']) ? intval($_GET['active_academic_year_id']) : null;
$active_semester_id = isset($_GET['active_semester_id']) ? intval($_GET['active_semester_id']) : null;

if (!$student_id) {
    http_response_code(400); // Bad Request
    echo json_encode(['message' => 'Student ID is required.']);
    exit;
}
if (!$active_academic_year_id || !$active_semester_id) {
    http_response_code(400); // Bad Request
    echo json_encode(['message' => 'Active academic year and semester IDs are required.']);
    exit;
}

try {
    // $conn variable is expected from database.php

    // 1. Get the student's curriculum_id and year_level_id
    $student_query = "SELECT curriculum_id, name, year_level_id FROM students WHERE student_id = :student_id";
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
    $student_year_level_id = $student_row['year_level_id']; // Fetch student's year_level_id

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

    // Calculate next academic period based on active academic year and semester
    $next_semester_id = ($active_semester_id == 1) ? 2 : 1;
    $next_academic_year_id = $active_academic_year_id; // Default to current academic year ID

    // If current semester is 2nd, then next is 1st semester of next academic year
    if ($active_semester_id == 2) {
        // Fetch the academic year name for the active academic year to calculate the next one
        $active_ay_name_query = "SELECT academic_year_name FROM academic_years WHERE academic_year_id = :active_academic_year_id";
        $active_ay_name_stmt = $conn->prepare($active_ay_name_query);
        $active_ay_name_stmt->bindParam(':active_academic_year_id', $active_academic_year_id);
        $active_ay_name_stmt->execute();
        $active_ay_name_row = $active_ay_name_stmt->fetch(PDO::FETCH_ASSOC);
        $active_ay_name = $active_ay_name_row ? $active_ay_name_row['academic_year_name'] : null;

        if ($active_ay_name) {
            list($start_year, $end_year) = explode('-', $active_ay_name);
            $next_start_year = intval($start_year) + 1;
            $next_end_year = intval($end_year) + 1;
            $next_ay_name = "{$next_start_year}-{$next_end_year}";

            // Find the ID of the next academic year
            $next_ay_id_query = "SELECT academic_year_id FROM academic_years WHERE academic_year_name = :next_ay_name";
            $next_ay_id_stmt = $conn->prepare($next_ay_id_query);
            $next_ay_id_stmt->bindParam(':next_ay_name', $next_ay_name);
            $next_ay_id_stmt->execute();
            $next_ay_id_row = $next_ay_id_stmt->fetch(PDO::FETCH_ASSOC);
            $next_academic_year_id = $next_ay_id_row ? $next_ay_id_row['academic_year_id'] : null;
        }
    }

    // 5. Check for existing pending advising requests for the next academic period
    $has_pending_advising_request = false;
    $has_approved_advising_request = false; // New variable
    $requested_courses = [];

    if ($next_academic_year_id && $next_semester_id) {
        // Check for pending requests and populate requested_courses
        $pending_request_query = "SELECT ac.course_id, c.course_code, c.course_title, c.unit_lec, c.unit_lab
                                   FROM kld_advising.advised_courses ac
                                   JOIN kld_advising.courses c ON ac.course_id = c.id
                                   WHERE ac.student_id = :student_id
                                     AND ac.academic_year_id = :next_academic_year_id
                                     AND ac.semester_id = :next_semester_id
                                     AND ac.status = 'pending'";
        $pending_request_stmt = $conn->prepare($pending_request_query);
        $pending_request_stmt->bindParam(':student_id', $student_id);
        $pending_request_stmt->bindParam(':next_academic_year_id', $next_academic_year_id);
        $pending_request_stmt->bindParam(':next_semester_id', $next_semester_id);
        $pending_request_stmt->execute();

        if ($pending_request_stmt->rowCount() > 0) {
            $has_pending_advising_request = true;
            while ($row = $pending_request_stmt->fetch(PDO::FETCH_ASSOC)) {
                $requested_courses[] = [
                    'id' => $row['course_id'],
                    'course_code' => $row['course_code'],
                    'course_title' => $row['course_title'],
                    'units' => (float)$row['unit_lec'] + (float)$row['unit_lab'],
                ];
            }
        }

        // Check for approved requests and populate requested_courses if not already populated by pending
        // If there's an approved request, it takes precedence and overrides pending requested_courses if any
        $approved_request_query = "SELECT ac.course_id, c.course_code, c.course_title, c.unit_lec, c.unit_lab
                                   FROM kld_advising.advised_courses ac
                                   JOIN kld_advising.courses c ON ac.course_id = c.id
                                   WHERE ac.student_id = :student_id
                                     AND ac.academic_year_id = :next_academic_year_id
                                     AND ac.semester_id = :next_semester_id
                                     AND ac.status = 'approved'";
        $approved_request_stmt = $conn->prepare($approved_request_query);
        $approved_request_stmt->bindParam(':student_id', $student_id);
        $approved_request_stmt->bindParam(':next_academic_year_id', $next_academic_year_id);
        $approved_request_stmt->bindParam(':next_semester_id', $next_semester_id);
        $approved_request_stmt->execute();

        if ($approved_request_stmt->rowCount() > 0) {
            $has_approved_advising_request = true;
            // Clear requested_courses from pending if approved request exists and populate with approved courses
            $requested_courses = []; 
            while ($row = $approved_request_stmt->fetch(PDO::FETCH_ASSOC)) {
                $requested_courses[] = [
                    'id' => $row['course_id'],
                    'course_code' => $row['course_code'],
                    'course_title' => $row['course_title'],
                    'units' => (float)$row['unit_lec'] + (float)$row['unit_lab'],
                ];
            }
        }
    }

    // 6. Query to fetch ALL courses for the curriculum and their grades IF available for the student
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
                c.curriculum_id, -- Add curriculum_id to the select statement
                cg.transmutation,    -- Get transmutation from course_grades if available
                cg.is_credited,      -- Get is_credited from course_grades if available
                cg.is_verified,      -- Get is_verified from course_grades if available
                cg.is_submitted,     -- Get is_submitted from course_grades if available
                STRING_AGG(DISTINCT cp.prerequisite_course_id::text, ', ' ORDER BY cp.prerequisite_course_id::text ASC) AS prerequisite_ids -- Use DISTINCT for prerequisites
            FROM courses c
            LEFT JOIN course_grades cg ON c.id = cg.course_id AND cg.student_id = :student_id -- LEFT JOIN grades for THIS student
            LEFT JOIN course_prerequisites cp ON c.id = cp.course_id -- LEFT JOIN prerequisites
            WHERE c.curriculum_id = :curriculum_id -- Filter courses by the student's curriculum
            GROUP BY c.id, c.course_code, c.course_title, c.year_level_id, c.semester_id, c.unit_lec, c.unit_lab, c.hour_lec, c.hour_lab, c.curriculum_id, cg.transmutation, cg.is_credited, cg.is_verified, cg.is_submitted -- Add is_submitted to GROUP BY
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
                "curriculum_id" => $row['curriculum_id'], // Include curriculum_id in course object
                 // Use transmutation if not null, otherwise null. Format if not null.
                "grade" => $row['transmutation'] !== null ? $row['transmutation']: null,
                "is_credited" => (bool)$row['is_credited'], // Cast to boolean
                "is_verified" => (bool)$row['is_verified'], // Cast to boolean
                "is_submitted" => (bool)$row['is_submitted'], // Cast to boolean
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
            'studentName' => $student_name, // Add student's name to the response
            'studentYearLevelId' => $student_year_level_id, // Add student's year level ID to the response
            'curriculum_id' => $curriculum_id, // Explicitly add curriculum_id to curriculumName
            'student_number' => $student_id // Add student_id as student_number
        ),
        'yearLevels' => $year_levels,
        'semesters' => $semesters,
        'courses' => $curriculum_data, // Send the potentially larger list of courses
        'has_pending_advising_request' => $has_pending_advising_request,
        'has_approved_advising_request' => $has_approved_advising_request, // Add this new field
        'requested_courses' => $requested_courses,
        'next_academic_year_id' => $next_academic_year_id, // Add next academic year ID
        'next_semester_id' => $next_semester_id // Add next semester ID
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