<?php
header("Content-Type: application/json");
include_once '../../config/cors.php';
require_once "../../config/database.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method Not Allowed"
    ]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if ((empty($data->userId) && empty($data->email)) || empty($data->newPassword) || empty($data->confirmPassword) || empty($data->temporaryPassword)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "User ID or Email, new password, confirm password, and temporary password are required."
    ]);
    exit;
}

$userId = $data->userId ?? null;
$email = $data->email ?? null;
$newPassword = $data->newPassword;
$confirmPassword = $data->confirmPassword;
$temporaryPassword = $data->temporaryPassword; // Retrieve temporary password

if ($newPassword !== $confirmPassword) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "New password and confirm password do not match."
    ]);
    exit;
}

// Password strength validation
if (strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Password must be at least 8 characters long."
    ]);
    exit;
}

try {
    $conn->beginTransaction();

    // Determine the user ID to update
    $finalUserId = null;
    if (!empty($userId)) {
        // If userId is provided (from URL), it's the primary identifier.
        // We directly use it. The email field in the form acts as additional data for the request
        // but is not used for primary user identification or cross-verification here.
        $finalUserId = $userId;
    } elseif (!empty($email)) {
        // If no userId but email is provided, find userId by email
        $sqlUserLookup = "SELECT id FROM users WHERE email = :email";
        $stmtUserLookup = $conn->prepare($sqlUserLookup);
        $stmtUserLookup->bindParam(':email', $email);
        $stmtUserLookup->execute();
        $userRecord = $stmtUserLookup->fetch(PDO::FETCH_ASSOC);

        if ($userRecord) {
            $finalUserId = $userRecord['id'];
        } else {
            http_response_code(404);
            echo json_encode([
                "success" => false,
                "message" => "User with provided email not found."
            ]);
            exit;
        }
    } else {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "A valid User ID or Email is required."
        ]);
        exit;
    }

    // Check if password has already been set
    error_log("DEBUG - Checking user ID: " . $finalUserId);
    
    $sqlCheckPasswordSet = "SELECT id, password_set, password_hash FROM users WHERE id = :finalUserId";
    $stmtCheckPasswordSet = $conn->prepare($sqlCheckPasswordSet);
    $stmtCheckPasswordSet->bindParam(':finalUserId', $finalUserId);
    $stmtCheckPasswordSet->execute();
    $currentStatus = $stmtCheckPasswordSet->fetch(PDO::FETCH_ASSOC);
    
    error_log("DEBUG - Query result: " . print_r($currentStatus, true));
    error_log("DEBUG - password_set value: " . var_export($currentStatus['password_set'] ?? 'NULL', true));

    if (!$currentStatus) {
        $conn->rollBack();
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "User not found based on provided ID or Email."
        ]);
        exit;
    }

    // Verify the provided temporary password against the stored password_hash
    // For testing purposes, we compare raw passwords. In production, use password_verify().
    if ($currentStatus['password_hash'] !== $temporaryPassword) {
        $conn->rollBack();
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Invalid temporary password provided."
        ]);
        exit;
    }
    
    if ($currentStatus && $currentStatus['password_set']) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Password has already been set for this account. Please use the 'Forgot Password' feature if you need to reset it."
        ]);
        exit;
    }

    // Update the user's password and set password_set to true
    // Note: Password is stored as plain text for testing purposes
    $sql = "UPDATE users SET password_hash = :password_hash, password_set = TRUE, updated_at = NOW() WHERE id = :finalUserId";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':password_hash', $newPassword);
    $stmt->bindParam(':finalUserId', $finalUserId);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $conn->commit();
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Password set successfully."
        ]);
    } else {
        $conn->rollBack();
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Failed to set password. User not found or an unexpected error occurred."
        ]);
    }
} catch (PDOException $e) {
    $conn->rollBack();
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "A database error occurred. Please try again later."
    ]);
} catch (Exception $e) {
    $conn->rollBack();
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Server error: " . $e->getMessage()
    ]);
}
?>