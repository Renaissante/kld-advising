import { useState, useEffect, useCallback } from "react";  
import { SidebarProvider } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { CreateAccountModal } from "@/components/forms/CreateAccountModal";
import { UserTable } from "@/components/dashboard/UserTable";
import { SearchArea } from "@/components/shared/SearchArea";
import { PaginationComponent } from "@/components/shared/PaginationComponent";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

 
 

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        role: selectedRole,
        search: searchQuery,
        page: currentPage,
        pageSize,
      });

      const response = await fetch(
        `http://localhost/kld-advising/backend/api/users/get_user.php?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && Array.isArray(data.users)) {
        setUsersData(data.users);
        setTotalPages(data.totalPages || 1);
      } else {
        throw new Error("Invalid data structure from API");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUsersData([]);
      setTotalPages(1);
    }
  }, [selectedRole, searchQuery, currentPage, pageSize]); 

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
				
        <div className="mt-4 w-full flex flex-col md:flex-row justify-between px-0 p-4 md:p-6 mb-4 space-y-3 md:space-y-0">
          <div className="flex space-x-2">
            <CreateAccountModal onAccountCreated={fetchData} />
            <SearchArea
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="flex">
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

        
      </main>
    </SidebarProvider>
  );
};

export default ManageUsers;