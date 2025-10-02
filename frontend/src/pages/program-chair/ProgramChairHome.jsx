import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import React, { useContext } from "react"; // Import React and useContext
import { AuthContext } from "@/contexts/AuthContext"; // Import AuthContext

const ProgramChairHome = () => {
  const { user, activeRole } = useContext(AuthContext); // Access user and activeRole

  console.log("ProgramChairHome: Component rendered."); // LOG
  console.log("ProgramChairHome: User", user); // LOG
  console.log("ProgramChairHome: activeRole", activeRole); // LOG

  return (
    <SidebarProvider>
    <AppSidebar />
    <main className="w-full">
      <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
      
      
    </main>
  </SidebarProvider>
  )
}

export default ProgramChairHome