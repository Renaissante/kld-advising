<?php

header("Content-Type: application/json");
include_once '../../config/cors.php';
require_once "../../config/database.php";
require_once "../../config/email_config.php"; // Include email configuration
require_once "../../utils/send_email.php";     // Include email utility

error_reporting(E_ALL);
ini_set('display_errors', 1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method Not Allowed"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (empty($data->role) || !isset($data->users) || !is_array($data->users)) {
    http_response_code(400);
    echo json_encode(["message" => "Invalid input. 'role' and 'users' array are required."]);
    exit;
}

$role = $data->role;
$users = $data->users;
$results = []; // To store results for each user
$processedCount = 0;
$failedCount = 0;
$failedUsers = [];

// Function to generate a random temporary password
function generateTemporaryPassword($length = 10) {
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
    $password = "";
    for ($i = 0; $i < $length; $i++) {
        $password .= $chars[rand(0, strlen($chars) - 1)];
    }
    return $password;
}

try {
    switch ($role) {
        case 'faculty':
            $requiredHeaders = ['KLD ID', 'Name', 'Email', 'Department'];

            foreach ($users as $userData) {
                $conn->beginTransaction();
                $userResult = ['userData' => $userData, 'success' => false, 'message' => ''];

                // Validate required fields for faculty
                $missingFields = [];
                foreach ($requiredHeaders as $header) {
                    // Use array access for headers with spaces
                    if (!isset($userData->{$header}) || $userData->{$header} === '') {
                         $missingFields[] = $header;
                    }
                }

                if (!empty($missingFields)) {
                    $userResult['message'] = "Missing required fields: " . implode(', ', $missingFields);
                    $failedUsers[] = $userResult;
                    $failedCount++;
                    $conn->rollBack();
                    continue;
                }

                // Extract data
                $userId = $userData->{'KLD ID'};
                $name = $userData->Name;
                $email = $userData->Email;
                $departmentName = $userData->Department;
                
                $dob = null; // DOB is not in Excel, set to null

                try {
                    // Check if user already exists by ID or email
                    $sqlCheckUser = "SELECT id FROM users WHERE id = :id OR email = :email LIMIT 1";
                    $stmtCheckUser = $conn->prepare($sqlCheckUser);
                    $stmtCheckUser->bindParam(':id', $userId);
                    $stmtCheckUser->bindParam(':email', $email);
                    $stmtCheckUser->execute();
                    if ($stmtCheckUser->fetch(PDO::FETCH_ASSOC)) {
                         throw new Exception("User with KLD ID '{$userId}' or email '{$email}' already exists.");
                    }

                    // Retrieve department ID
                    $sqlDept = "SELECT id FROM departments WHERE name = :department";
                    $stmtDept = $conn->prepare($sqlDept);
                    $stmtDept->bindParam(':department', $departmentName);
                    $stmtDept->execute();
                    $departmentRow = $stmtDept->fetch(PDO::FETCH_ASSOC);

                    if (!$departmentRow) {
                        throw new Exception("Invalid department: '{$departmentName}'.");
                    }
                    $departmentId = $departmentRow['id'];

                    // Get the role_id for 'faculty'
                    $sqlGetRoleId = "SELECT id FROM roles WHERE role_name = :role_name";
                    $stmtGetRoleId = $conn->prepare($sqlGetRoleId);
                    $roleNameToInsert = 'faculty';
                    $stmtGetRoleId->bindParam(':role_name', $roleNameToInsert);
                    $stmtGetRoleId->execute();
                    $roleRow = $stmtGetRoleId->fetch(PDO::FETCH_ASSOC);

                    if (!$roleRow) {
                        throw new Exception("Role 'faculty' not found in roles table.");
                    }
                    $roleId = $roleRow['id'];

                    // Insert into users table (without role column)
                    $sqlUser = "INSERT INTO users (id, email, password_hash, created_at)
                                VALUES (:id, :email, :password_hash, NOW())";
                    $stmtUser = $conn->prepare($sqlUser);
                    $tempPassword = generateTemporaryPassword(); // Generate unique temporary password
                    $hashedPassword = password_hash($tempPassword, PASSWORD_DEFAULT); // Hash it

                    $stmtUser->bindParam(':id', $userId);
                    $stmtUser->bindParam(':email', $email);
                    $stmtUser->bindParam(':password_hash', $hashedPassword); // Use the hashed password
                    // $stmtUser->bindParam(':role', $userRole); // Removed role column
                    $stmtUser->execute();

                    // Insert into user_roles table
                    $sqlUserRole = "INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)";
                    $stmtUserRole = $conn->prepare($sqlUserRole);
                    $stmtUserRole->bindParam(':user_id', $userId);
                    $stmtUserRole->bindParam(':role_id', $roleId);
                    $stmtUserRole->execute();

                    // Insert into employees table
                    $sqlEmployee = "INSERT INTO employees (employee_id, name, dob, department_id, created_at)
                                    VALUES (:employee_id, :name, :dob, :department_id, NOW())";
                    $stmtEmployee = $conn->prepare($sqlEmployee);
                    $stmtEmployee->bindParam(':employee_id', $userId);
                    $stmtEmployee->bindParam(':name', $name);
                    $stmtEmployee->bindParam(':dob', $dob);
                    $stmtEmployee->bindParam(':department_id', $departmentId);
                    $stmtEmployee->execute();

                    // Insert into faculty table
                    $sqlFaculty = "INSERT INTO faculty (employee_id, department)
                                    VALUES (:employee_id, :department)";
                    $stmtFaculty = $conn->prepare($sqlFaculty);
                    $stmtFaculty->bindParam(':employee_id', $userId);
                    
                    $stmtFaculty->bindParam(':department', $departmentId);
                    $stmtFaculty->execute();

                    $conn->commit();
                    $userResult['success'] = true;
                    $userResult['message'] = "Faculty account created successfully.";
                    $processedCount++;

                    // Send temporary password to user's email
                    $subject = "Your New Account Credentials for KLD Advising System";
                    $body = "Hello " . $name . ",<br><br>";
                    $body .= "Your account for the KLD Advising System has been successfully created.<br>";
                    $body .= "Your username is: <b>" . $email . "</b><br>";
                    $body .= "Your temporary password is: <b>" . $tempPassword . "</b><br><br>";
                    $body .= "Please log in using your credentials and change your password immediately:<br>";
                    $body .= "<a href=\"" . LOGIN_PAGE_URL . "\">Login Page</a><br><br>";
                    $body .= "Thank you.<br>";
                    $body .= "KLD Advising System Team";
                    sendEmail($email, $name, $subject, $body);

                } catch (PDOException $e) {
                    $conn->rollBack();
                    $userResult['message'] = "Database error: " . $e->getMessage();
                    $failedUsers[] = $userResult;
                    $failedCount++;
                } catch (Exception $e) {
                     $conn->rollBack();
                     $userResult['message'] = "Error: " . $e->getMessage();
                     $failedUsers[] = $userResult;
                     $failedCount++;
                }
                $results[] = $userResult;
            }

            break;

        case 'student':
            // Updated required headers for students - Middle Name is now optional
            $requiredHeaders = ['KLD ID', 'First Name', 'Last Name', 'Email', 'Department', 'Program', 'Year Level', 'Section', 'Entry Year'];

            foreach ($users as $userData) {
                $conn->beginTransaction();
                $userResult = ['userData' => $userData, 'success' => false, 'message' => ''];

                // Validate required fields for student
                 $missingFields = [];
                foreach ($requiredHeaders as $header) {
                    if (!isset($userData->{$header}) || $userData->{$header} === '') {
                         $missingFields[] = $header;
                    }
                }

                if (!empty($missingFields)) {
                    $userResult['message'] = "Missing required fields: " . implode(', ', $missingFields);
                    $failedUsers[] = $userResult;
                    $failedCount++;
                    $conn->rollBack();
                    continue;
                }

                // Extract data
                $userId = $userData->{'KLD ID'};
                $firstName = $userData->{'First Name'};
                // Safely access Middle Name, defaulting to empty string if not set or empty
                $middleName = isset($userData->{'Middle Name'}) ? $userData->{'Middle Name'} : '';
                $lastName = $userData->{'Last Name'};
                $email = $userData->Email;
                $departmentName = $userData->Department;
                $programName = $userData->Program;
                $yearLevelValue = $userData->{'Year Level'};
                $sectionName = $userData->Section;
                $entryYearName = $userData->{'Entry Year'};
                // $advisorIdentifier = $userData->{'Advisor KLD ID'}; // Assuming this is the advisor's KLD ID (employee_id)

                $fullName = trim($firstName . ' ' . $middleName . ' ' . $lastName);
                $userRole = 'student';
                $dob = null; // DOB not required in Excel headers

                try {
                    // Check if user already exists by ID or email
                    $sqlCheckUser = "SELECT id FROM users WHERE id = :id OR email = :email LIMIT 1";
                    $stmtCheckUser = $conn->prepare($sqlCheckUser);
                    $stmtCheckUser->bindParam(':id', $userId);
                    $stmtCheckUser->bindParam(':email', $email);
                    $stmtCheckUser->execute();
                    if ($stmtCheckUser->fetch(PDO::FETCH_ASSOC)) {
                         throw new Exception("User with KLD ID '{$userId}' or email '{$email}' already exists.");
                    }

                    // Retrieve department ID
                    $sqlDept = "SELECT id FROM departments WHERE name = :department";
                    $stmtDept = $conn->prepare($sqlDept);
                    $stmtDept->bindParam(':department', $departmentName);
                    $stmtDept->execute();
                    $departmentRow = $stmtDept->fetch(PDO::FETCH_ASSOC);
                    if (!$departmentRow) {
                        throw new Exception("Invalid department: '{$departmentName}'.");
                    }
                    $departmentId = $departmentRow['id'];

                    // Retrieve program ID
                    $sqlProgram = "SELECT id FROM programs WHERE name = :program";
                    $stmtProgram = $conn->prepare($sqlProgram);
                    $stmtProgram->bindParam(':program', $programName);
                    $stmtProgram->execute();
                    $programRow = $stmtProgram->fetch(PDO::FETCH_ASSOC);
                    if (!$programRow) {
                        throw new Exception("Invalid program: '{$programName}'.");
                    }
                    $programId = $programRow['id'];

                    // Retrieve year level ID
                    $sqlYearLevel = "SELECT id FROM year_levels WHERE level = :yearLevel";
                    $stmtYearLevel = $conn->prepare($sqlYearLevel);
                    $stmtYearLevel->bindParam(':yearLevel', $yearLevelValue);
                    $stmtYearLevel->execute();
                    $yearLevelRow = $stmtYearLevel->fetch(PDO::FETCH_ASSOC);
                    if (!$yearLevelRow) {
                        throw new Exception("Invalid year level: '{$yearLevelValue}'.");
                    }
                    $yearLevelId = $yearLevelRow['id'];

                    // Retrieve section ID
                    $sqlSection = "SELECT id FROM sections WHERE name = :section AND program_id = :programId AND year_level_id = :yearLevelId";
                    $stmtSection = $conn->prepare($sqlSection);
                    $stmtSection->bindParam(':section', $sectionName);
                    $stmtSection->bindParam(':programId', $programId);
                    $stmtSection->bindParam(':yearLevelId', $yearLevelId);
                    $stmtSection->execute();
                    $sectionRow = $stmtSection->fetch(PDO::FETCH_ASSOC);
                    if (!$sectionRow) {
                        throw new Exception("Invalid section: '{$sectionName}' for program '{$programName}' and year level '{$yearLevelValue}'.");
                    }
                    $sectionId = $sectionRow['id'];

                    // Retrieve entry year ID (Academic Year ID)
                    $sqlEntryYear = "SELECT academic_year_id FROM academic_years WHERE academic_year_name = :yearName";
                    $stmtEntryYear = $conn->prepare($sqlEntryYear);
                    $stmtEntryYear->bindParam(':yearName', $entryYearName);
                    $stmtEntryYear->execute();
                    $entryYearRow = $stmtEntryYear->fetch(PDO::FETCH_ASSOC);
                    if (!$entryYearRow) {
                        throw new Exception("Invalid entry year: '{$entryYearName}'. Academic year not found.");
                    }
                    $entryYearId = $entryYearRow['academic_year_id'];

                    // Retrieve curriculum ID based on entry year ID
                    $sqlCurriculum = "SELECT curriculum_id FROM curriculums WHERE academic_year_id = :entry_year_id";
                    $stmtCurriculum = $conn->prepare($sqlCurriculum);
                    $stmtCurriculum->bindParam(':entry_year_id', $entryYearId);
                    $stmtCurriculum->execute();
                    $curriculumRow = $stmtCurriculum->fetch(PDO::FETCH_ASSOC);
                    if (!$curriculumRow) {
                        throw new Exception("No curriculum found for entry year '{$entryYearName}'.");
                    }
                    $curriculumId = $curriculumRow['curriculum_id'];

                    // Find Advisor Employee ID (Optional)
                    $advisorIdentifier = isset($userData->{'Advisor KLD ID'}) ? $userData->{'Advisor KLD ID'} : null; // Safely access Advisor KLD ID
                    $advisorEmployeeId = null; // Default to null
                    if (!empty($advisorIdentifier)) {
                         $sqlCheckAdvisor = "SELECT employee_id FROM faculty WHERE employee_id = :advisorId LIMIT 1";
                         $stmtCheckAdvisor = $conn->prepare($sqlCheckAdvisor);
                         $stmtCheckAdvisor->bindParam(':advisorId', $advisorIdentifier);
                         $stmtCheckAdvisor->execute();
                         $advisorRow = $stmtCheckAdvisor->fetch(PDO::FETCH_ASSOC);
                         if ($advisorRow) {
                             $advisorEmployeeId = $advisorRow['employee_id'];
                         } else {
                             // If advisor ID is provided but not found, report it as a warning or error
                             // For now, let's just log it and proceed with advisor_id as null
                             error_log("Warning: Advisor KLD ID '{$advisorIdentifier}' not found for student '{$userId}'. Advisor will not be assigned.");
                             // If you want to make advisor assignment mandatory and fail if not found, uncomment the line below:
                             // throw new Exception("Invalid or non-existent advisor KLD ID: '{$advisorIdentifier}'.");
                         }
                    }

                    // Get the role_id for 'student'
                    $sqlGetRoleId = "SELECT id FROM roles WHERE role_name = :role_name";
                    $stmtGetRoleId = $conn->prepare($sqlGetRoleId);
                    $roleNameToInsert = 'student';
                    $stmtGetRoleId->bindParam(':role_name', $roleNameToInsert);
                    $stmtGetRoleId->execute();
                    $roleRow = $stmtGetRoleId->fetch(PDO::FETCH_ASSOC);

                    if (!$roleRow) {
                        throw new Exception("Role 'student' not found in roles table.");
                    }
                    $roleId = $roleRow['id'];

                    // Insert into users table (without role column)
                    $sqlUser = "INSERT INTO users (id, email, password_hash, created_at)
                                VALUES (:id, :email, :password_hash, NOW())";
                    $stmtUser = $conn->prepare($sqlUser);
                    $tempPassword = generateTemporaryPassword(); // Generate unique temporary password
                    $hashedPassword = password_hash($tempPassword, PASSWORD_DEFAULT); // Hash it

                    $stmtUser->bindParam(':id', $userId);
                    $stmtUser->bindParam(':email', $email);
                    $stmtUser->bindParam(':password_hash', $hashedPassword); // Use the hashed password
                    // $stmtUser->bindParam(':role', $userRole); // Removed role column
                    $stmtUser->execute();

                    // Insert into user_roles table
                    $sqlUserRole = "INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)";
                    $stmtUserRole = $conn->prepare($sqlUserRole);
                    $stmtUserRole->bindParam(':user_id', $userId);
                    $stmtUserRole->bindParam(':role_id', $roleId);
                    $stmtUserRole->execute();

                    // Insert into students table
                    $sqlStudent = "INSERT INTO students (student_id, name, department_id, year_level_id, section_id, program_id, entry_year_id, curriculum_id, created_at)
                                    VALUES (:student_id, :name, :department_id, :year_level_id, :section_id, :program_id, :entry_year_id, :curriculum_id, NOW())";
                    $stmtStudent = $conn->prepare($sqlStudent);
                    $stmtStudent->bindParam(':student_id', $userId);
                    $stmtStudent->bindParam(':name', $fullName);
                    $stmtStudent->bindParam(':department_id', $departmentId);
                    $stmtStudent->bindParam(':year_level_id', $yearLevelId);
                    $stmtStudent->bindParam(':section_id', $sectionId);
                    $stmtStudent->bindParam(':program_id', $programId);
                    $stmtStudent->bindParam(':entry_year_id', $entryYearId);
                    $stmtStudent->bindParam(':curriculum_id', $curriculumId);
                    $stmtStudent->execute();

                    // Get the auto-incremented ID of the newly created student
                    $newlyCreatedStudentInternalId = $conn->lastInsertId();

                    // Insert into student_section_enrollments table
                    $sqlEnrollment = "INSERT INTO student_section_enrollments (student_id, section_id) VALUES (:student_id, :section_id)";
                    $stmtEnrollment = $conn->prepare($sqlEnrollment);
                    $stmtEnrollment->bindParam(':student_id', $newlyCreatedStudentInternalId); // Use the internal integer ID
                    $stmtEnrollment->bindParam(':section_id', $sectionId);
                    $stmtEnrollment->execute();

                    // Pre-populate course_grades table for the student
                    $sqlCourses = "SELECT id FROM courses WHERE curriculum_id = :curriculum_id";
                    $stmtCourses = $conn->prepare($sqlCourses);
                    $stmtCourses->bindParam(':curriculum_id', $curriculumId);
                    $stmtCourses->execute();
                    $courses = $stmtCourses->fetchAll(PDO::FETCH_ASSOC);

                    if (!empty($courses)) {
                        $sqlGradeInsert = "INSERT INTO course_grades (student_id, course_id) VALUES (:student_id, :course_id)";
                        $stmtGradeInsert = $conn->prepare($sqlGradeInsert);
                        foreach ($courses as $course) {
                            $stmtGradeInsert->bindParam(':student_id', $userId);
                            $stmtGradeInsert->bindParam(':course_id', $course['id']);
                            $stmtGradeInsert->execute();
                        }
                    }

                    $conn->commit();
                    $userResult['success'] = true;
                    $userResult['message'] = "Student account created successfully.";
                    $processedCount++;

                    // Send temporary password to user's email
                    $subject = "Your New Account Credentials for KLD Advising System";
                    $body = "Hello " . $fullName . ",<br><br>";
                    $body .= "Your account for the KLD Advising System has been successfully created.<br>";
                    $body .= "Your username is: <b>" . $email . "</b><br>";
                    $body .= "Your temporary password is: <b>" . $tempPassword . "</b><br><br>";
                    $body .= "Please log in using your credentials and change your password immediately:<br>";
                    $body .= "<a href=\"" . LOGIN_PAGE_URL . "\">Login Page</a><br><br>";
                    $body .= "Thank you.<br>";
                    $body .= "KLD Advising System Team";
                    sendEmail($email, $fullName, $subject, $body);

                } catch (PDOException $e) {
                    $conn->rollBack();
                    $userResult['message'] = "Database error: " . $e->getMessage();
                    $failedUsers[] = $userResult;
                    $failedCount++;
                } catch (Exception $e) {
                     $conn->rollBack();
                     $userResult['message'] = "Error: " . $e->getMessage();
                     $failedUsers[] = $userResult;
                     $failedCount++;
                }
                 $results[] = $userResult;
            }

            break;

        default:
            http_response_code(400);
            echo json_encode(["message" => "Invalid role specified for bulk upload."]);
            exit; // Exit here as the role is invalid
    }

    // --- Send WebSocket notification ---
    require dirname(__DIR__, 3) . '/vendor/autoload.php';
    try {
        $client = new WebSocket\Client("ws://localhost:8080");

        $responseMessage = "Bulk {$role} upload complete. Processed: {$processedCount}, Failed: {$failedCount}.";
        if ($failedCount > 0) {
             $responseMessage .= " See response details for failures.";
        }

        $wsMessage = json_encode([
            'type' => 'backend_event',
            'payload' => [
                'event' => 'bulk_user_created',
                'role' => $role, // Keep original role for reporting purposes
                'processedCount' => $processedCount,
                'failedCount' => $failedCount,
                'message' => $responseMessage
            ]
        ]);
        $client->send($wsMessage);
        $client->close();
    } catch (Exception $e) {
        error_log("WebSocket error sending bulk {$role} message: " . $e->getMessage());
    }
    // --- End WebSocket notification ---

    // Determine HTTP status code based on results
    $statusCode = ($failedCount > 0) ? 207 : 201; // 207 Multi-Status if some failed, 201 Created if all succeeded

    http_response_code($statusCode);
    echo json_encode([
        "message" => "Bulk upload process finished.",
        "role" => $role,
        "processedCount" => $processedCount,
        "failedCount" => $failedCount,
        "results" => $results, // Include results for each user
        "failedUsers" => $failedUsers // Include details of failed users
    ]);

} catch (Exception $e) {
    // This catch block handles errors before processing starts (e.g., invalid initial input structure)
    // or unexpected errors during the loop setup.
    http_response_code(500);
    echo json_encode(["error" => "Server error during bulk processing setup: " . $e->getMessage()]);
}

?>