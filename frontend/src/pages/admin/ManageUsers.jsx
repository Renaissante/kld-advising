import { useState, useEffect, useCallback, useRef } from "react"; // Add useRef
import { SidebarProvider } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { Toaster } from "@/components/ui/sonner";
import { CreateAccountModal } from "@/components/forms/CreateAccountModal";
import { UserTable } from "@/components/dashboard/UserTable";
import { SearchArea } from "@/components/shared/SearchArea";
import { PaginationComponent } from "@/components/shared/PaginationComponent";
import { Button } from "@/components/ui/button"; // Import Button
import { Loader2 } from "lucide-react"; // Import Loader2
import { toast } from "sonner"; // Import toast
import { API_BASE_URL } from '@/config/api';
import {
  AlertDialog, // Import AlertDialog components
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


import * as XLSX from "xlsx"; // Import the xlsx library

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ... existing imports ...

const roleHeadingMap = {
  system_admin: "System Admins",
  dean: "Deans",
  program_chair: "Program Chairs",
  faculty: "Faculty",
  student: "Students",
};

const ManageUsers = () => {

  const [usersData, setUsersData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("system_admin");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const heading = roleHeadingMap[selectedRole];

  const [isUploading, setIsUploading] = useState(false); // New state for upload loading

  // State for confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [parsedExcelData, setParsedExcelData] = useState(null);
  const [parsedExcelRole, setParsedExcelRole] = useState(null);


  // Reference for the hidden file input
  const fileInputRef = useRef(null);


  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        role: selectedRole,
        search: searchQuery,
        page: currentPage,
        pageSize,
      });

      const response = await fetch(
        `${API_BASE_URL}/users/get_user.php?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && Array.isArray(data.users)) {
        setUsersData(data.users);
        setTotalPages(data.totalPages || 1);
      } else {
        // Handle cases where data might be empty but valid (e.g., no users found)
         if (data && data.message) {
             console.warn("API returned message instead of users array:", data.message);
             setUsersData([]); // Clear previous data
             setTotalPages(1);
         } else {
            throw new Error("Invalid data structure from API");
         }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUsersData([]);
      setTotalPages(1);
    }
  }, [selectedRole, searchQuery, currentPage, pageSize]);


  useEffect(() => {
    fetchData();

    // --- Add WebSocket Connection ---
    const websocket = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);

    // Event handler for when the connection is opened
    websocket.onopen = () => {
      console.log('WebSocket connection opened for ManageUsers');
      // You could send an initial message here, e.g., to identify the user or page
      // websocket.send(JSON.stringify({ type: 'identify', role: 'admin', page: 'manage_users' }));
    };
    websocket.onmessage = (event) => {
      console.log('Message from websocket server:', event.data);
      try {
        const message = JSON.parse(event.data);

        // Check if the message is a generic notification from the backend
        if (message.type === 'backend_event' && message.payload && message.payload.event) { // Changed type to backend_event
          const eventType = message.payload.event;
          const eventRole = message.payload.role; // Get the role from the payload

          console.log(`Received notification event: ${eventType} for role: ${eventRole}`);

          // Handle different backend events
          if (eventType === 'user_created' || eventType === 'bulk_user_created') { // Handle both single and bulk creation events
            // If a user was created and the created user's role matches the currently selected role
            if (selectedRole === eventRole) {
              console.log(`User(s) created with role ${eventRole}. Refetching data for ${selectedRole}.`);
              fetchData(); // Call the fetchData function to refresh the user list
              // Optionally show a toast notification for bulk upload summary
              if (eventType === 'bulk_user_created' && message.payload.message) {
                   toast.info(message.payload.message);
              }
            } else {
               console.log(`User(s) created with role ${eventRole}, but current view is ${selectedRole}. No refetch needed.`);
            }
          }

          // else if (eventType === 'user_updated') {
          //   if (selectedRole === eventRole) {
          //     console.log(`User updated with role ${eventRole}. Refetching data for ${selectedRole}.`);
          //     fetchData();
          //   }
          // }
          // else if (eventType === 'user_deleted') {
          //   if (selectedRole === eventRole) {
          //     console.log(`User deleted with role ${eventRole}. Refetching data for ${selectedRole}.`);
          //     fetchData();
          //   }
          // }
        }
        // if (message.type === 'chat_message') { ... }

      } catch (e) {
        console.error('Failed to parse websocket message:', e);
      }
    };


    // Event handler for errors
    websocket.onerror = (error) => {
      console.error('WebSocket error in ManageUsers:', error);
    };

    // Event handler for when the connection is closed
    websocket.onclose = () => {
      console.log('WebSocket connection closed for ManageUsers');
      // You might want to implement reconnection logic here
    };

    // Clean up the websocket connection when the component unmounts
    return () => {
      websocket.close();
    };
    // --- End WebSocket Connection ---
    // --- End WebSocket Connection ---

  }, [fetchData, selectedRole]); // Add fetchData and selectedRole to the dependency array

  // Function to send the parsed data to the backend
  const sendDataToBackend = useCallback(async (dataToSend, roleToSend) => {
      setIsUploading(true); // Start loading indicator
      try {
          const response = await fetch(`${API_BASE_URL}/users/bulk_create.php`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: roleToSend, users: dataToSend })
          });

          // Check for multi-status (207) or other non-2xx responses
          if (!response.ok && response.status !== 207) {
               throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();

          if (data.message) {
               if (data.failedCount > 0) {
                   toast.warning(data.message); // Use warning for partial success
               } else {
                   toast.success(data.message); // Use success for full success
               }
              fetchData(); // Refresh the user list after upload attempt
          } else {
              toast.error("Failed to upload users: No message from server.");
          }
           // Log detailed results from the backend if available
           if (data.results) {
               console.log("Bulk upload results:", data.results);
           }
           if (data.failedUsers) {
               console.log("Failed users details:", data.failedUsers);
           }

      } catch (error) {
          console.error("Error uploading users:", error);
          toast.error("Network error during upload or server error.");
      } finally {
          setIsUploading(false);
          // Clear the file input value to allow re-uploading the same file
          if (fileInputRef.current) {
              fileInputRef.current.value = null;
          }
          // Clear temporary data and close dialog
          setParsedExcelData(null);
          setParsedExcelRole(null);
          setShowConfirmDialog(false);
      }
  }, [fetchData]); // Add fetchData to dependencies


  // New function to handle file upload
  const handleFileUpload = (event) => {
    console.log("handleFileUpload called"); // Log 3
    const file = event.target.files[0];
    if (!file) {
      console.log("No file selected."); // Log if no file
      // setIsUploading(false); // Don't set loading here, only after confirmation
      // event.target.value = null; // Clear input even if no file selected
      return; // Exit if no file is selected
    }

    console.log("File selected:", file.name); // Log file name
    // setIsUploading(true); // Don't set loading here, only after confirmation
    const reader = new FileReader();

    reader.onload = (e) => {
      console.log("FileReader onload fired"); // Log 4
      try {
        console.log("Attempting to read workbook..."); // Log 4a
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        console.log("Workbook read successfully."); // Log 4b

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        console.log("Attempting to convert sheet to JSON..."); // Log 4c
        const json = XLSX.utils.sheet_to_json(worksheet);
        console.log("Sheet converted to JSON."); // Log 4d


        // Define expected headers based on the selected role
        let expectedHeaders = [];
        if (selectedRole === 'faculty') {
          expectedHeaders = ['KLD ID', 'Name', 'Email', 'Department', 'Specialization'];
        } else if (selectedRole === 'student') {
          // Updated required headers for students based on backend requirements
          expectedHeaders = ['KLD ID', 'First Name', 'Last Name', 'Email', 'Department', 'Program', 'Year Level', 'Section', 'Entry Year'];
        } else {
          // This case should be prevented by disabling the button, but good for safety
          toast.error(`Bulk upload is not supported for the ${roleHeadingMap[selectedRole]} role.`);
          // setIsUploading(false); // Don't set loading here
          event.target.value = null;
          return;
        }

        console.log("Checking if JSON is empty..."); // Log 4e
        // Check if the parsed JSON is empty or doesn't have the expected structure (e.g., headers)
        if (!json || json.length === 0) {
            toast.error("Excel file is empty or could not be parsed.");
            // setIsUploading(false); // Don't set loading here
            event.target.value = null;
            return;
        }
        console.log("JSON is not empty."); // Log 4f


        console.log("Getting actual headers..."); // Log 4g
        // Get actual headers from the first row of the parsed data
        // XLSX.utils.sheet_to_json uses the first row as headers by default
        const actualHeaders = Object.keys(json[0]);
        console.log("Actual headers:", actualHeaders); // Log 4h


        console.log("Checking for missing headers..."); // Log 4i
        // Check if all expected headers are present in the actual headers
        const missingHeaders = expectedHeaders.filter(header => !actualHeaders.includes(header));

        if (missingHeaders.length > 0) {
          console.log("Missing headers found:", missingHeaders); // Log 4j
          toast.error(`Missing required columns for ${roleHeadingMap[selectedRole]}: ${missingHeaders.join(', ')}. Please check your Excel file headers.`);
          // setIsUploading(false); // Don't set loading here
          event.target.value = null;
          return;
        }
        console.log("No missing headers."); // Log 4k


        // Optional: Check for extra headers if you want strict validation
        // const extraHeaders = actualHeaders.filter(header => !expectedHeaders.includes(header));
        // if (extraHeaders.length > 0) {
        //     console.warn(`Extra columns found: ${extraHeaders.join(', ')}`);
        // }


        console.log(`Parsed Excel Data for role "${selectedRole}":`, json); // Log the parsed data

        // --- Data parsed successfully, show confirmation dialog ---
        setParsedExcelData(json);
        setParsedExcelRole(selectedRole);
        setShowConfirmDialog(true);
        // Do NOT clear the file input here, wait until after fetch completes or dialog is cancelled
        // Do NOT set isUploading to false here

      } catch (error) {
        console.error("Error reading or processing Excel file:", error); // Updated error log
        toast.error("Failed to read or process Excel file. Please ensure it's a valid format and has the correct columns."); // Updated toast
        // setIsUploading(false); // Don't set loading here
        event.target.value = null; // Clear input on error
      } finally {
        // This finally block is for the FileReader, not the fetch.
        // We handle cleanup after fetch or dialog cancellation.
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Function to trigger the hidden file input
  const triggerFileUpload = () => {
    console.log("triggerFileUpload called"); // Log 1
    if (fileInputRef.current) {
      console.log("fileInputRef.current exists, clicking..."); // Log 2
      fileInputRef.current.click();
    } else {
      console.log("fileInputRef.current is null"); // Log if ref is null
    }
  };

  // Determine if the upload button should be disabled
  const isUploadDisabled = isUploading || ['system_admin', 'dean', 'program_chair'].includes(selectedRole);


  return (
    <SidebarProvider>
     
      <Toaster />
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />

        <div className="mt-4 w-full flex flex-col md:flex-row justify-between px-0 p-4 md:p-6 mb-4 space-y-3 md:space-y-0">
          <div className="flex space-x-2">
            {/* Pass fetchData as a prop so the modal can trigger a refresh */}
            <CreateAccountModal onAccountCreated={fetchData} />
            <SearchArea
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="flex space-x-2"> {/* Added space-x-2 for gap */}
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xls,.xlsx"
              style={{ display: 'none' }}
            />
            {/* Button to trigger file upload */}
            <Button
              variant="outline"
              onClick={triggerFileUpload}
              disabled={isUploadDisabled} // Use the disabled state
              title={isUploadDisabled && selectedRole !== 'faculty' && selectedRole !== 'student' ? `Bulk upload is not available for ${roleHeadingMap[selectedRole]}` : ''} // Add tooltip
            >
              {isUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : "Upload From Excel"}
            </Button>
            <Select
              value={selectedRole}
              onValueChange={(value) => {
                setSelectedRole(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system_admin">System Admin</SelectItem>
                <SelectItem value="dean">Deans</SelectItem>
                <SelectItem value="program_chair">Program Chairs</SelectItem>
                <SelectItem value="faculty">Faculty</SelectItem>
                <SelectItem value="student">Students</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="px-3 md:px-8">
          <UserTable heading={heading} data={usersData} role={selectedRole} />
        </div>

        <div className="w-full flex justify-end p-3 md:p-4 mb-5">
          <PaginationComponent
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>

        <Separator />

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Bulk User Creation</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to create {parsedExcelData ? parsedExcelData.length : 0} {parsedExcelRole} accounts from the Excel file.
                <br />
                Please ensure the data is correct.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                  // Clear temporary data and file input on cancel
                  setParsedExcelData(null);
                  setParsedExcelRole(null);
                  if (fileInputRef.current) {
                      fileInputRef.current.value = null;
                  }
                  setShowConfirmDialog(false);
              }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                  // Proceed with upload
                  if (parsedExcelData && parsedExcelRole) {
                      sendDataToBackend(parsedExcelData, parsedExcelRole);
                  } else {
                      toast.error("No data to upload.");
                      setShowConfirmDialog(false);
                  }
              }}>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


      </main>
    </SidebarProvider>
  );
};

export default ManageUsers;