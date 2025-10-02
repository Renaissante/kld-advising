<?php

header("Content-Type: application/json");
include_once '../../config/cors.php';
require_once "../../config/database.php";

error_reporting(E_ALL);
ini_set('display_errors', 1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method Not Allowed"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

// KLD_ID is effectively the user ID, name and role are also required for conditional updates
if (empty($data->id) || empty($data->email) || empty($data->name) || !isset($data->roles) || !is_array($data->roles)) {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to update user. Data is incomplete. Missing required fields (id, email, name, and roles array)."));
    exit();
}

error_log("update_user.php received data: " . json_encode($data));

try {
    $conn->beginTransaction();

    $changesMade = false;

    // 1. Update users table
    $query = "UPDATE users SET id = :new_id, email = :email WHERE id = :old_id";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':new_id', $data->KLD_ID); // New KLD_ID as the new ID
    $stmt->bindParam(':email', $data->email);
    $stmt->bindParam(':old_id', $data->id); // Original ID for WHERE clause
    $stmt->execute();
    if ($stmt->rowCount() > 0) {
        $changesMade = true;
        error_log("Users table updated for ID: " . $data->KLD_ID);
    }

    // --- Handle User Roles --- START
    $current_roles_query = "SELECT r.role_name, r.id FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = :user_id";
    $current_roles_stmt = $conn->prepare($current_roles_query);
    $current_roles_stmt->bindParam(':user_id', $data->KLD_ID); // Use new KLD_ID
    $current_roles_stmt->execute();
    $existing_roles_data = $current_roles_stmt->fetchAll(PDO::FETCH_ASSOC);

    $existing_role_names = array_column($existing_roles_data, 'role_name');
    $existing_role_ids_map = array_column($existing_roles_data, 'id', 'role_name'); // Map role_name to role_id

    $new_roles_from_frontend = $data->roles; // Array of role names from frontend

    // Get all role_ids from the roles table
    $all_roles_query = "SELECT id, role_name FROM roles";
    $all_roles_stmt = $conn->query($all_roles_query);
    $all_roles_map = []; // Map role_name to id
    while ($row = $all_roles_stmt->fetch(PDO::FETCH_ASSOC)) {
        $all_roles_map[$row['role_name']] = $row['id'];
    }

    // Roles to Add
    foreach ($new_roles_from_frontend as $new_role_name) {
        if (!in_array($new_role_name, $existing_role_names)) {
            if (isset($all_roles_map[$new_role_name])) {
                $role_id_to_add = $all_roles_map[$new_role_name];
                $insert_user_role_query = "INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)";
                $insert_user_role_stmt = $conn->prepare($insert_user_role_query);
                $insert_user_role_stmt->bindParam(':user_id', $data->KLD_ID);
                $insert_user_role_stmt->bindParam(':role_id', $role_id_to_add);
                $insert_user_role_stmt->execute();
                if ($insert_user_role_stmt->rowCount() > 0) {
                    $changesMade = true;
                    error_log("Added role {$new_role_name} to user {$data->KLD_ID}");
                }
            } else {
                error_log("Attempted to add non-existent role: {$new_role_name}");
            }
        }
    }

    // Roles to Remove
    foreach ($existing_role_names as $existing_role_name) {
        if (!in_array($existing_role_name, $new_roles_from_frontend)) {
            if (isset($existing_role_ids_map[$existing_role_name])) {
                $role_id_to_remove = $existing_role_ids_map[$existing_role_name];
                $delete_user_role_query = "DELETE FROM user_roles WHERE user_id = :user_id AND role_id = :role_id";
                $delete_user_role_stmt = $conn->prepare($delete_user_role_query);
                $delete_user_role_stmt->bindParam(':user_id', $data->KLD_ID);
                $delete_user_role_stmt->bindParam(':role_id', $role_id_to_remove);
                $delete_user_role_stmt->execute();
                if ($delete_user_role_stmt->rowCount() > 0) {
                    $changesMade = true;
                    error_log("Removed role {$existing_role_name} from user {$data->KLD_ID}");
                }
            }
        }
    }
    // --- Handle User Roles --- END

    // 2. Conditionally update other tables based on *current* roles after updates
    // Re-fetch current roles to ensure we're working with the latest set after role changes
    $current_roles_stmt = $conn->prepare($current_roles_query);
    $current_roles_stmt->bindParam(':user_id', $data->KLD_ID);
    $current_roles_stmt->execute();
    $current_user_roles_after_update = array_column($current_roles_stmt->fetchAll(PDO::FETCH_ASSOC), 'role_name');

    // Now use in_array() checks against $current_user_roles_after_update
    if (in_array("student", $current_user_roles_after_update)) {
        $student_query = "UPDATE students SET
                            name = :name,
                            department_id = :department_id,
                            program_id = :program_id,
                            year_level_id = :year_level_id,
                            section_id = :section_id
                          WHERE student_id = :student_id";
        $student_stmt = $conn->prepare($student_query);

        $student_stmt->bindParam(':student_id', $data->KLD_ID); // Use KLD_ID (new ID) for WHERE clause
        $student_stmt->bindParam(':name', $data->name);
        error_log("Student Name Update - Incoming name: " . $data->name . " for student ID: " . $data->KLD_ID);

        // Fetch current student data to compare for changes
        $current_student_data_query = "SELECT department_id, program_id, year_level_id, section_id FROM students WHERE student_id = :student_id";
        $current_student_data_stmt = $conn->prepare($current_student_data_query);
        $current_student_data_stmt->bindParam(':student_id', $data->KLD_ID); // Use KLD_ID (new ID) for fetching
        $current_student_data_stmt->execute();
        $current_student_data = $current_student_data_stmt->fetch(PDO::FETCH_ASSOC);

        $current_department_in_db = $current_student_data['department_id'] ?? null;
        $current_program_in_db = $current_student_data['program_id'] ?? null;
        $current_year_level_in_db = $current_student_data['year_level_id'] ?? null;
        $current_section_in_db = $current_student_data['section_id'] ?? null;

        // Determine new department_id
        $department_id = isset($data->department_id) && $data->department_id !== "" ? $data->department_id : $current_department_in_db;
        
        // Determine new program_id (set to null if department changed and program is empty)
        $new_program_id_from_frontend = isset($data->program_id) && $data->program_id !== "" ? $data->program_id : null;
        $department_changed_for_student = (isset($data->department_id) && $data->department_id !== "" && $data->department_id !== $current_department_in_db) ||
                                          (isset($data->department_id) && $data->department_id === "" && $current_department_in_db !== null);
        if ($department_changed_for_student && ($new_program_id_from_frontend === null || $new_program_id_from_frontend === "")) {
            $program_id = null;
        } else {
            $program_id = $new_program_id_from_frontend ?? $current_program_in_db;
        }

        // Determine new year_level_id
        $year_level_id = isset($data->year_level_id) && $data->year_level_id !== "" ? $data->year_level_id : $current_year_level_in_db;

        // Determine new section_id (set to null if program or year level changed and section is empty)
        $new_section_id_from_frontend = isset($data->section_id) && $data->section_id !== "" ? $data->section_id : null;
        $program_changed_for_student = (isset($data->program_id) && $data->program_id !== "" && $data->program_id !== $current_program_in_db) ||
                                       (isset($data->program_id) && $data->program_id === "" && $current_program_in_db !== null);
        $year_level_changed_for_student = (isset($data->year_level_id) && $data->year_level_id !== "" && $data->year_level_id !== $current_year_level_in_db) ||
                                          (isset($data->year_level_id) && $data->year_level_id === "" && $current_year_level_in_db !== null);
        
        if (($program_changed_for_student || $year_level_changed_for_student) && ($new_section_id_from_frontend === null || $new_section_id_from_frontend === "")) {
            $section_id = null;
        } else {
            $section_id = $new_section_id_from_frontend ?? $current_section_in_db;
        }

        $student_stmt->bindParam(':department_id', $department_id);
        $student_stmt->bindParam(':program_id', $program_id);
        $student_stmt->bindParam(':year_level_id', $year_level_id);
        $student_stmt->bindParam(':section_id', $section_id);
        $student_stmt->execute();
        if ($student_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Students table updated for name and other fields for ID: " . $data->KLD_ID);
        }

        // Handle advisor_id for students via section_advisors table
        // The `students` table does not have an `advisor_id` column directly.
        // Advisor is assigned to a section, and student belongs to a section.
        // If a new advisor_id is provided, and a section_id is present, 
        // we need to update the section_advisors table if the advisor for that section changes.
        $advisor_id = isset($data->advisor_id) && $data->advisor_id !== "" ? $data->advisor_id : null;
        if ($section_id !== null && $advisor_id !== null) {
            // Check if an entry already exists for this section
            $check_advisor_query = "SELECT advisor_id FROM section_advisors WHERE section_id = :section_id";
            $check_advisor_stmt = $conn->prepare($check_advisor_query);
            $check_advisor_stmt->bindParam(':section_id', $section_id);
            $check_advisor_stmt->execute();
            $current_advisor = $check_advisor_stmt->fetchColumn();

            if ($current_advisor === false) { // No advisor assigned to this section yet
                $insert_advisor_query = "INSERT INTO section_advisors (section_id, advisor_id) VALUES (:section_id, :advisor_id)";
                $insert_advisor_stmt = $conn->prepare($insert_advisor_query);
                $insert_advisor_stmt->bindParam(':section_id', $section_id);
                $insert_advisor_stmt->bindParam(':advisor_id', $advisor_id);
                $insert_advisor_stmt->execute();
                if ($insert_advisor_stmt->rowCount() > 0) {
                    $changesMade = true;
                }
            } elseif ($current_advisor !== $advisor_id) { // Advisor exists but is different
                $update_advisor_query = "UPDATE section_advisors SET advisor_id = :advisor_id WHERE section_id = :section_id";
                $update_advisor_stmt = $conn->prepare($update_advisor_query);
                $update_advisor_stmt->bindParam(':advisor_id', $advisor_id);
                $update_advisor_stmt->bindParam(':section_id', $section_id);
                $update_advisor_stmt->execute();
                if ($update_advisor_stmt->rowCount() > 0) {
                    $changesMade = true;
                }
            }
        } elseif ($section_id !== null && $advisor_id === null) {
            // If advisor_id is explicitly set to null, remove the advisor for this section
            $delete_advisor_query = "DELETE FROM section_advisors WHERE section_id = :section_id";
            $delete_advisor_stmt = $conn->prepare($delete_advisor_query);
            $delete_advisor_stmt->bindParam(':section_id', $section_id);
            $delete_advisor_stmt->execute();
            if ($delete_advisor_stmt->rowCount() > 0) {
                $changesMade = true;
            }
        }

    }

    // Update employees table if the user has any employee-related roles
    $employee_roles = ["faculty", "programchair", "dean", "admin"];
    $has_employee_role = false;
    foreach ($employee_roles as $emp_role) {
        if (in_array($emp_role, $current_user_roles_after_update)) {
            $has_employee_role = true;
            break;
        }
    }

    if ($has_employee_role) {
        $employee_query = "UPDATE employees SET
                                name = :name,
                                department_id = :department_id
                              WHERE employee_id = :employee_id";
        $employee_stmt = $conn->prepare($employee_query);

        $employee_stmt->bindParam(':employee_id', $data->KLD_ID); // Use KLD_ID (new ID) for WHERE clause
        $employee_stmt->bindParam(':name', $data->name);
        error_log("Employee Name Update - Incoming name: " . $data->name . " for employee ID: " . $data->KLD_ID);

        $department_id_employee = isset($data->department_id) && $data->department_id !== "" ? $data->department_id : null;

        $employee_stmt->bindParam(':department_id', $department_id_employee);
        $employee_stmt->execute();
        if ($employee_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Employees table updated for name and department for ID: " . $data->KLD_ID . ", Department ID: " . $department_id_employee);
        }
    }

    // Update program_chairs table if role is programchair
    if (in_array("programchair", $current_user_roles_after_update)) {
        // Fetch current department and program for program chair
        $current_pc_data_query = "SELECT department, program FROM program_chairs WHERE employee_id = :employee_id";
        $current_pc_data_stmt = $conn->prepare($current_pc_data_query);
        $current_pc_data_stmt->bindParam(':employee_id', $data->KLD_ID); // Use KLD_ID as employee_id
        $current_pc_data_stmt->execute();
        $current_pc_data = $current_pc_data_stmt->fetch(PDO::FETCH_ASSOC);

        $current_department_in_db = $current_pc_data['department'] ?? null;
        $current_program_in_db = $current_pc_data['program'] ?? null;

        $new_department_id_from_frontend = isset($data->department_id) && $data->department_id !== "" ? $data->department_id : null;
        $new_program_id_from_frontend = isset($data->program_id) && $data->program_id !== "" ? $data->program_id : null;

        // Determine if department was changed from frontend. This handles both changing to a new ID or clearing it.
        $department_changed_in_frontend = ($new_department_id_from_frontend !== null && $new_department_id_from_frontend !== $current_department_in_db) ||
                                          ($new_department_id_from_frontend === null && $current_department_in_db !== null);

        // Determine final department_id_pc
        $department_id_pc = $new_department_id_from_frontend ?? $current_department_in_db; // Use new if provided, else keep old

        // Determine final program_id_pc (set to null if department changed and program is empty)
        if ($department_changed_in_frontend && ($new_program_id_from_frontend === null || $new_program_id_from_frontend === "")) {
            // If department changed and no program selected in frontend for new department,
            // we cannot set to NULL due to NOT NULL constraint. Throw an error.
            error_log("Program Chair Update failed: Department changed and program cleared. Program is NOT NULL.");
            throw new Exception("Program cannot be empty when changing department for a Program Chair. Please select a program.");
        } else {
            $program_id_pc = $new_program_id_from_frontend ?? $current_program_in_db; // Use new if provided, else keep old
        }
        
        error_log("Program Chair Update - Final: KLD_ID=" . $data->KLD_ID . ", Department ID=" . $department_id_pc . ", Program ID=" . $program_id_pc);
        
        // Removed explicit validation here, let PDO handle NOT NULL exceptions

        $program_chair_query = "UPDATE program_chairs SET program = :program, department = :department WHERE employee_id = :employee_id";
        $program_chair_stmt = $conn->prepare($program_chair_query);
        $program_chair_stmt->bindParam(':program', $program_id_pc);
        $program_chair_stmt->bindParam(':department', $department_id_pc);
        $program_chair_stmt->bindParam(':employee_id', $data->KLD_ID);
        $program_chair_stmt->execute();
        if ($program_chair_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Program Chairs table updated for ID: " . $data->KLD_ID);
        } else {
            error_log("Program Chairs table: No rows affected for ID: " . $data->KLD_ID . " with department: " . $department_id_pc . " and program: " . $program_id_pc);
        }
    }

    // Update deans table if role is dean
    if (in_array("dean", $current_user_roles_after_update)) {
        // Fetch current department for dean
        $current_dean_data_query = "SELECT department FROM deans WHERE employee_id = :employee_id";
        $current_dean_data_stmt = $conn->prepare($current_dean_data_query);
        $current_dean_data_stmt->bindParam(':employee_id', $data->KLD_ID);
        $current_dean_data_stmt->execute();
        $current_dean_data = $current_dean_data_stmt->fetch(PDO::FETCH_ASSOC);

        $department_id_dean = isset($data->department_id) && $data->department_id !== "" ? $data->department_id : ($current_dean_data['department'] ?? null);

        error_log("Dean Update: KLD_ID=" . $data->KLD_ID . ", Department ID=" . $department_id_dean);

        if ($department_id_dean === null) {
            error_log("Dean update failed: Department ID is null for NOT NULL field.");
        } else {
            $dean_query = "UPDATE deans SET department = :department WHERE employee_id = :employee_id";
            $dean_stmt = $conn->prepare($dean_query);
            $dean_stmt->bindParam(':department', $department_id_dean);
            $dean_stmt->bindParam(':employee_id', $data->KLD_ID);
            $dean_stmt->execute();
            if ($dean_stmt->rowCount() > 0) {
                $changesMade = true;
                error_log("Deans table updated for ID: " . $data->KLD_ID);
            } else {
                error_log("Deans table: No rows affected for ID: " . $data->KLD_ID . " with department: " . $department_id_dean);
            }
        }
    }

    // Update faculty table if role is faculty
    if (in_array("faculty", $current_user_roles_after_update)) {
        // Fetch current department for faculty
        $current_faculty_data_query = "SELECT department, specialization FROM faculty WHERE employee_id = :employee_id";
        $current_faculty_data_stmt = $conn->prepare($current_faculty_data_query);
        $current_faculty_data_stmt->bindParam(':employee_id', $data->KLD_ID);
        $current_faculty_data_stmt->execute();
        $current_faculty_data = $current_faculty_data_stmt->fetch(PDO::FETCH_ASSOC);

        $department_id_faculty = isset($data->department_id) && $data->department_id !== "" ? $data->department_id : ($current_faculty_data['department'] ?? null);
        $specialization_faculty = isset($data->specialization) && $data->specialization !== "" ? $data->specialization : ($current_faculty_data['specialization'] ?? null);

        error_log("Faculty Update - Final: KLD_ID=" . $data->KLD_ID . ", Department ID=" . $department_id_faculty . ", Specialization: " . $specialization_faculty);
        
        // Removed explicit validation here, let PDO handle NOT NULL exceptions

        $faculty_query = "UPDATE faculty SET department = :department, specialization = :specialization WHERE employee_id = :employee_id";
        $faculty_stmt = $conn->prepare($faculty_query);
        $faculty_stmt->bindParam(':department', $department_id_faculty);
        $faculty_stmt->bindParam(':specialization', $specialization_faculty);
        $faculty_stmt->bindParam(':employee_id', $data->KLD_ID);
        $faculty_stmt->execute();
        if ($faculty_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Faculty table updated for ID: " . $data->KLD_ID);
        } else {
            error_log("Faculty table: No rows affected for ID: " . $data->KLD_ID . " with department: " . $department_id_faculty);
        }
    }

    // Note: Specialization for faculty is not in the EditAccountModal formData
    // If it were, it would be handled here.

    $conn->commit();

    if ($changesMade) {
        http_response_code(200);
        echo json_encode(array("success" => true, "message" => "User was updated successfully."));
    } else {
        http_response_code(200);
        echo json_encode(array("success" => true, "message" => "No changes were made to the user."));
    }
} catch (Exception $e) {
    $conn->rollBack();
    http_response_code(503);
    echo json_encode(array("success" => false, "message" => "Unable to update user: " . $e->getMessage()));
}
?>
