import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "@/components/forms/LoginForm";
import { AuthContext } from "@/contexts/AuthContext";
import Header from "@/components/layout/Header";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useContext(AuthContext); 
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await login({ email, password });
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  return (
    <>
      <Header/>
    
        <div className="flex min-h-screen items-center justify-center pb-[200px]">
          <LoginForm
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            handleLogin={handleLogin}
          />
        </div>
    </>

    
  );
}
