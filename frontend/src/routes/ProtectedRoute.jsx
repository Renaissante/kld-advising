import { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children, role }) {
  const { user } = useContext(AuthContext);
  const [storedUser, setStoredUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    if (!user && storedUser) {
      setStoredUser(storedUser); 
    }
  }, [user, storedUser]);

  if (!storedUser) {
    return <Navigate to="/login" replace />;
  }

  if (storedUser.role !== role) {
    return <Navigate to={`/${storedUser.role}/home`} replace />;
  }

  return children;
}
