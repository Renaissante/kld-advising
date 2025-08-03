<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");
// header("Access-Control-Allow-Methods: GET");
// header("Access-Control-Max-Age: 3600");
// header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';

// Get academic_year_id and semester_id from request
$academic_year_id = isset($_GET['academic_year_id']) ? $_GET['academic_year_id'] : die(json_encode(array("message" => "Missing academic_year_id parameter")));
$semester_id = isset($_GET['semester_id']) ? $_GET['semester_id'] : die(json_encode(array("message" => "Missing semester_id parameter")));

// Check if we want sections with advisors or without advisors
$filter_type = isset($_GET['filter_type']) ? $_GET['filter_type'] : 'all';

try {
    // Base query to get sections filtered by academic year and semester
    $query = "SELECT 
                s.id, 
                s.name,
                s.program_id,
                s.year_level_id, 
                p.name as program_name,
                yl.level as year_level,
                ay.academic_year_name as academic_year,
                sem.semester_name as semester,
                (SELECT COUNT(*) FROM section_advisors sa WHERE sa.section_id = s.id) as has_advisor
            FROM 
                sections s
            LEFT JOIN 
                programs p ON s.program_id = p.id
            LEFT JOIN 
                year_levels yl ON s.year_level_id = yl.id
            JOIN 
                academic_years ay ON s.academic_year_id = ay.academic_year_id
            JOIN 
                semesters sem ON s.semester_id = sem.semester_id
            WHERE 
                s.academic_year_id = :academic_year_id 
            AND 
                s.semester_id = :semester_id";
    
    // Filter sections based on whether they have advisors or not
    if ($filter_type === 'no_advisor') {
        $query .= " AND NOT EXISTS (SELECT 1 FROM section_advisors sa WHERE sa.section_id = s.id)";
    } else if ($filter_type === 'has_advisor') {
        $query .= " AND EXISTS (SELECT 1 FROM section_advisors sa WHERE sa.section_id = s.id)";
    }
    
    $query .= " ORDER BY s.name ASC";

    // Prepare statement
    $stmt = $conn->prepare($query);

    // Bind parameters
    $stmt->bindParam(':academic_year_id', $academic_year_id);
    $stmt->bindParam(':semester_id', $semester_id);

    // Execute query
    $stmt->execute();
    $num = $stmt->rowCount();

    // Check if sections were found
    if ($num > 0) {
        // Sections array
        $sections_arr = array();

        // Fetch sections into associative array
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $section_item = array(
                "id" => $row['id'],
                "name" => $row['name'],
                "program_id" => $row['program_id'],
                "year_level_id" => $row['year_level_id'],
                "program_name" => $row['program_name'],
                "year_level" => $row['year_level'],
                "academic_year" => $row['academic_year'],
                "semester" => $row['semester'],
                "has_advisor" => $row['has_advisor'] > 0
            );

            array_push($sections_arr, $section_item);
        }

        // Set response code - 200 OK
        http_response_code(200);

        // Send response
        echo json_encode($sections_arr);
    } else {
        // Set response code - 200 OK (not 404) with empty array
        http_response_code(200);

        // Tell the user no sections found
        echo json_encode(array());
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
} 