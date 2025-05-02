import React, { useContext } from "react";
import { AuthContext } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";

const Header = ({ showSidebarTrigger = false, showNavLinks = true, showAuthButtons = true }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  return (
    <nav className="max-w-screen-xl mx-auto mb-6 flex items-center justify-between px-4 py-2 md:px-8 md:py-4 
      bg-white/80 dark:bg-[#121826]/80 shadow-lg backdrop-blur-md border border-gray-200 dark:border-gray-800 
      rounded-lg transition-all sticky top-4 z-10">
      
      <div className="flex items-center space-x-2 md:space-x-3">
        {showSidebarTrigger && <SidebarTrigger className="w-5 h-5 md:w-7 md:h-7" />}
        <h1 className="text-sm md:text-lg font-bold text-gray-900 dark:text-white tracking-wide">
          KLD ADVISING SYSTEM
        </h1>
      </div>

      {showNavLinks && !isAdmin && (
        <ul className="hidden md:flex space-x-4">
          {["Home", "About", "Contact"].map((item, index) => (
            <li key={index}>
              <Link
                to={`/${item.toLowerCase()}`}
                className="relative text-gray-700 dark:text-gray-300 text-xs md:text-base font-medium 
                hover:text-[#205c1c] dark:hover:text-[#5fd35f] transition-all group"
              >
                {item}
                <span className="absolute left-0 bottom-[-3px] w-0 h-[2px] bg-[#205c1c] dark:bg-[#5fd35f] 
                  transition-all duration-300 group-hover:w-full rounded-full" />
              </Link>
            </li>
          ))}
        </ul>
      )}

  
      <div className="flex items-center space-x-2 md:space-x-4">
        {showAuthButtons && !user && (
          <>
            <Button
              variant="outline"
              onClick={() => navigate("/login")}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 
              hover:border-[#205c1c] dark:hover:border-[#5fd35f] px-2 py-1 text-xs md:px-4 md:py-2 md:text-sm 
              rounded-md transition-all"
            >
              Sign In
            </Button>
            <Button
              onClick={() => navigate("/register")}
              variant="green"
            >
              Sign Up
            </Button>
          </>
        )}

      
        <ThemeToggle className="w-5 h-5 md:w-7 md:h-7 cursor-pointer" />
      </div>
    </nav>
  );
};

export default Header;
