import { useContext } from "react";
import { AuthContext } from "@/contexts/AuthContext"; // Adjust the path if needed

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
