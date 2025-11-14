import { useState, useEffect, useCallback, useRef } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { Toaster } from "@/components/ui/sonner";
import { UserTable } from "@/components/dashboard/UserTable";
import { SearchArea } from "@/components/shared/SearchArea";
import { PaginationComponent } from "@/components/shared/PaginationComponent";
import { toast } from "sonner";
import { API_BASE_URL } from '@/config/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EditAccountModal } from "@/components/forms/EditAccountModal";

const ArchivedUsers = () => {

  const [usersData, setUsersData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const heading = "Archived Users";

  // State for edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);

  // State for restore confirmation dialog
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [userToRestore, setUserToRestore] = useState(null);


  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: 'archived', // Fetch archived users
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
         if (data && data.message) {
             console.warn("API returned message instead of users array:", data.message);
             setUsersData([]);
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
  }, [searchQuery, currentPage, pageSize]);


  useEffect(() => {
    fetchData();

    // --- Add WebSocket Connection ---
    const websocket = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://` + import.meta.env.VITE_WEBSOCKET_URL.split("://")[1]
    );

    websocket.onopen = () => {
      console.log('WebSocket connection opened for ArchivedUsers');
    };
    websocket.onmessage = (event) => {
      console.log('Message from websocket server:', event.data);
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'backend_event' && message.payload && message.payload.event) {
          const eventType = message.payload.event;
          
          if (eventType === 'user_archived' || eventType === 'user_restored' || eventType === 'user_updated') {
            console.log(`User event (${eventType}) detected. Refetching archived user data.`);
            fetchData();
          }
        }

      } catch (e) {
        console.error('Failed to parse websocket message:', e);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error in ArchivedUsers:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket connection closed for ArchivedUsers');
    };

    return () => {
      websocket.close();
    };
    // --- End WebSocket Connection ---

  }, [fetchData]);

  const handleEditUser = (user) => {
    setUserToEdit(user);
    setShowEditModal(true);
  };

  const handleRestoreUser = (user) => {
    setUserToRestore(user);
    setShowRestoreConfirm(true);
  };

  const confirmRestoreUser = async () => {
    if (!userToRestore) return;

    try {
      const response = await fetch(`${API_BASE_URL}/users/restore_user.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: userToRestore.id }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message);
        fetchData(); // Refresh user list after restoring
      } else {
        toast.error(result.message || "Failed to restore user.");
      }
    } catch (error) {
      console.error("Error restoring user:", error);
      toast.error("Network error or server unavailable.");
    } finally {
      setShowRestoreConfirm(false);
      setUserToRestore(null);
    }
  };

  return (
    <SidebarProvider>
      <Toaster />
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />

        <div className="mt-4 w-full flex flex-col md:flex-row justify-between px-0 p-4 md:p-6 mb-4 space-y-3 md:space-y-0">
          <div className="flex space-x-2">
            <SearchArea
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="px-3 md:px-8">
          <UserTable heading={heading} data={usersData} role={null} onEdit={handleEditUser} onRestore={handleRestoreUser} />
        </div>

        <div className="w-full flex justify-end p-3 md:p-4 mb-5">
          <PaginationComponent
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>

        <Separator />
      
        {/* Edit Account Modal */}
        {userToEdit && (
          <EditAccountModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            userData={userToEdit}
            onAccountUpdated={fetchData}
          />
        )}

        {/* Restore Confirmation Dialog */}
        <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Restore User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to restore user "{userToRestore?.name}" ({userToRestore?.KLD_ID})?
                This action will mark the user as active, and they will reappear in the active user list.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowRestoreConfirm(false);
                setUserToRestore(null);
              }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRestoreUser}>Restore</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </SidebarProvider>
  );
};

export default ArchivedUsers;
