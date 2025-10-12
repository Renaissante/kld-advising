import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Header from "@/components/layout/Header";
import { UserCircle, GraduationCap, BookOpen, Users, Shield, Briefcase } from "lucide-react"; // Updated Lucide React imports

export default function RoleSelectionPage() {
  const { user, setActiveRole } = useContext(AuthContext);
  const navigate = useNavigate();

  // Debugging: Log the user object to see its structure
  console.log("User object in RoleSelectionPage:", user);

  // Helper to get role-specific home URL (similar to AppSidebar)
  const getRoleSpecificHomeUrl = (role) => {
    console.log("RoleSelectionPage: getRoleSpecificHomeUrl for role:", role);
    switch (role) {
      case "admin": return "/admin/dashboard";
      case "faculty": return "/faculty/home";
      case "student": return "/student/home";
      case "programchair": return "/program-chair/home";
      case "dean": return "/dean/home";
      case "advisor": return "/faculty/home"; // Advisors typically share faculty dashboard
      default: return "/login";
    }
  };

  // Role configuration with icons and colors
  const roleConfig = {
    admin: {
      icon: <Shield className="w-8 h-8" />,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-900/30",
      description: "Manage system settings and users",
    },
    faculty: {
      icon: <Briefcase className="w-8 h-8" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/30",
      description: "Access teaching and advising tools",
    },
    student: {
      icon: <GraduationCap className="w-8 h-8" />,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/30",
      description: "View courses and advising information",
    },
    programchair: {
      icon: <Users className="w-8 h-8" />,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/30",
      description: "Manage program curriculum and faculty",
    },
    dean: {
      icon: <BookOpen className="w-8 h-8" />,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-900/30",
      description: "Oversee academic operations",
    },
    advisor: {
      icon: <UserCircle className="w-8 h-8" />,
      color: "text-teal-600",
      bgColor: "bg-teal-50 dark:bg-teal-900/30",
      description: "Guide students through their academic journey",
    },
  };

  const handleRoleSelect = (role) => {
    setActiveRole(role);
    // Store activeRole in localStorage immediately after selection
    localStorage.setItem("activeRole", JSON.stringify(role));
    navigate(getRoleSpecificHomeUrl(role));
  };

  // Render nothing if user is not logged in or has no roles (AuthContext already redirects them)
  // or if user only has one role (AuthContext already redirects them).
  // This component should only be reached if user is logged in and has >1 roles.
  if (!user || !user.roles || user.roles.length <= 1) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen flex items-top justify-center pt-10">
        <div className="max-w-4xl w-full space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Welcome back</h1>
            <p className="text-gray-600 dark:text-gray-400">Select a role to continue to your dashboard</p>
          </div>

          {/* Role Cards */}
          <div
            className={`grid gap-4 ${
              user.roles.length === 1
                ? "grid-cols-1 justify-items-center"
                : user.roles.length === 2
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {user.roles.map((role) => {
              const config = roleConfig[role] || {
                icon: <UserCircle className="w-8 h-8" />,
                color: "text-gray-600 dark:text-gray-400",
                bgColor: "bg-gray-50 dark:bg-gray-800",
                description: "Access your dashboard",
              };

              return (
                <Card
                  key={role}
                  className={`bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group dark:bg-gray-950 dark:border-gray-800 ${user.roles.length === 1 ? "max-w-sm w-full" : "w-full"} min-h-[220px] flex flex-col justify-between`}
                  onClick={() => handleRoleSelect(role)}
                >
                  <CardContent className="p-8 space-y-6 flex-grow flex flex-col justify-center items-center">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className={`p-4 rounded-lg ${config.bgColor} group-hover:scale-110 transition-transform`}>
                        <div className={config.color}>{config.icon}</div>
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-50 capitalize">
                          {role === "programchair" ? "Program Chair" : role}
                        </CardTitle>
                        <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                          {config.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-50">
                      Continue as {role === "programchair" ? "Program Chair" : role}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Footer Info */}
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">You can switch roles anytime from your dashboard settings</p>
          </div>
        </div>
      </div>
    </>
  );
}
