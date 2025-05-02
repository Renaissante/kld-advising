import React from "react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ActiveProvider } from '@/contexts/ActiveContext';
import AppRoutes from "./routes/AppRoutes";




const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ActiveProvider>
          <AppRoutes />
        </ActiveProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
