<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

// Check if section_id is provided
if (!isset($_GET['section_id']) || empty($_GET['section_id'])) {
    http_response_code(400);
    echo json_encode(array("message" => "Section ID is required."));
    exit();
}

// Get parameters
$section_id = $_GET['section_id'];
$academic_year_id = isset($_GET['academic_year_id']) ? $_GET['academic_year_id'] : null;
$semester_id = isset($_GET['semester_id']) ? $_GET['semester_id'] : null;

try {
    // First, get the section details to find program_id and year_level_id
    $section_query = "SELECT s.*, p.id as program_id, p.name as program_name, yl.id as year_level_id, yl.level as year_level_name 
                FROM sections s
                LEFT JOIN programs p ON s.program_id = p.id
                LEFT JOIN year_levels yl ON s.year_level_id = yl.id
                WHERE s.id = :section_id";
    
    $section_stmt = $conn->prepare($section_query);
    $section_stmt->bindParam(':section_id', $section_id);
    $section_stmt->execute();
    
    // Check if section exists
    if ($section_stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("message" => "Section not found."));
        exit();
    }
    
    $section = $section_stmt->fetch(PDO::FETCH_ASSOC);
    
    // Get program_id and year_level_id from section
    $program_id = $section['program_id'];
    $year_level_id = $section['year_level_id'];
    
    // If section doesn't have program_id or year_level_id, try to extract from section name
    if (!$program_id || !$year_level_id) {
        // Log for debugging
        error_log("Section missing program_id or year_level_id. Attempting to extract from name: " . $section['name']);
        
        // Extract year level from section name (e.g., "BSIS 101" -> 1st year)
        if (!$year_level_id && preg_match('/\d+/', $section['name'], $matches)) {
            $year_indicator = substr($matches[0], 0, 1);
            
            // Query to find year level by number
            $year_query = "SELECT id FROM year_levels WHERE name LIKE :year_pattern LIMIT 1";
            $year_stmt = $conn->prepare($year_query);
            $year_pattern = $year_indicator . "%";
            $year_stmt->bindParam(':year_pattern', $year_pattern);
            $year_stmt->execute();
            
            if ($year_stmt->rowCount() > 0) {
                $year_level = $year_stmt->fetch(PDO::FETCH_ASSOC);
                $year_level_id = $year_level['id'];
            }
        }
        
        // Extract program from section name (e.g., "BSIS 101" -> "BSIS")
        if (!$program_id && preg_match('/^([A-Za-z]+)/', $section['name'], $matches)) {
            $program_code = $matches[1];
            
            // Query to find program by code
            $program_query = "SELECT id FROM programs WHERE name LIKE :program_pattern LIMIT 1";
            $program_stmt = $conn->prepare($program_query);
            $program_pattern = "%$program_code%";
            $program_stmt->bindParam(':program_pattern', $program_pattern);
            $program_stmt->execute();
            
            if ($program_stmt->rowCount() > 0) {
                $program = $program_stmt->fetch(PDO::FETCH_ASSOC);
                $program_id = $program['id'];
            }
        }
    }
    
    // Log extracted values
    error_log("Extracted program_id: $program_id, year_level_id: $year_level_id");
    
    // Get the curricula used by students in this section
    $curricula_query = "SELECT DISTINCT s.curriculum_id 
                       FROM students s 
                       WHERE s.section_id = :section_id AND s.curriculum_id IS NOT NULL";
    
    $curricula_stmt = $conn->prepare($curricula_query);
    $curricula_stmt->bindParam(':section_id', $section_id);
    $curricula_stmt->execute();
    
    $curriculum_ids = array();
    while ($row = $curricula_stmt->fetch(PDO::FETCH_ASSOC)) {
        $curriculum_ids[] = $row['curriculum_id'];
    }
    
    // If no curricula found from students, return error message
    if (empty($curriculum_ids)) {
        http_response_code(404);
        echo json_encode(array("message" => "No curriculum assigned for the students of this section"));
        exit();
    }
    
    // Log found curricula
    error_log("Found curriculum_ids for section: " . implode(", ", $curriculum_ids));
    
    // Build the main query to get courses
    $params = array();
    $conditions = array();
    
    // Base query
    $query = "SELECT c.* FROM courses c WHERE 1=1";
    
    // Add curriculum constraint if found
    if (!empty($curriculum_ids)) {
        $placeholders = array();
        for ($i = 0; $i < count($curriculum_ids); $i++) {
            $param_name = ":curriculum_id_$i";
            $placeholders[] = $param_name;
            $params[$param_name] = $curriculum_ids[$i];
        }
        $conditions[] = "c.curriculum_id IN (" . implode(", ", $placeholders) . ")";
    }
    
    // Add year level constraint if available
    if ($year_level_id) {
        $conditions[] = "c.year_level_id = :year_level_id";
        $params[':year_level_id'] = $year_level_id;
    }
    
    // Add semester constraint if provided
    if ($semester_id) {
        $conditions[] = "c.semester_id = :semester_id";
        $params[':semester_id'] = $semester_id;
    }
    
    // Exclude courses that are already assigned to faculty for this section
    $assigned_courses_query = "SELECT sf.course_id, c.course_code 
                              FROM section_faculty sf
                              JOIN courses c ON sf.course_id = c.id
                              WHERE sf.section_id = :section_id";
    $assigned_courses_stmt = $conn->prepare($assigned_courses_query);
    $assigned_courses_stmt->bindParam(':section_id', $section_id);
    $assigned_courses_stmt->execute();
    
    // Log assigned courses for debugging
    $assigned_courses = [];
    while ($row = $assigned_courses_stmt->fetch(PDO::FETCH_ASSOC)) {
        $assigned_courses[] = $row['course_id'] . ' (' . $row['course_code'] . ')';
    }
    error_log("Already assigned courses for section $section_id: " . implode(", ", $assigned_courses));
    
    $conditions[] = "NOT EXISTS (
        SELECT 1 FROM section_faculty sf 
        WHERE sf.course_id = c.id 
        AND sf.section_id = :section_id
    )";
    $params[':section_id'] = $section_id;
    
    // Add conditions to query
    if (!empty($conditions)) {
        $query .= " AND " . implode(" AND ", $conditions);
    }
    
    // Order by course code
    $query .= " ORDER BY c.course_code ASC";
    
    // Log the full query for debugging
    error_log("Course filtering SQL query: " . $query);
    error_log("Section ID param: " . $section_id);
    
    // Prepare and execute the query
    $stmt = $conn->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
        error_log("Parameter $key: $value");
    }
    $stmt->execute();
    
    // Get results
    $courses = array();
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $course = array(
            "id" => $row['id'],
            "curriculum_id" => $row['curriculum_id'],
            "course_code" => $row['course_code'],
            "course_title" => $row['course_title'],
            "year_level_id" => $row['year_level_id'],
            "semester_id" => $row['semester_id'],
            "unit_lec" => $row['unit_lec'],
            "unit_lab" => $row['unit_lab'],
            "hour_lec" => $row['hour_lec'],
            "hour_lab" => $row['hour_lab']
        );
        array_push($courses, $course);
    }
    
    // Return results
    http_response_code(200);
    echo json_encode($courses);
    
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?> 