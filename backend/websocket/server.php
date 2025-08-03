<?php
use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;


require __DIR__ . '/../../vendor/autoload.php'; // Adjust path as needed

class NotificationServer implements MessageComponentInterface {
    protected $clients;

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        echo "WebSocket server started\n";
    }

    public function onOpen(ConnectionInterface $conn) {
        // Store the new connection to send messages to later
        $this->clients->attach($conn);

        echo "New connection! ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        echo sprintf('Received message "%s" from connection %d' . "\n", $msg, $from->resourceId);

        $data = json_decode($msg, true);

        if ($data === null) {
            echo "Received invalid JSON: " . $msg . "\n";
            return; // Ignore invalid messages
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

            // Broadcast the notification to all connected clients (frontend users)
            foreach ($this->clients as $client) {
                // In a real application, you might filter clients based on roles,
                // pages they are viewing, etc. For now, broadcast to all.
                $client->send($notificationMessage);
            }
        }
        else {
            // Handle other types of messages (e.g., from frontend clients if needed)
            echo "Received message from frontend client or unhandled backend type: " . $msg . "\n";
            // Example: If you had a chat feature, you'd handle those messages here
            // foreach ($this->clients as $client) {
            //     if ($from !== $client) { // Don't send the message back to the sender
            //         $client->send($msg);
            //     }
            // }
        }
    }

    public function onClose(ConnectionInterface $conn) {
        // The connection is closed, remove it from the collection of connected clients
        $this->clients->detach($conn);

        echo "Connection {$conn->resourceId} has disconnected\n";
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