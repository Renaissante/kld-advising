"use client"
import { API_BASE_URL } from '@/config/api';
import { useState, useContext, useMemo } from "react" // Import useContext
import { useNavigate, useLocation } from "react-router-dom";
import {
  BookOpen,
  GraduationCap,
  Users,
  Calendar,
  Settings,
  ChevronRight,
  LayoutDashboard,
  ClipboardList,
  UserCog,
  Inbox,
  BookA,
  ListPlus,
  LogOut,
  Search,
  NotebookPen,
  Archive,
  Check,
  CalendarDays, // Import CalendarDays for the new component
  Bell,
  Layers
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
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AuthContext } from "@/contexts/AuthContext"; // Import AuthContext
import AdvisingPeriodManager from "@/pages/dean/AdvisingPeriodManager"; // Import the new component
import ExportAdvisingForms from "@/pages/dean/ExportAdvisingForms"; // Import the new component

export function AppSidebar() {
  const [activeItem, setActiveItem] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeRole, setActiveRole, logout } = useContext(AuthContext); // Use AuthContext
  
  const { state, setOpen } = useSidebar();

  // Handle logout using AuthContext's logout function
  const handleLogout = () => {
    logout(); // Call the logout function from AuthContext
  };

  const getRoleSpecificHomeUrl = (role) => {
    console.log("AppSidebar: getRoleSpecificHomeUrl for role:", role);
    switch (role) {
      case "admin": return "/admin/dashboard";
      case "faculty": return "/faculty/home";
      case "student": return "/student/home";
      case "programchair": return "/program-chair/home";
      case "dean": return "/dean/home";
      default: return "/login";
    }
  };

  const memoizedDashboardUrl = useMemo(() => getRoleSpecificHomeUrl(activeRole), [activeRole]);

  const items = [
    { title: "Dashboard", url: memoizedDashboardUrl, icon: LayoutDashboard, roles: ["admin", "dean", "programchair",] },
    { title: "Users", icon: Users, roles: ["admin"], subItems: [
      { title: "Active Users", url: "/admin/users/active-users", icon: Users },
      { title: "Archived Users", url: "/admin/users/archived-users", icon: Archive }
    ] },
    { title: "Academic Structure", url: "/admin/academic-structure", icon: Layers, roles: ["admin"] },
    { title: "Grades", url: "/faculty/grades", icon: BookA, roles: ["faculty"] },
    { title: "Advise", url: "/faculty/advise", basePath: "/faculty/credit-courses", icon: NotebookPen, roles: ["faculty"] },
    { title: "Manage Curriculum", url: "/program-chair/curriculum", icon: Inbox, roles: ["programchair"] },
    { title: "Advising Records", url: "/student/advising-records", icon: Archive, roles: ["student"] },
    { title: "Curriculum", url: "/student/curriculum", icon: Inbox, roles: ["student"] },
    { title: "Manage Faculty", url: "/program-chair/manage-faculty", basePath: "/program-chair/faculty-assignment", icon: ListPlus, roles: ["programchair"] },
    { title: "Manage Sections", url: "/program-chair/manage-sections", icon: Users, roles: ["programchair"] },
    { title: "Audit Logs", url: "/admin/audit-logs", icon: ClipboardList, roles: ["admin"] },
    { title: "Advising Period", url: "/dean/advising-period", icon: CalendarDays, roles: ["dean"] }, // New item for Dean
    { title: "Advising Forms", url: "/dean/advising-forms", icon: ClipboardList, roles: ["dean"] }, // New item for Dean
    { title: "Generate Reports", url: "/dean/generate-reports", icon: ClipboardList, roles: ["dean"] }, // New item for Dean Reports
    // { title: "Notifications", url: "/notifications", icon: Bell, roles: ["admin", "faculty", "student", "programchair", "dean"] }, // New item for all roles
  ];

  // Check if any subitem is active
  const isSubmenuActive = (item) => {
    if (!item.subItems) return false;
    return item.subItems.some(subItem => location.pathname === subItem.url);
  };

  const handleRoleSelectAndNavigate = (newRole) => {
    setActiveRole(newRole);
    localStorage.setItem("activeRole", JSON.stringify(newRole)); // Synchronously update localStorage
    navigate(getRoleSpecificHomeUrl(newRole));
  };

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
                  .filter((item) => item.roles.includes(activeRole)) // Filter by activeRole
                  .map((item) => {
                    const isActive = location.pathname === item.url || (item.basePath && location.pathname.startsWith(item.basePath));
                    const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(isSubmenuActive(item));
                    
                    return (
                      <SidebarMenuItem key={item.title}>
                        {item.subItems ? (
                          // Submenu logic
                          state === 'collapsed' ? (
                            // Collapsed state: Show dropdown with tooltip
                            <DropdownMenu>
                              <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton isActive={isActive}>
                                      <item.icon className="h-4 w-4" />
                                    </SidebarMenuButton>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="right" align="center">
                                  {item.title}
                                </TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent side="right" align="start" className="w-48">
                                <ul>
                                {item.subItems.map((subItem) => (
                                  <DropdownMenuItem 
                                    key={subItem.title} 
                                    onClick={() => navigate(subItem.url)}
                                  >
                                    <span>{subItem.title}</span>
                                  </DropdownMenuItem>
                                ))}
                                </ul>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            // Expanded state: Show collapsible
                            <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen}>
                              <CollapsibleTrigger asChild className="group">
                                <SidebarMenuButton isActive={isActive} className="w-full">
                                  <div className="flex items-center space-x-2 w-full text-left">
                                    <item.icon className="h-4 w-4" />
                                    <span>{item.title}</span>
                                  </div>
                                  <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                                </SidebarMenuButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="ml-4 border-l border-[#1a4027]">
                                <ul>
                                {item.subItems.map((subItem) => {
                                  const isSubItemActive = location.pathname === subItem.url;
                                  return (
                                    <SidebarMenuItem key={subItem.title}>
                                      <SidebarMenuButton asChild isActive={isSubItemActive} className="h-auto py-1 pl-4">
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            navigate(subItem.url);
                                          }}
                                          className="w-full text-left"
                                        >
                                          <span>{subItem.title}</span>
                                        </button>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  );
                                })}
                                </ul>
                              </CollapsibleContent>
                            </Collapsible>
                          )
                        ) : (
                          // Regular menu item logic
                          state === 'collapsed' ? (
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
                          )
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
                <AvatarFallback className="bg-[#1e5631] text-white rounded-md">{user?.email[0]?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <Avatar className="h-8 w-8 group-data-[collapsible=icon]:block hidden rounded-md">
                <AvatarFallback className="bg-[#1e5631] text-white rounded-md">{user?.email[0]?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <div
                className="flex flex-col items-start text-sm group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:hidden"
              >
                <span className="font-medium whitespace-nowrap capitalize">{activeRole || 'No Role'}</span>
                <span className="text-xs text-gray-400 whitespace-nowrap">{user?.email}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Active Role: {activeRole ? activeRole.charAt(0).toUpperCase() + activeRole.slice(1) : 'N/A'}</DropdownMenuLabel>
            {user?.roles.length > 1 && (
                <DropdownMenuSeparator />
            )}
            {user?.roles.length > 1 && user.roles.map((roleOption) => (
                activeRole !== roleOption && (
                    <DropdownMenuItem key={roleOption} onClick={() => handleRoleSelectAndNavigate(roleOption)} className="capitalize">
                        <UserCog className="mr-2 h-4 w-4" />
                        <span>Switch to {roleOption}</span>
                    </DropdownMenuItem>
                )
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}