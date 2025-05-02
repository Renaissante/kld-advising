<?php
// Set header to return JSON response
header('Content-Type: application/json');

// Include database connection
require_once '../db_connection.php'; // Adjust path as needed

// Check if the request method is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

// Get the raw POST data
$rawData = file_get_contents('php://input');
// Decode the JSON data
$data = json_decode($rawData, true);

// Validate input
if (!isset($data['course_id']) || !isset($data['prerequisite_id'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Missing course_id or prerequisite_id.']);
    exit;
}

$course_id = filter_var($data['course_id'], FILTER_VALIDATE_INT);
$prerequisite_id = filter_var($data['prerequisite_id'], FILTER_VALIDATE_INT);

// Further validation
if ($course_id === false || $prerequisite_id === false || $course_id <= 0 || $prerequisite_id <= 0) {
     http_response_code(400); // Bad Request
     echo json_encode(['success' => false, 'message' => 'Invalid course_id or prerequisite_id. Both must be positive integers.']);
     exit;
}

// Prevent adding a course as its own prerequisite
if ($course_id === $prerequisite_id) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'A course cannot be its own prerequisite.']);
    exit;
}

// --- Optional: Add check for circular dependencies ---
// This can be complex. A simple check might prevent direct circularity (A->B and B->A)
// A full check requires traversing the prerequisite graph.
// For now, we'll skip the full circular dependency check for simplicity.

try {
    $conn = connect_db(); // Function from db_connection.php

    // Check if both courses exist (optional but good practice)
    $stmt_check_course = $conn->prepare("SELECT COUNT(*) FROM courses WHERE id = ?");
    $stmt_check_course->bind_param("i", $course_id);
    $stmt_check_course->execute();
    $stmt_check_course->bind_result($count_course);
    $stmt_check_course->fetch();
    $stmt_check_course->close(); // Close statement before preparing the next one

    $stmt_check_prereq = $conn->prepare("SELECT COUNT(*) FROM courses WHERE id = ?");
    $stmt_check_prereq->bind_param("i", $prerequisite_id);
    $stmt_check_prereq->execute();
    $stmt_check_prereq->bind_result($count_prereq);
    $stmt_check_prereq->fetch();
    $stmt_check_prereq->close();

    if ($count_course == 0 || $count_prereq == 0) {
        http_response_code(404); // Not Found
        echo json_encode(['success' => false, 'message' => 'One or both specified courses do not exist.']);
        $conn->close();
        exit;
    }


    // Prepare the INSERT statement
    // Use INSERT IGNORE or ON DUPLICATE KEY UPDATE if you want to handle potential duplicate entries gracefully
    // Using plain INSERT will cause an error if the pair already exists, which we catch below.
    $stmt = $conn->prepare("INSERT INTO prerequisites (course_id, prerequisite_id) VALUES (?, ?)");

    if ($stmt === false) {
        throw new Exception("Prepare failed: (" . $conn->errno . ") " . $conn->error);
    }

    // Bind parameters
    $stmt->bind_param("ii", $course_id, $prerequisite_id);

    // Execute the statement
    if ($stmt->execute()) {
        // Success
        http_response_code(201); // Created
        echo json_encode(['success' => true, 'message' => 'Prerequisite added successfully.']);
    } else {
        // Check for duplicate entry error (MySQL error code 1062)
        if ($conn->errno == 1062) {
             http_response_code(409); // Conflict
             echo json_encode(['success' => false, 'message' => 'This prerequisite relationship already exists.']);
        } else {
            // Other execution error
            throw new Exception("Execute failed: (" . $stmt->errno . ") " . $stmt->error);
        }
    }

    // Close statement and connection
    $stmt->close();
    $conn->close();

} catch (Exception $e) {
    // Error handling
    http_response_code(500); // Internal Server Error
    // Log the detailed error message to the server logs instead of exposing it to the client
    error_log("Error in add_prerequisite.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'An error occurred while adding the prerequisite.']);
}

?>