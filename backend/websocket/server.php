<?php
use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;


require __DIR__ . '/../../vendor/autoload.php'; // Adjust path as needed

class NotificationServer implements MessageComponentInterface {
    protected $clients;
    protected $users;

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        $this->users = []; // To map userId to ConnectionInterface
        echo "WebSocket server started\n";
    }

    public function onOpen(ConnectionInterface $conn) {
        // Store the new connection to send messages to later
        $this->clients->attach($conn);
        $conn->userId = null; // Initialize userId for the connection

        echo "New connection! ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        echo sprintf('Received message "%s" from connection %d' . "\n", $msg, $from->resourceId);

        $data = json_decode($msg, true);

        if ($data === null) {
            echo "Received invalid JSON: " . $msg . "\n";
            return; // Ignore invalid messages
        }

        // Handle authentication message to associate userId with connection
        if (isset($data['type']) && $data['type'] === 'auth' && isset($data['payload']['userId'])) {
            $userId = $data['payload']['userId'];
            $from->userId = $userId; // Attach userId to the connection object
            $this->users[$userId] = $from; // Map userId to this connection
            echo "Connection {$from->resourceId} authenticated as user {$userId}\n";
            return;
        }

        // Check if the message is a generic backend event
        if (isset($data['type']) && $data['type'] === 'backend_event' && isset($data['payload']['event'])) {
            $backendEvent = $data['payload']['event'];
            $eventPayload = $data['payload']; // Keep the original payload details

            echo "Received backend event: " . $backendEvent . "\n";

            // Prepare a generic notification message for frontend clients
            $notificationMessage = json_encode([
                'type' => 'notification', // Generic notification type for frontend
                'payload' => $eventPayload // Pass the original backend event payload to the frontend
            ]);

            // Check for specific events that require targeted delivery
            if ($backendEvent === 'grades_saved_notification' && isset($eventPayload['recipientId'])) {
                $recipientId = $eventPayload['recipientId'];
                if (isset($this->users[$recipientId]) && $this->users[$recipientId] instanceof ConnectionInterface) {
                    $this->users[$recipientId]->send($notificationMessage);
                    echo "Sent grades_saved_notification to specific advisor: {$recipientId}\n";
                } else {
                    echo "Recipient advisor {$recipientId} not found or not connected for grades_saved_notification.\n";
                }
            } else {
                // For all other backend events, broadcast to all connected clients
                foreach ($this->clients as $client) {
                    $client->send($notificationMessage);
                }
            }
        } else if (isset($data['type']) && $data['type'] === 'frontend_event' && isset($data['payload']['event'])) {
            $frontendEvent = $data['payload']['event'];
            $eventPayload = $data['payload'];

            echo "Received frontend event: " . $frontendEvent . "\n";

            // Handle specific frontend events
            switch ($frontendEvent) {
                case 'student_advised':
                    $notificationMessage = json_encode([
                        'type' => 'notification',
                        'payload' => $eventPayload
                    ]);
                    // Broadcast to all clients except the sender
                    foreach ($this->clients as $client) {
                        if ($from !== $client) {
                            $client->send($notificationMessage);
                        }
                    }
                    break;
                default:
                    echo "Unhandled frontend event: " . $frontendEvent . "\n";
                    break;
            }
        }
        else {
            // Handle other types of messages (e.g., from frontend clients if needed)
            echo "Received message from frontend client or unhandled backend type: " . $msg . "\n";
        }
    }

    public function onClose(ConnectionInterface $conn) {
        // The connection is closed, remove it from the collection of connected clients
        $this->clients->detach($conn);
        // Remove user from the map if they were authenticated
        if ($conn->userId !== null) {
            unset($this->users[$conn->userId]);
            echo "User {$conn->userId} disconnected. Connection {$conn->resourceId} has disconnected\n";
        } else {
            echo "Connection {$conn->resourceId} has disconnected (unauthenticated)\n";
        }
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "An error has occurred: {$e->getMessage()}\n";

        $conn->close();
    }
}

// Run the server application through the WebSocket protocol on port 8080
$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new NotificationServer()
        )
    ),
    8080 // You can change the port if needed
);

$server->run();