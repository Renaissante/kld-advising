import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Header from "@/components/layout/Header";

export default function RoleSelectionPage() {
  const { user, setActiveRole } = useContext(AuthContext);
  const navigate = useNavigate();

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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
              Choose Your Role
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              You have multiple roles. Please select one to proceed.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {user.roles.map((role) => (
              <Card key={role} className="w-full max-w-sm mx-auto text-center">
                <CardHeader>
                  <CardTitle className="capitalize">{role}</CardTitle>
                  <CardDescription>Click to login as {role}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => handleRoleSelect(role)} className="w-full capitalize">
                    Continue as {role}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
