<?php
header("Content-Type: application/json");

// Require your database connection file
require_once "../../config/database.php";
include_once '../../config/cors.php';
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Get query parameters
$search = $_GET['search'] ?? '';
$page = (int)($_GET['page'] ?? 1);
$pageSize = (int)($_GET['pageSize'] ?? 5);
$offset = ($page - 1) * $pageSize;
$status = $_GET['status']; // Added status parameter

// Initialize params array after removing role-specific logic
$params = [];
$searchClause = '';
$likeQuery = "%" . strtolower($search) . "%";

$baseQuery = "
    SELECT
        u.id,
        COALESCE(e.employee_id, s.student_id) AS KLD_ID,
        u.email,
        u.status,
        GROUP_CONCAT(r.role_name ORDER BY r.role_name ASC) AS roles, /* ADDED: Get all roles as comma-separated string */
        COALESCE(e.name, s.name) AS name,
        d.name AS department,
        prog.name AS program,
        yl.level AS year_level,
        f.specialization,
        sec.name AS section,
        d.id AS department_id,
        prog.id AS program_id,
        yl.id AS year_level_id,
        sec.id AS section_id,
        adv_f.employee_id AS advisor_id,
        adv_e.name AS advisor
    FROM users u
    LEFT JOIN employees e ON u.id = e.employee_id
    LEFT JOIN students s ON u.id = s.student_id
    LEFT JOIN user_roles ur ON u.id = ur.user_id /* ADDED JOIN */
    LEFT JOIN roles r ON ur.role_id = r.id      /* ADDED JOIN */
    LEFT JOIN deans dn ON e.employee_id = dn.employee_id
    LEFT JOIN program_chairs pc ON e.employee_id = pc.employee_id
    LEFT JOIN faculty f ON e.employee_id = f.employee_id
    LEFT JOIN departments d ON COALESCE(dn.department, pc.department, f.department, s.department_id) = d.id
    LEFT JOIN programs prog ON COALESCE(pc.program, s.program_id) = prog.id
    LEFT JOIN year_levels yl ON s.year_level_id = yl.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN section_advisors sa ON sec.id = sa.section_id
    LEFT JOIN faculty adv_f ON sa.advisor_id = adv_f.employee_id
    LEFT JOIN employees adv_e ON adv_f.employee_id = adv_e.employee_id
    WHERE u.status = ?
";

$countQuery = "
    SELECT COUNT(DISTINCT u.id) as count
    FROM users u
    LEFT JOIN employees e ON u.id = e.employee_id
    LEFT JOIN students s ON u.id = s.student_id
    LEFT JOIN user_roles ur ON u.id = ur.user_id /* ADDED JOIN */
    LEFT JOIN roles r ON ur.role_id = r.id      /* ADDED JOIN */
    LEFT JOIN deans dn ON e.employee_id = dn.employee_id
    LEFT JOIN program_chairs pc ON e.employee_id = pc.employee_id
    LEFT JOIN faculty f ON e.employee_id = f.employee_id
    LEFT JOIN departments d ON COALESCE(dn.department, pc.department, f.department, s.department_id) = d.id
    LEFT JOIN programs prog ON COALESCE(pc.program, s.program_id) = prog.id
    LEFT JOIN year_levels yl ON s.year_level_id = yl.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN section_advisors sa ON sec.id = sa.section_id
    LEFT JOIN faculty adv_f ON sa.advisor_id = adv_f.employee_id
    LEFT JOIN employees adv_e ON adv_f.employee_id = adv_e.employee_id
    WHERE u.status = ?
";

if (!empty($search)) {
    $searchClause = " AND (LOWER(u.email) LIKE ? OR LOWER(COALESCE(e.name, s.name)) LIKE ? OR LOWER(COALESCE(CAST(e.employee_id AS CHAR), CAST(s.student_id AS CHAR))) LIKE ?";
    // Add search conditions for other relevant columns
    $searchClause .= " OR LOWER(r.role_name) LIKE ?"; /* MODIFIED: Search by role_name from roles table */
    $searchClause .= " OR LOWER(d.name) LIKE ?"; // Department name
    $searchClause .= " OR LOWER(prog.name) LIKE ?"; // Program name
    $searchClause .= " OR LOWER(yl.level) LIKE ?"; // Year Level
    $searchClause .= " OR LOWER(f.specialization) LIKE ?"; // Specialization
    $searchClause .= " OR LOWER(sec.name) LIKE ?"; // Section name
    $searchClause .= " OR LOWER(adv_e.name) LIKE ?"; // Advisor name
    $searchClause .= ")"; // Close the parenthesis
    $baseQuery .= $searchClause;
    $countQuery .= $searchClause;
    array_push($params, $likeQuery, $likeQuery, $likeQuery, $likeQuery, $likeQuery, $likeQuery, $likeQuery, $likeQuery, $likeQuery, $likeQuery);
}

array_unshift($params, $status); // Add status as the first parameter for both queries

$baseQuery .= "
    GROUP BY u.id, KLD_ID, u.email, u.status, name, department, program, year_level, specialization, section, department_id, program_id, year_level_id, section_id, advisor_id, advisor /* ADDED GROUP BY */
    ORDER BY u.id
    LIMIT $pageSize OFFSET $offset
";

try {
    $stmt = $conn->prepare($baseQuery);
    $stmt->execute($params);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmtCount = $conn->prepare($countQuery);
    // Remove pageSize and offset from count query parameters
    $countParams = $params; // $params now includes $status, which is correct for count query
    $stmtCount->execute($countParams);
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
