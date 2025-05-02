 import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";



const FacultyHome = () => {
  return (
    <SidebarProvider>
    <AppSidebar />
    <main className="w-full">
      <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
      
      
    </main>
  </SidebarProvider>
  )
}

export default FacultyHome