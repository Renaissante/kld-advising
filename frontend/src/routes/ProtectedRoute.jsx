import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children, requiredRoles }) {
  const { user, activeRole } = useContext(AuthContext);

  // Helper function to get role-specific home URL
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

  // If user is not logged in, redirect to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user has multiple roles but no active role is set, redirect to role selection
  if (user.roles && user.roles.length > 1 && !activeRole) {
    return <Navigate to="/role-selection" replace />;
  }

  // If a single role user, or multi-role user with activeRole set, and it's not in the required roles
  // Note: requiredRoles can be a single string or an array of strings
  const isAuthorized = Array.isArray(requiredRoles)
    ? requiredRoles.includes(activeRole)
    : activeRole === requiredRoles;

  if (!isAuthorized) {
    // Redirect to the correct home page for the active role using the helper function
    return <Navigate to={getRoleSpecificHomeUrl(activeRole)} replace />;
  }

  return children;
}