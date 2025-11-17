<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once '../../config/database.php';
require_once '../../utils/send_email.php';
require_once '../../models/StudentAdvisingForm.php';
require_once '../../models/User.php';
require_once '../../models/Faculty.php';
require_once '../../models/Section.php';

$database = new Database();
$db = $database->getConnection();

$studentAdvisingForm = new StudentAdvisingForm($db);
$user = new User($db);
$faculty = new Faculty($db);
$section = new Section($db);

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->student_id) && !empty($data->faculty_id) && !empty($data->academic_year_id) && !empty($data->semester_id)) {
    $studentAdvisingForm->student_id = $data->student_id;
    $studentAdvisingForm->faculty_id = $data->faculty_id;
    $studentAdvisingForm->academic_year_id = $data->academic_year_id;
    $studentAdvisingForm->semester_id = $data->semester_id;

    $user->id = $data->student_id;
    $student = $user->read_single();

    if ($student && $student['email']) {
        // Fetch advising form details
        $advisingFormData = $studentAdvisingForm->read_advising_form_by_student_faculty_ay_sem();

        if ($advisingFormData) {
            $faculty->user_id = $data->faculty_id;
            $facultyData = $faculty->read_single_faculty_details();

            $section->id = $advisingFormData['section_id'];
            $sectionData = $section->read_single();

            // Prepare email content
            $subject = "Your Advising Form for " . $advisingFormData['academic_year'] . " " . $advisingFormData['semester_name'];
            $body = "
                <p>Dear " . $student['first_name'] . " " . $student['last_name'] . ",</p>
                <p>Your advising form for the Academic Year " . $advisingFormData['academic_year'] . " and " . $advisingFormData['semester_name'] . " is available below:</p>
                
                <hr>
                
                <h3>Student Information</h3>
                <ul>
                    <li><strong>Name:</strong> " . $student['first_name'] . " " . $student['last_name'] . "</li>
                    <li><strong>Student ID:</strong> " . $student['student_id'] . "</li>
                    <li><strong>Program:</strong> " . $advisingFormData['program_name'] . "</li>
                    <li><strong>Section:</strong> " . $sectionData['name'] . "</li>
                </ul>

                <h3>Advisor Information</h3>
                <ul>
                    <li><strong>Faculty Advisor:</strong> " . $facultyData['first_name'] . " " . $facultyData['last_name'] . "</li>
                    <li><strong>Email:</strong> " . $facultyData['email'] . "</li>
                </ul>

                <h3>Advising Details</h3>
                <ul>
                    <li><strong>Academic Year:</strong> " . $advisingFormData['academic_year'] . "</li>
                    <li><strong>Semester:</strong> " . $advisingFormData['semester_name'] . "</li>
                    <li><strong>Total Units Advised:</strong> " . $advisingFormData['total_advised_units'] . "</li>
                    <li><strong>Advising Status:</strong> " . $advisingFormData['advising_status'] . "</li>
                    <li><strong>Date Advised:</strong> " . $advisingFormData['date_advised'] . "</li>
                </ul>

                <h4>Advised Courses:</h4>
                <table style='width:100%; border-collapse: collapse; border: 1px solid #ddd;'>
                    <thead>
                        <tr style='background-color: #f2f2f2;'>
                            <th style='padding: 8px; border: 1px solid #ddd; text-align: left;'>Course Code</th>
                            <th style='padding: 8px; border: 1px solid #ddd; text-align: left;'>Course Name</th>
                            <th style='padding: 8px; border: 1px solid #ddd; text-align: left;'>Units</th>
                            <th style='padding: 8px; border: 1px solid #ddd; text-align: left;'>Type</th>
                        </tr>
                    </thead>
                    <tbody>";
            foreach ($advisingFormData['courses'] as $course) {
                $body .= "
                        <tr>
                            <td style='padding: 8px; border: 1px solid #ddd;'>" . $course['course_code'] . "</td>
                            <td style='padding: 8px; border: 1px solid #ddd;'>" . $course['course_name'] . "</td>
                            <td style='padding: 8px; border: 1px solid #ddd;'>" . $course['units'] . "</td>
                            <td style='padding: 8px; border: 1px solid #ddd;'>" . ($course['is_credited'] ? 'Credited' : 'Regular') . "</td>
                        </tr>";
            }
            $body .= "
                    </tbody>
                </table>
                <hr>
                <p>If you have any questions, please contact your faculty advisor.</p>
                <p>Sincerely,</p>
                <p>The KLD Advising Team</p>
            ";

            if (sendEmail($student['email'], $student['first_name'] . " " . $student['last_name'], $subject, $body)) {
                http_response_code(200);
                echo json_encode(array("message" => "Advising form email sent successfully."));
            } else {
                http_response_code(500);
                echo json_encode(array("message" => "Failed to send advising form email."));
            }
        } else {
            http_response_code(404);
            echo json_encode(array("message" => "Advising form not found for the specified student, faculty, academic year, and semester."));
        }
    } else {
        http_response_code(404);
        echo json_encode(array("message" => "Student not found or email address is missing."));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Missing student_id, faculty_id, academic_year_id, or semester_id."));
}
?>
