import React, { createContext, useState, useEffect, useContext } from "react"; // Import useContext
import { loginUser } from "@/services/authService";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // New state for active role
  const [activeRole, setActiveRole] = useState(() => {
    const storedActiveRole = localStorage.getItem("activeRole");
    return storedActiveRole ? JSON.parse(storedActiveRole) : null;
  });

  // Effect to update localStorage when activeRole changes
  useEffect(() => {
    if (activeRole !== null) {
      localStorage.setItem("activeRole", JSON.stringify(activeRole));
    } else {
      localStorage.removeItem("activeRole");
    }
  }, [activeRole]);

  // Effect to update localStorage when user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  const login = async ({ email, password }) => {
    const data = await loginUser(email, password);

    if (data.success) {
      const userData = {
        id: data.id,
        email: data.email,
        roles: data.roles, // Now an array of roles
        employee_id: data.employee_id,
        student_id: data.student_id
      };
      setUser(userData);
      // localStorage.setItem("user", JSON.stringify(userData)); // Removed, now handled by useEffect above

      // Handle active role selection
      if (data.roles && data.roles.length > 0) {
        if (data.roles.length === 1) {
          // Only one role, set it as active and navigate
          const singleRole = data.roles[0];
          setActiveRole(singleRole); // Set active role
          // localStorage.setItem("activeRole", JSON.stringify(singleRole)); // Removed, now handled by useEffect above
          // Adjust navigation based on single role to specific dashboards
          switch (singleRole) {
            case "admin":
              navigate("/admin/dashboard");
              break;
            case "student":
              navigate("/student/home");
              break;
            case "faculty":
              navigate("/faculty/home");
              break;
            case "programchair":
              navigate("/program-chair/home");
              break;
            case "dean":
              navigate("/dean/home");
              break;
            case "advisor":
              navigate("/faculty/home");
              break;
            default:
              navigate("/login");
          }
        } else {
          // Multiple roles, store roles and navigate to a role selection page
          // Do not set activeRole or store it in localStorage here.
          // activeRole will be null, and RoleSelectionPage will handle setting it.
          setActiveRole(null);
          navigate("/role-selection");
        }
      } else {
        // No roles, something is wrong or a guest user
        setActiveRole(null);
        // localStorage.removeItem("activeRole"); // Removed, now handled by useEffect above
        navigate("/login");
      }
      localStorage.setItem("studentId", data.student_id); // studentId still relevant

    } else {
      alert("Login failed: " + (data.error || "Unknown error"));
    }
  };

  const logout = () => {
    setUser(null);
    setActiveRole(null); // Clear active role on logout
    // localStorage.removeItem("user"); // Removed, now handled by useEffect above
    // localStorage.removeItem("activeRole"); // Removed, now handled by useEffect above
    localStorage.removeItem("studentId");
    console.log("AuthContext: User logged out"); // LOG
    navigate("/login");
  };

  const hasRole = (roleName) => {
    return activeRole === roleName;
  };

  const hasAnyRole = (roleNames) => {
    return activeRole && roleNames.includes(activeRole);
  };

  const hasMultipleRoles = () => {
    return user && user.roles && user.roles.length > 1;
  };

  return (
    <AuthContext.Provider value={{ user, activeRole, setActiveRole, login, logout, hasRole, hasAnyRole, hasMultipleRoles }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};