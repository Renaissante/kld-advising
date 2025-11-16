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

    // Re-fetch current roles to ensure we're working with the latest set after role changes for further processing
    $current_roles_stmt = $conn->prepare($current_roles_query);
    $current_roles_stmt->bindParam(':user_id', $data->KLD_ID);
    $current_roles_stmt->execute();
    $current_user_roles_after_update = array_column($current_roles_stmt->fetchAll(PDO::FETCH_ASSOC), 'role_name');

    // Get roles that were newly added and roles that were removed
    $roles_added = array_diff($new_roles_from_frontend, $existing_role_names);
    $roles_removed = array_diff($existing_role_names, $new_roles_from_frontend);

    // 2. Conditionally insert/delete/update other tables based on role changes and current roles

    // Handle 'student' role
    if (in_array("student", $roles_added)) {
        // Check if student record already exists to prevent duplicate inserts
        $check_student_query = "SELECT COUNT(*) FROM students WHERE student_id = :student_id";
        $check_student_stmt = $conn->prepare($check_student_query);
        $check_student_stmt->bindParam(':student_id', $data->KLD_ID);
        $check_student_stmt->execute();
        if ($check_student_stmt->fetchColumn() == 0) {
            $insert_student_query = "INSERT INTO students (student_id, name, department_id, program_id, year_level_id, section_id) VALUES (:student_id, :name, :department_id, :program_id, :year_level_id, :section_id)";
            $insert_student_stmt = $conn->prepare($insert_student_query);
            $insert_student_stmt->bindParam(':student_id', $data->KLD_ID);
            $insert_student_stmt->bindParam(':name', $data->name);
            $insert_student_stmt->bindValue(':department_id', isset($data->department_id) && $data->department_id !== "" ? $data->department_id : null, PDO::PARAM_INT);
            $insert_student_stmt->bindValue(':program_id', isset($data->program_id) && $data->program_id !== "" ? $data->program_id : null, PDO::PARAM_INT);
            $insert_student_stmt->bindValue(':year_level_id', isset($data->year_level_id) && $data->year_level_id !== "" ? $data->year_level_id : null, PDO::PARAM_INT);
            $insert_student_stmt->bindValue(':section_id', isset($data->section_id) && $data->section_id !== "" ? $data->section_id : null, PDO::PARAM_INT);
            $insert_student_stmt->execute();
            if ($insert_student_stmt->rowCount() > 0) {
                $changesMade = true;
                error_log("Inserted new student record for ID: " . $data->KLD_ID);
            }
        }
    } elseif (in_array("student", $roles_removed)) {
        // Soft delete: Update status to 'inactive' instead of deleting
        $update_student_status_query = "UPDATE students SET status = 'inactive' WHERE student_id = :student_id";
        $update_student_status_stmt = $conn->prepare($update_student_status_query);
        $update_student_status_stmt->bindParam(':student_id', $data->KLD_ID);
        $update_student_status_stmt->execute();
        if ($update_student_status_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Soft-deleted student record for ID: " . $data->KLD_ID);
        }
    }

    // Handle 'employee' related roles (faculty, programchair, dean, admin)
    $employee_roles = ["faculty", "programchair", "dean", "admin"];
    $has_employee_role_before = !empty(array_intersect($existing_role_names, $employee_roles));
    $has_employee_role_after = !empty(array_intersect($current_user_roles_after_update, $employee_roles));

    if ($has_employee_role_after && !$has_employee_role_before) { // Employee role newly added
        // Check if employee record already exists
        $check_employee_query = "SELECT COUNT(*) FROM employees WHERE employee_id = :employee_id";
        $check_employee_stmt = $conn->prepare($check_employee_query);
        $check_employee_stmt->bindParam(':employee_id', $data->KLD_ID);
        $check_employee_stmt->execute();
        if ($check_employee_stmt->fetchColumn() == 0) {
            $insert_employee_query = "INSERT INTO employees (employee_id, name, department_id) VALUES (:employee_id, :name, :department_id)";
            $insert_employee_stmt = $conn->prepare($insert_employee_query);
            $insert_employee_stmt->bindParam(':employee_id', $data->KLD_ID);
            $insert_employee_stmt->bindParam(':name', $data->name);
            $insert_employee_stmt->bindValue(':department_id', isset($data->department_id) && $data->department_id !== "" ? $data->department_id : null, PDO::PARAM_INT);
            $insert_employee_stmt->execute();
            if ($insert_employee_stmt->rowCount() > 0) {
                $changesMade = true;
                error_log("Inserted new employee record for ID: " . $data->KLD_ID);
            }
        }
    } elseif (!$has_employee_role_after && $has_employee_role_before) { // All employee roles removed
        // Soft delete: Update status to 'inactive' instead of deleting
        $update_employee_status_query = "UPDATE employees SET status = 'inactive' WHERE employee_id = :employee_id";
        $update_employee_status_stmt = $conn->prepare($update_employee_status_query);
        $update_employee_status_stmt->bindParam(':employee_id', $data->KLD_ID);
        $update_employee_status_stmt->execute();
        if ($update_employee_status_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Soft-deleted employee record for ID: " . $data->KLD_ID);
        }
    }

    // Handle 'programchair' role
    if (in_array("programchair", $roles_added)) {
        $check_pc_query = "SELECT COUNT(*) FROM program_chairs WHERE employee_id = :employee_id";
        $check_pc_stmt = $conn->prepare($check_pc_query);
        $check_pc_stmt->bindParam(':employee_id', $data->KLD_ID);
        $check_pc_stmt->execute();
        if ($check_pc_stmt->fetchColumn() == 0) {
            $insert_pc_query = "INSERT INTO program_chairs (employee_id, program, department) VALUES (:employee_id, :program, :department)";
            $insert_pc_stmt = $conn->prepare($insert_pc_query);
            $insert_pc_stmt->bindParam(':employee_id', $data->KLD_ID);
            $insert_pc_stmt->bindValue(':program', isset($data->program_id) && $data->program_id !== "" ? $data->program_id : null, PDO::PARAM_INT);
            $insert_pc_stmt->bindValue(':department', isset($data->department_id) && $data->department_id !== "" ? $data->department_id : null, PDO::PARAM_INT);
            $insert_pc_stmt->execute();
            if ($insert_pc_stmt->rowCount() > 0) {
                $changesMade = true;
                error_log("Inserted new program chair record for ID: " . $data->KLD_ID);
            }
        }
    } elseif (in_array("programchair", $roles_removed)) {
        // Soft delete: Update status to 'inactive' instead of deleting
        $update_pc_status_query = "UPDATE program_chairs SET status = 'inactive' WHERE employee_id = :employee_id";
        $update_pc_status_stmt = $conn->prepare($update_pc_status_query);
        $update_pc_status_stmt->bindParam(':employee_id', $data->KLD_ID);
        $update_pc_status_stmt->execute();
        if ($update_pc_status_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Soft-deleted program chair record for ID: " . $data->KLD_ID);
        }
    }

    // Handle 'dean' role
    if (in_array("dean", $roles_added)) {
        $check_dean_query = "SELECT COUNT(*) FROM deans WHERE employee_id = :employee_id";
        $check_dean_stmt = $conn->prepare($check_dean_query);
        $check_dean_stmt->bindParam(':employee_id', $data->KLD_ID);
        $check_dean_stmt->execute();
        if ($check_dean_stmt->fetchColumn() == 0) {
            $insert_dean_query = "INSERT INTO deans (employee_id, department) VALUES (:employee_id, :department)";
            $insert_dean_stmt = $conn->prepare($insert_dean_query);
            $insert_dean_stmt->bindParam(':employee_id', $data->KLD_ID);
            $insert_dean_stmt->bindValue(':department', isset($data->department_id) && $data->department_id !== "" ? $data->department_id : null, PDO::PARAM_INT);
            $insert_dean_stmt->execute();
            if ($insert_dean_stmt->rowCount() > 0) {
                $changesMade = true;
                error_log("Inserted new dean record for ID: " . $data->KLD_ID);
            }
        }
    } elseif (in_array("dean", $roles_removed)) {
        // Soft delete: Update status to 'inactive' instead of deleting
        $update_dean_status_query = "UPDATE deans SET status = 'inactive' WHERE employee_id = :employee_id";
        $update_dean_status_stmt = $conn->prepare($update_dean_status_query);
        $update_dean_status_stmt->bindParam(':employee_id', $data->KLD_ID);
        $update_dean_status_stmt->execute();
        if ($update_dean_status_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Soft-deleted dean record for ID: " . $data->KLD_ID);
        }
    }

    // Handle 'faculty' role
    if (in_array("faculty", $roles_added)) {
        $check_faculty_query = "SELECT COUNT(*) FROM faculty WHERE employee_id = :employee_id";
        $check_faculty_stmt = $conn->prepare($check_faculty_query);
        $check_faculty_stmt->bindParam(':employee_id', $data->KLD_ID);
        $check_faculty_stmt->execute();
        if ($check_faculty_stmt->fetchColumn() == 0) {
            $insert_faculty_query = "INSERT INTO faculty (employee_id, department) VALUES (:employee_id, :department)"; // Specialization is nullable
            $insert_faculty_stmt = $conn->prepare($insert_faculty_query);
            $insert_faculty_stmt->bindParam(':employee_id', $data->KLD_ID);
            $insert_faculty_stmt->bindValue(':department', isset($data->department_id) && $data->department_id !== "" ? $data->department_id : null, PDO::PARAM_INT);
            $insert_faculty_stmt->execute();
            if ($insert_faculty_stmt->rowCount() > 0) {
                $changesMade = true;
                error_log("Inserted new faculty record for ID: " . $data->KLD_ID);
            }
        }
    } elseif (in_array("faculty", $roles_removed)) {
        // Soft delete: Update status to 'inactive' instead of deleting
        $update_faculty_status_query = "UPDATE faculty SET status = 'inactive' WHERE employee_id = :employee_id";
        $update_faculty_status_stmt = $conn->prepare($update_faculty_status_query);
        $update_faculty_status_stmt->bindParam(':employee_id', $data->KLD_ID);
        $update_faculty_status_stmt->execute();
        if ($update_faculty_status_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Soft-deleted faculty record for ID: " . $data->KLD_ID);
        }
    }

    // Handle 'admin' role
    if (in_array("admin", $roles_added)) {
        $check_admin_query = "SELECT COUNT(*) FROM system_admins WHERE employee_id = :employee_id";
        $check_admin_stmt = $conn->prepare($check_admin_query);
        $check_admin_stmt->bindParam(':employee_id', $data->KLD_ID);
        $check_admin_stmt->execute();
        if ($check_admin_stmt->fetchColumn() == 0) {
            $insert_admin_query = "INSERT INTO system_admins (employee_id, status) VALUES (:employee_id, 'active')";
            $insert_admin_stmt = $conn->prepare($insert_admin_query);
            $insert_admin_stmt->bindParam(':employee_id', $data->KLD_ID);
            $insert_admin_stmt->execute();
            if ($insert_admin_stmt->rowCount() > 0) {
                $changesMade = true;
                error_log("Inserted new system admin record for ID: " . $data->KLD_ID);
            }
        }
    } elseif (in_array("admin", $roles_removed)) {
        // Soft delete: Update status to 'inactive' instead of deleting
        $update_admin_status_query = "UPDATE system_admins SET status = 'inactive' WHERE employee_id = :employee_id";
        $update_admin_status_stmt = $conn->prepare($update_admin_status_query);
        $update_admin_status_stmt->bindParam(':employee_id', $data->KLD_ID);
        $update_admin_status_stmt->execute();
        if ($update_admin_status_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Soft-deleted system admin record for ID: " . $data->KLD_ID);
        }
    }

    // Now proceed with updates for existing roles
    // Use in_array() checks against $current_user_roles_after_update
    if (in_array("student", $current_user_roles_after_update)) {
        $student_query = "UPDATE students SET
                            name = :name,
                            department_id = :department_id,
                            program_id = :program_id,
                            year_level_id = :year_level_id,
                            section_id = :section_id,
                            status = 'active' -- Set status to active if role is present
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
    // This block now only handles updates, creation/deletion handled above
    if ($has_employee_role_after) {
        $employee_query = "UPDATE employees SET
                                name = :name,
                                dob = :dob,
                                department_id = :department_id,
                                status = 'active' -- Set status to active if role is present
                              WHERE employee_id = :employee_id";
        $employee_stmt = $conn->prepare($employee_query);

        $employee_stmt->bindParam(':employee_id', $data->KLD_ID); // Use KLD_ID (new ID) for WHERE clause
        $employee_stmt->bindParam(':name', $data->name);
        error_log("Employee Name Update - Incoming name: " . $data->name . " for employee ID: " . $data->KLD_ID);

        $department_id_employee = isset($data->department_id) && $data->department_id !== "" ? $data->department_id : null;
        $dob_employee = isset($data->dob) && $data->dob !== "" ? $data->dob : null;

        $employee_stmt->bindValue(':dob', $dob_employee, PDO::PARAM_STR);
        $employee_stmt->bindParam(':department_id', $department_id_employee);
        $employee_stmt->execute();
        if ($employee_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Employees table updated for name and department for ID: " . $data->KLD_ID . ", Department ID: " . $department_id_employee);
        }
    }

    // Update program_chairs table if role is programchair
    // This block now only handles updates, creation/deletion handled above
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
        // Adjust for NOT NULL constraint on program in program_chairs if applicable.
        // For simplicity, we assume if department changes and program is empty, it means no program is associated with the new department,
        // and we will try to set it to NULL. If DB schema doesn't allow, it will throw an exception.
        if ($department_changed_in_frontend && ($new_program_id_from_frontend === null || $new_program_id_from_frontend === "")) {
            $program_id_pc = null;
        } else {
            $program_id_pc = $new_program_id_from_frontend ?? $current_program_in_db; // Use new if provided, else keep old
        }
        
        error_log("Program Chair Update - Final: KLD_ID=" . $data->KLD_ID . ", Department ID=" . $department_id_pc . ", Program ID=" . $program_id_pc);
        
        $program_chair_query = "UPDATE program_chairs SET program = :program, department = :department, status = 'active' WHERE employee_id = :employee_id";
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
    // This block now only handles updates, creation/deletion handled above
    if (in_array("dean", $current_user_roles_after_update)) {
        // Fetch current department for dean
        $current_dean_data_query = "SELECT department FROM deans WHERE employee_id = :employee_id";
        $current_dean_data_stmt = $conn->prepare($current_dean_data_query);
        $current_dean_data_stmt->bindParam(':employee_id', $data->KLD_ID);
        $current_dean_data_stmt->execute();
        $current_dean_data = $current_dean_data_stmt->fetch(PDO::FETCH_ASSOC);

        $department_id_dean = isset($data->department_id) && $data->department_id !== "" ? $data->department_id : ($current_dean_data['department'] ?? null);

        error_log("Dean Update: KLD_ID=" . $data->KLD_ID . ", Department ID=" . $department_id_dean);

        // We bind department_id_dean to null if it's empty from frontend for nullable columns.
        $dean_query = "UPDATE deans SET department = :department, status = 'active' WHERE employee_id = :employee_id";
        $dean_stmt = $conn->prepare($dean_query);
        $dean_stmt->bindValue(':department', $department_id_dean, PDO::PARAM_INT); // Bind as INT or NULL
        $dean_stmt->bindParam(':employee_id', $data->KLD_ID);
        $dean_stmt->execute();
        if ($dean_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Deans table updated for ID: " . $data->KLD_ID);
        } else {
            error_log("Deans table: No rows affected for ID: " . $data->KLD_ID . " with department: " . $department_id_dean);
        }
    }

    // Update faculty table if role is faculty
    // This block now only handles updates, creation/deletion handled above
    if (in_array("faculty", $current_user_roles_after_update)) {
        // Fetch current department for faculty
        $current_faculty_data_query = "SELECT department FROM faculty WHERE employee_id = :employee_id";
        $current_faculty_data_stmt = $conn->prepare($current_faculty_data_query);
        $current_faculty_data_stmt->bindParam(':employee_id', $data->KLD_ID);
        $current_faculty_data_stmt->execute();
        $current_faculty_data = $current_faculty_data_stmt->fetch(PDO::FETCH_ASSOC);

        $department_id_faculty = isset($data->department_id) && $data->department_id !== "" ? $data->department_id : ($current_faculty_data['department'] ?? null);

        error_log("Faculty Update - Final: KLD_ID=" . $data->KLD_ID . ", Department ID=" . $department_id_faculty);
        
        $faculty_query = "UPDATE faculty SET department = :department, status = 'active' WHERE employee_id = :employee_id";
        $faculty_stmt = $conn->prepare($faculty_query);
        $faculty_stmt->bindValue(':department', $department_id_faculty, PDO::PARAM_INT); // Bind as INT or NULL
        $faculty_stmt->bindParam(':employee_id', $data->KLD_ID);
        $faculty_stmt->execute();
        if ($faculty_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("Faculty table updated for ID: " . $data->KLD_ID);
        } else {
            error_log("Faculty table: No rows affected for ID: " . $data->KLD_ID . " with department: " . $department_id_faculty);
        }
    }

    // Update system_admins table if role is admin
    if (in_array("admin", $current_user_roles_after_update)) {
        $admin_query = "UPDATE system_admins SET status = 'active' WHERE employee_id = :employee_id";
        $admin_stmt = $conn->prepare($admin_query);
        $admin_stmt->bindParam(':employee_id', $data->KLD_ID);
        $admin_stmt->execute();
        if ($admin_stmt->rowCount() > 0) {
            $changesMade = true;
            error_log("System Admins table updated for ID: " . $data->KLD_ID);
        } else {
            error_log("System Admins table: No rows affected for ID: " . $data->KLD_ID);
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
