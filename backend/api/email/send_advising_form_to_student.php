<?php
// File: backend/api/email/send_advising_form_to_student.php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once '../../config/database.php';
include_once '../../config/cors.php';
require_once '../../config/email_config.php';
require_once '../../utils/send_email.php';
require_once dirname(__DIR__, 3) . '/vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

if (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') === 0) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (is_array($input)) {
        $_POST = array_merge($_POST, $input);
    }
}

// Accept POST or GET parameters
$def_input = function($k){return $_POST[$k]??$_GET[$k]??null;};
$student_id = $def_input('student_id');
$academic_year = $def_input('academic_year');
$semester = $def_input('semester');

if (!$student_id || !$academic_year || !$semester) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required parameters.']);
    exit();
}

try {
    // 1. Fetch student email and name from DB
    $query = 'SELECT s.name, u.email FROM students s JOIN users u ON s.student_id = u.id WHERE s.student_id = ?';
    $stmt = $conn->prepare($query);
    $stmt->execute([$student_id]);
    $student = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$student) {
        throw new Exception('Student not found.');
    }
    $recipientName = $student['name'];
    $recipientEmail = $student['email'];

    // 2. Download PDF using export endpoint (internal server call)
    $apiBase = (isset($_SERVER['HTTPS']) ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . dirname(dirname($_SERVER['SCRIPT_NAME']));
    $pdfUrl = $apiBase . "/dean/export_advising_forms.php?student_id=".urlencode($student_id)
             . "&academic_year=".urlencode($academic_year)
             . "&semester=".urlencode($semester)
             . "&format=pdf";
    $ch = curl_init($pdfUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_HEADER, 1);
    $response = curl_exec($ch);
    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headers = substr($response, 0, $header_size);
    $pdf_data = substr($response, $header_size);
    curl_close($ch);

    if ($http_code !== 200) {
        throw new Exception('Failed to generate advising form PDF.');
    }

    // Filename from header (fallback: advising_form.pdf)
    $filename = 'advising_form.pdf';
    if (preg_match('/filename="?([^";]+)"?/i', $headers, $matches)) {
        $filename = $matches[1];
    }

    // 3. Send email with PDF attachment (using PHPMailer directly)
    $subject = "Your Academic Advising Form ($academic_year $semester)";
    $body = "Dear ".htmlspecialchars($recipientName).",<br><br>Your academic advising form for $academic_year $semester is attached as a PDF.<br><br>Thank you,<br>".SENDER_NAME;

    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = SMTP_HOST;
    $mail->SMTPAuth = SMTP_AUTH;
    $mail->Username = SMTP_USERNAME;
    $mail->Password = SMTP_PASSWORD;
    if (SMTP_SECURE === 'tls') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    } else if (SMTP_SECURE === 'ssl') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    } else {
        $mail->SMTPSecure = false;
    }
    $mail->Port = SMTP_PORT;
    $mail->setFrom(SENDER_EMAIL, SENDER_NAME);
    $mail->addAddress($recipientEmail, $recipientName);
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $body;
    $mail->AltBody = strip_tags($body);
    $mail->addStringAttachment($pdf_data, $filename, 'base64', 'application/pdf');

    $mail->send();
    echo json_encode(['success' => true, 'message' => 'Advising form sent to student email.']);

} catch (Exception $e) {
    error_log($e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to send advising form: ' . $e->getMessage()]);
}
