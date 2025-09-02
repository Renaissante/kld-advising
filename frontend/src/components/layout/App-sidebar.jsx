"use client"
import { API_BASE_URL } from '@/config/api';
import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom";
import {
  BookOpen,
  GraduationCap,
  Users,
  Calendar,
  Settings,
  ChevronDown,
  LayoutDashboard,
  ClipboardList,
  UserCog,
  Inbox,
  BookA,
  ListPlus,
  LogOut,
  Search,
  NotebookPen,
  Archive
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function AppSidebar() {
  const [activeItem, setActiveItem] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user"));
  const role = user?.role;
  const { state, setOpen } = useSidebar();

  const handleLogout = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout.php`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      localStorage.removeItem("user");
      localStorage.removeItem("sidebarOpen");
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const getRoleSpecificHomeUrl = (role) => {
    switch (role) {
      case "admin": return "/admin/dashboard";
      case "faculty": return "/faculty/home";
      case "student": return "/student/home";
      case "programchair": return "/program-chair/home";
      case "dean": return "/dean/home";
      default: return "/login";
    }
  };


  const items = [
    { title: "Dashboard", url: getRoleSpecificHomeUrl(role), icon: LayoutDashboard, roles: ["admin", "faculty", "student", "dean", "programchair"] },
    { title: "Users", url: "/admin/users", icon: Users, roles: ["admin"] },
    { title: "Curriculum Data", url: "/admin/curriculum", icon: Inbox, roles: ["admin"] },
    { title: "Grades", url: "/faculty/grades", icon: BookA, roles: ["faculty"] },
    { title: "Advise", url: "/faculty/advise", icon: NotebookPen, roles: ["faculty"] },
    { title: "Manage Curriculum", url: "/program-chair/curriculum", icon: Inbox, roles: ["programchair"] },
    { title: "Advising Records", url: "/student/advising-records", icon: Archive, roles: ["student"] },
    { title: "Curriculum", url: "/student/curriculum", icon: Inbox, roles: ["student"] },
    { title: "Manage Faculty", url: "/program-chair/manage-faculty", icon: ListPlus, roles: ["programchair"] },
    { title: "Manage Sections", url: "/program-chair/manage-sections", icon: Users, roles: ["programchair"] },
    { title: "Audit Trail", url: "/admin/audit-trail", icon: ClipboardList, roles: ["admin"] },
    { title: "Calendar", url: "", icon: Calendar, roles: ["admin", "faculty", "student", "dean", "programchair"] },
  ];


  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-[#1a4027]">
        <div
          className="flex items-center gap-2 px-2 py-3 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:hidden overflow-hidden"
        >
          <GraduationCap className="h-6 w-6 text-white" />
          <div className="font-semibold text-lg text-white whitespace-nowrap">KLD Advising System</div>
        </div>
        <div className="group-data-[collapsible=icon]:block hidden px-1 py-3">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            User
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider>
              {items
                  .filter((item) => item.roles.includes(role))
                  .map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        {state === 'collapsed' ? (
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <SidebarMenuButton asChild isActive={isActive}>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (item.onClick) {
                                      item.onClick();
                                    } else if (item.url) {
                                      navigate(item.url);
                                    }
                                  }}
                                  className="flex items-center space-x-2 w-full text-left"
                                  disabled={!item.url && !item.onClick}
                                >
                                  <item.icon className="h-4 w-4" />
                                </button>
                              </SidebarMenuButton>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center">
                              {item.title}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <SidebarMenuButton asChild isActive={isActive}>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                if (item.onClick) {
                                  item.onClick();
                                } else if (item.url) {
                                  navigate(item.url);
                                }
                              }}
                              className="flex items-center space-x-2 w-full text-left"
                              disabled={!item.url && !item.onClick}
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </button>
                          </SidebarMenuButton>
                        )}
                      </SidebarMenuItem>
                    )
                  })}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-[#1a4027]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start px-0 text-gray-300 hover:bg-[#1a4027] hover:text-white overflow-hidden gap-2"
            >
              <Avatar className="h-8 w-8 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:hidden rounded-md">
                <AvatarImage src="/placeholder.svg?height=32&width=32" />
                <AvatarFallback className="bg-[#1e5631] text-white rounded-md">PC</AvatarFallback>
              </Avatar>
              <Avatar className="h-8 w-8 group-data-[collapsible=icon]:block hidden rounded-md">
                <AvatarFallback className="bg-[#1e5631] text-white rounded-md">PC</AvatarFallback>
              </Avatar>
              <div
                className="flex flex-col items-start text-sm group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:hidden"
              >
                <span className="font-medium whitespace-nowrap">Program Chair</span>
                <span className="text-xs text-gray-400 whitespace-nowrap">admin@example.edu</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
