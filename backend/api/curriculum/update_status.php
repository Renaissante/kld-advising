<?php
// Include CORS headers
include_once '../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

include_once '../../config/database.php';

$data = json_decode(file_get_contents("php://input"));

// Check required fields
if (empty($data->id) || empty($data->status)) {
    http_response_code(400);
    echo json_encode(array("message" => "Missing required fields. ID and status are required."));
    exit();
}

// Validate status value
if (!in_array($data->status, ['Active', 'Inactive'])) {
    http_response_code(400);
    echo json_encode(array("message" => "Invalid status value. Must be either 'Active' or 'Inactive'."));
    exit();
}

try {
    // Update curriculum status
    $query = "UPDATE curriculums SET status = :status WHERE curriculum_id = :id";
    $stmt = $conn->prepare($query);

    // Sanitize and bind data
    $status = htmlspecialchars(strip_tags($data->status));
    $id = htmlspecialchars(strip_tags($data->id));

    $stmt->bindParam(":status", $status);
    $stmt->bindParam(":id", $id);

    if ($stmt->execute()) {
        // Get the updated curriculum data
        $fetch_query = "SELECT c.curriculum_id as id, c.name, c.program_id, p.name as program, 
                       c.academic_year_id, ay.academic_year_name as academicYear, c.status 
                       FROM curriculums c
                       INNER JOIN programs p ON c.program_id = p.id
                       INNER JOIN academic_years ay ON c.academic_year_id = ay.academic_year_id
                       WHERE c.curriculum_id = :id";
        $fetch_stmt = $conn->prepare($fetch_query);
        $fetch_stmt->bindParam(":id", $id);
        $fetch_stmt->execute();
        
        if ($curriculum = $fetch_stmt->fetch(PDO::FETCH_ASSOC)) {
            $curriculum_data = array(
                "id" => $curriculum['id'],
                "name" => $curriculum['name'],
                "program_id" => $curriculum['program_id'],
                "program" => $curriculum['program'],
                "academic_year_id" => $curriculum['academic_year_id'],
                "academicYear" => $curriculum['academicYear'] ?? '', // Use null-coalescing operator
                "status" => $curriculum['status']
            );
            
            http_response_code(200);
            echo json_encode(array(
                "message" => "Curriculum status updated successfully.",
                "curriculum" => $curriculum_data
            ));
        } else {
            http_response_code(404);
            echo json_encode(array("message" => "Curriculum not found."));
        }
    } else {
        http_response_code(503);
        echo json_encode(array("message" => "Unable to update curriculum status."));
    }
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>