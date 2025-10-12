<?php
// Include CORS headers (like in read.php)
include_once '../../config/cors.php';

// Set headers for content type (keep this)
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS request (preflight - keep this)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    // Set headers for CORS preflight
    header("Access-Control-Allow-Methods: GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization"); // Adjust headers if needed
    exit(0);
}

// Include database configuration (this should provide the $conn variable)
include_once '../../config/database.php';

// Check if the connection variable exists and is valid (assuming it's named $conn)
if (!isset($conn) || $conn === null) {
    http_response_code(500);
    // Log the error in a real application
    error_log("Database connection failed in read_assignment.php. Check config/database.php and ensure \$conn is set.");
    echo json_encode(array("message" => "Database connection failed."));
    exit();
}

try {
    // --- CORRECTED Main Faculty Query ---
    // Select from employees first, then join users and departments
    $query = "SELECT
                e.employee_id as faculty_id,
                u.email,
                GROUP_CONCAT(r.role_name ORDER BY r.role_name ASC) AS roles,
                e.name as faculty_name,
                d.name as department_name,
                f.advisor_status
              FROM employees e
              JOIN users u ON e.employee_id = u.id
              LEFT JOIN user_roles ur ON u.id = ur.user_id
              LEFT JOIN roles r ON ur.role_id = r.id
              JOIN departments d ON e.department_id = d.id
              LEFT JOIN faculty f ON e.employee_id = f.employee_id
              WHERE r.role_name = 'faculty'
              GROUP BY e.employee_id, u.email, e.name, d.name, f.advisor_status
              ORDER BY e.name";

    // Use $conn
    $stmt = $conn->prepare($query);

    // Check if prepare() failed (e.g., due to SQL syntax error)
    if ($stmt === false) {
        throw new PDOException("Failed to prepare the main faculty query. Error: " . implode(" - ", $conn->errorInfo()));
    }

    $stmt->execute();

    $faculty_list = array();

    // Check if any faculty found before proceeding
    if ($stmt->rowCount() > 0) {
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            // $faculty_id now correctly refers to the value from employees.employee_id (which matches users.id)
            $faculty_id = $row['faculty_id'];

            // --- Calculate Sections Assigned (section_faculty uses faculty_id) --- This query is OK
            $sections_assigned_query = "SELECT COUNT(sf.section_id) as count
                                        FROM section_faculty sf
                                        WHERE sf.faculty_id = :faculty_id AND sf.status = 'active'"; // Added status filter
            $sections_assigned_stmt = $conn->prepare($sections_assigned_query);
            if ($sections_assigned_stmt === false) throw new PDOException("Failed to prepare sections_assigned query: " . implode(" - ", $conn->errorInfo()));
            $sections_assigned_stmt->bindParam(':faculty_id', $faculty_id);
            $sections_assigned_stmt->execute();
            $sections_assigned_count = $sections_assigned_stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0;

            // --- CORRECTED Calculate Advised Sections Count (section_advisors uses advisor_id) ---
            $advised_sections_query = "SELECT COUNT(sa.section_id) as count
                                       FROM section_advisors sa
                                       WHERE sa.advisor_id = :faculty_id"; // Use advisor_id column
            $advised_sections_stmt = $conn->prepare($advised_sections_query);
            if ($advised_sections_stmt === false) throw new PDOException("Failed to prepare advised_sections query: " . implode(" - ", $conn->errorInfo()));
            $advised_sections_stmt->bindParam(':faculty_id', $faculty_id); // Bind the user's ID
            $advised_sections_stmt->execute();
            $advised_sections_count = $advised_sections_stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0;

            // --- CORRECTED Calculate Advisees Count (section_advisors uses advisor_id) ---
            $advisees_query = "SELECT COUNT(s.id) as count
                               FROM students s
                               JOIN section_advisors sa ON s.section_id = sa.section_id
                               WHERE sa.advisor_id = :faculty_id AND s.section_id IS NOT NULL"; // Use advisor_id column
            $advisees_stmt = $conn->prepare($advisees_query);
            if ($advisees_stmt === false) throw new PDOException("Failed to prepare advisees query: " . implode(" - ", $conn->errorInfo()));
            $advisees_stmt->bindParam(':faculty_id', $faculty_id); // Bind the user's ID
            $advisees_stmt->execute();
            $advisees_count = $advisees_stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0;

            // Add counts to the faculty member's data
            $row['sectionsAssigned'] = (int)$sections_assigned_count;
            $row['advisedSectionsCount'] = (int)$advised_sections_count;
            $row['adviseesAssigned'] = (int)$advisees_count;

            // Add the faculty member to the list
            $faculty_list[] = $row;
        }
    } // else: $faculty_list remains empty, which is fine

    // Return the faculty list as JSON (even if empty)
    http_response_code(200);
    echo json_encode($faculty_list);

} catch (PDOException $exception) {
    http_response_code(500);
    // Log the detailed error
    error_log("Database error in read_assignment.php: " . $exception->getMessage());
    // Send a generic message to the frontend, but include the detailed error for easier debugging (remove detailed error in production)
    echo json_encode(array(
        "message" => "Unable to fetch faculty data due to a database error.",
        "error_details_debug" => $exception->getMessage() // For debugging - remove in production
    ));
} catch (Exception $exception) {
    http_response_code(500);
    error_log("General error in read_assignment.php: " . $exception->getMessage());
    echo json_encode(array(
        "message" => "An unexpected error occurred.",
        "error_details_debug" => $exception->getMessage() // For debugging - remove in production
    ));
}

?>
