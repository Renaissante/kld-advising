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

  const login = async ({ email, password }) => {
    const data = await loginUser(email, password);

    if (data.success) {
      const userData = {
        id: data.id,
        email: data.email,
        role: data.role,
        employee_id: data.employee_id,
        student_id: data.student_id
      };
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      localStorage.setItem("studentId", data.student_id);

      switch (data.role) {
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
        default:
          navigate("/login");
      }
    } else {
      alert("Login failed: " + (data.error || "Unknown error"));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("studentId");
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// ADDED: Export the useAuth hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};