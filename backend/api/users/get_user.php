<?php
header("Content-Type: application/json");

// Require your database connection file
require_once "../../config/database.php";

// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Get query parameters
$role = $_GET['role'] ?? '';
$search = $_GET['search'] ?? '';
$page = (int)($_GET['page'] ?? 1);
$pageSize = (int)($_GET['pageSize'] ?? 5);
$offset = ($page - 1) * $pageSize;

// Map frontend roles to database roles
$roleMap = [
    "system_admin" => "admin",
    "dean" => "dean",
    "program_chair" => "programchair",
    "faculty" => "faculty",
    "student" => "student"
];
$dbRole = $roleMap[$role] ?? null;

$params = [];
$searchClause = '';
$likeQuery = "%" . strtolower($search) . "%";

$baseQuery = "";
$countQuery = "";

if ($dbRole === "admin") {
    $baseQuery = "
        SELECT u.id, e.employee_id, u.email, u.role, e.name
        FROM users u
        JOIN employees e ON u.id = e.employee_id
        WHERE u.role = ?";
    $countQuery = "
        SELECT COUNT(*) as count
        FROM users u
        JOIN employees e ON u.id = e.employee_id
        WHERE u.role = ?";
    $params[] = $dbRole;
} elseif ($dbRole === "dean") {
    $baseQuery = "
        SELECT u.id, e.employee_id, u.email, u.role, e.name, dept.name AS department
        FROM users u
        JOIN employees e ON u.id = e.employee_id
        JOIN deans d ON e.employee_id = d.employee_id
        JOIN departments dept ON d.department = dept.id
        WHERE u.role = ?";
    $countQuery = "
        SELECT COUNT(*) as count
        FROM users u
        JOIN employees e ON u.id = e.employee_id
        JOIN deans d ON e.employee_id = d.employee_id
        JOIN departments dept ON d.department = dept.id
        WHERE u.role = ?";
    $params[] = $dbRole;
} elseif ($dbRole === "programchair") {
    $baseQuery = "
        SELECT u.id, e.employee_id, u.email, u.role, e.name, d.name AS department, prog.name AS program
        FROM users u
        JOIN employees e ON u.id = e.employee_id
        JOIN program_chairs p ON e.employee_id = p.employee_id
        JOIN departments d ON p.department = d.id
        JOIN programs prog ON p.program = prog.id  -- Join with programs to get the name
        WHERE u.role = ?";
    
    $countQuery = "
        SELECT COUNT(*) as count
        FROM users u
        JOIN employees e ON u.id = e.employee_id
        JOIN program_chairs p ON e.employee_id = p.employee_id
        JOIN departments d ON p.department = d.id
        JOIN programs prog ON p.program = prog.id  -- Join with programs to get the name
        WHERE u.role = ?";
    
    $params[] = $dbRole;
} elseif ($dbRole === "faculty") {
    $baseQuery = "
        SELECT u.id, e.employee_id, u.email, u.role, e.name, f.specialization, d.name AS department
        FROM users u
        JOIN employees e ON u.id = e.employee_id
        JOIN faculty f ON e.employee_id = f.employee_id
        JOIN departments d ON f.department = d.id
        WHERE u.role = ?";
    $countQuery = "
        SELECT COUNT(*) as count
        FROM users u
        JOIN employees e ON u.id = e.employee_id
        JOIN faculty f ON e.employee_id = f.employee_id
        JOIN departments d ON f.department = d.id
        WHERE u.role = ?";
    $params[] = $dbRole;
} elseif ($dbRole === "student") {
    $baseQuery = "
    SELECT u.id AS user_id, s.student_id, u.email, u.role, s.name, 
           p.name AS program, 
           d.name AS department, 
           sec.name AS section, 
           e.name AS advisor
    FROM users u
    JOIN students s ON u.id = s.student_id
    JOIN programs p ON s.program_id = p.id
    JOIN departments d ON s.department_id = d.id
    JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN faculty f ON sec.advisor_id = f.employee_id  -- Fetch advisor from section
    LEFT JOIN employees e ON f.employee_id = e.employee_id  -- Get advisor's name
    WHERE u.role = ?";

$countQuery = "
    SELECT COUNT(*) as count
    FROM users u
    JOIN students s ON u.id = s.student_id
    JOIN programs p ON s.program_id = p.id
    JOIN departments d ON s.department_id = d.id
    JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN faculty f ON sec.advisor_id = f.employee_id  -- Fetch advisor from section
    LEFT JOIN employees e ON f.employee_id = e.employee_id
    WHERE u.role = ?";


    $params[] = $dbRole;

} else {
   
    $baseQuery = "
        SELECT u.id, COALESCE(e.employee_id, s.student_id) AS employee_id, u.email, u.role, 
               COALESCE(e.name, s.name) AS name
        FROM users u
        LEFT JOIN employees e ON u.id = e.employee_id
        LEFT JOIN students s ON u.id = s.student_id";
    
    $countQuery = "SELECT COUNT(*) as count FROM users u";
}


if (!empty($search)) {
    $searchClause = " AND (LOWER(u.email) LIKE ? OR LOWER(e.name) LIKE ? OR LOWER(CAST(e.employee_id AS CHAR)) LIKE ?)";
    $baseQuery .= $searchClause;
    $countQuery .= $searchClause;
    array_push($params, $likeQuery, $likeQuery, $likeQuery);
}


$baseQuery .= " LIMIT $pageSize OFFSET $offset";

try {
   
    $stmt = $conn->prepare($baseQuery);
    $stmt->execute($params);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

  
    $stmtCount = $conn->prepare($countQuery);
    $stmtCount->execute($params);
    $countResult = $stmtCount->fetch(PDO::FETCH_ASSOC);
    $totalCount = $countResult['count'] ?? 0;
    $totalPages = max(ceil($totalCount / $pageSize), 1);

   
    echo json_encode([
        "users" => $users,
        "totalPages" => $totalPages,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "error" => "Query failed: " . $e->getMessage()
    ]);
}
?>
