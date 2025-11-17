<?php
require_once __DIR__ . '/../../../vendor/autoload.php';
require_once '../../config/database.php';
require_once '../../config/cors.php'; // Adjust path to dompdf_init.inc.php as needed
use Dompdf\Dompdf;
use Dompdf\Options;

ob_start(); // Start output buffering

error_reporting(E_ALL);
ini_set('display_errors', 1);

$input = json_decode(file_get_contents('php://input'), true);

// Log the input data
error_log("PDF Report Generator: Received input: " . print_r($input, true));

if (!isset($input['type']) || !isset($input['data'])) {
    http_response_code(400);
    header('Content-Type: application/json'); // Set header only for error responses
    echo json_encode(['success' => false, 'message' => 'Invalid request.']);
    exit;
}

$reportType = $input['type'];
$reportData = $input['data'];
$academicYear = isset($input['academicYear']) ? $input['academicYear'] : 'N/A';
$semester = isset($input['semester']) ? $input['semester'] : 'N/A';

$html = '';

// Set up Dompdf options
$options = new Options();
$options->set('isHtml5ParserEnabled', true);
$options->set('isRemoteEnabled', true);
$dompdf = new Dompdf($options);

// Add base path for images and CSS if needed
// $dompdf->setBasePath(__DIR__ . '/../../'); 

$html .= '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Report</title>
    <style>
        body { font-family: sans-serif; margin: 20mm; }
        h1, h2 { text-align: center; color: #1b4b2a; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .header-info { text-align: center; margin-bottom: 20px; }
        .header-info p { margin: 0; }
    </style>
</head>
<body>';

$html .= '<div class="header-info">
    <h2>KLD Advising System Report</h2>
    <p>Academic Year: ' . htmlspecialchars($academicYear) . '</p>
    <p>Semester: ' . htmlspecialchars($semester) . '</p>
</div>';

if ($reportType === 'advisingCompletion') {
    $html .= '<h1>Advising Completion Report</h1>';
    $html .= '<table>
        <thead>
            <tr>
                <th>Program</th>
                <th>Total Forms</th>
                <th>Completed Forms</th>
                <th>Pending Forms</th>
                <th>Completion Rate</th>
            </tr>
        </thead>
        <tbody>';
    foreach ($reportData as $row) {
        $html .= '<tr>
            <td>' . htmlspecialchars($row['program']) . '</td>
            <td>' . htmlspecialchars((string)($row['totalForms'] ?? '')) . '</td>
            <td>' . htmlspecialchars((string)($row['completedForms'] ?? '')) . '</td>
            <td>' . htmlspecialchars((string)($row['overdueForms'] ?? '')) . '</td>
            <td>' . htmlspecialchars((string)($row['completionRate'] ?? '')) . '</td>
        </tr>';
    }
    $html .= '</tbody></table>';
} elseif ($reportType === 'facultyWorkload') {
    $html .= '<h1>Faculty Workload Report</h1>';
    $html .= '<table>
        <thead>
            <tr>
                <th>Faculty</th>
                <th>Advised Students</th>
                <th>Sections Taught</th>
                <th>Total Units</th>
            </tr>
        </thead>
        <tbody>';
    foreach ($reportData as $row) {
        $html .= '<tr>
            <td>' . htmlspecialchars($row['faculty']) . '</td>
            <td>' . htmlspecialchars($row['advisedStudents']) . '</td>
            <td>' . htmlspecialchars($row['sectionsTaught']) . '</td>
            <td>' . htmlspecialchars($row['totalUnits']) . '</td>
        </tr>';
    }
    $html .= '</tbody></table>';
}

$html .= '</body></html>';

$dompdf->loadHtml($html);

// (Optional) Setup the paper size and orientation
$dompdf->setPaper('A4', 'portrait');

try {
    // Render the HTML as PDF
    $dompdf->render();

    // Output the generated PDF to Browser
    $dompdf->stream("report.pdf", array("Attachment" => false));
} catch (Exception $e) {
    ob_clean(); // Clean any output buffer before sending error response
    error_log("PDF Report Generator Error: " . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json'); // Set header only for error responses
    echo json_encode(['success' => false, 'message' => 'Failed to generate PDF: ' . $e->getMessage()]);
}
?>
