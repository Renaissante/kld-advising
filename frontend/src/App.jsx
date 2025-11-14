import React, { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ActiveProvider } from '@/contexts/ActiveContext';
import AppRoutes from "./routes/AppRoutes";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";


const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ActiveProvider>
          <WebSocketHandler />
          <AppRoutes />
        </ActiveProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

// New component to handle the WebSocket connection and notifications
const WebSocketHandler = () => {
  const { user, activeRole } = useAuth(); // Access the authenticated user and activeRole

  console.log("WebSocketHandler rendered. User:", user); // Log user state on render
  console.log("WebSocketHandler rendered. activeRole:", activeRole); // LOG activeRole

  useEffect(() => {
    console.log("WebSocketHandler useEffect running. User:", user); // Log when effect runs
    let ws = null;

    // Only connect if user is logged in and is a faculty member (potential advisor)
    if (user && activeRole === 'faculty') {
      console.log("User is faculty, attempting WebSocket connection..."); // Log connection attempt
      try {
        
        ws = new WebSocket("wss://192.168.18.6:8080");

        ws.onopen = () => {
          console.log("WebSocket connection opened for global notifications");
          // Optionally send user ID to the server for identification
          ws.send(JSON.stringify({ type: 'auth', userId: user.id }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log("WebSocket message received globally:", message);

            // Check if the message is a generic notification from the backend
            // AND specifically the grades notification event
            if (message.type === 'notification' && message.payload?.event === 'grades_saved_notification') {
              // Check if the notification is for the current user (advisor)
              if (message.payload.recipientId && String(message.payload.recipientId) === String(user.id)) {
                // Display a toast notification
                toast.info(message.payload.message || "Grades updated for a section you advise.");
              }
            }
            // Add handlers for other global notification types here if needed
            // if (message.type === 'another_event') { ... }

          } catch (e) {
            console.error("Error parsing global WebSocket message:", e);
          }
        };

        ws.onerror = (error) => {
          console.error("Global WebSocket error:", error);
          // Optional: Display an error toast or message
          // toast.error("WebSocket connection error."); // Consider uncommenting this for user feedback
        };

        ws.onclose = (event) => {
          console.log("Global WebSocket connection closed", event.code, event.reason);
          // Optional: Attempt to reconnect if the closure was not intentional
        };

      } catch (e) {
        console.error("Failed to create global WebSocket connection:", e);
        // toast.error("Failed to connect to notification server."); // Consider uncommenting this for user feedback
      }
    } else {
      console.log("User is not faculty or not logged in, skipping WebSocket connection."); // Log why connection is skipped
    }

    // Cleanup function to close the WebSocket connection when the component unmounts
    return () => {
      console.log("WebSocketHandler cleanup running."); // Log cleanup
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
        console.log("Global WebSocket connection closed on unmount");
      }
    };
  }, [user]); // Re-run effect if user changes (e.g., logs in/out)

  return <Toaster />;
};


export default App;