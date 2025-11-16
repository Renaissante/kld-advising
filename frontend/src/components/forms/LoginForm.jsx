import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeClosed } from "lucide-react"; 

export default function LoginForm({ email, setEmail, password, setPassword, handleLogin }) {
  const [showPassword, setShowPassword] = useState(false); 

  return (
    <Card className="w-full max-w-[420px] shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold text-gray-800 dark:text-white">
          Welcome Back
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Sign in to your account to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
         
          <div className="flex flex-col space-y-2">
            <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">
              KLD-ID / Email
            </Label>
            <Input
              id="email"
              type="text" // Changed from "email" to "text" to allow KLD-ID
              placeholder="Enter your KLD-ID or email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border-gray-300 focus:ring-[#205c1c] dark:bg-gray-800 dark:text-white"
              aria-label="KLD-ID or Email Address"
            />
          </div>

        
          <div className="flex flex-col space-y-2 relative">
            <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"} 
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-md border-gray-300 focus:ring-[#205c1c] dark:bg-gray-800 dark:text-white pr-10"
                aria-label="Password"
              />
            
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 dark:text-gray-400 hover:text-[#205c1c]"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeClosed size={25} /> : <Eye size={25} />}
              </button>
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <Button
          size="lg"
          variant="green"
          onClick={handleLogin}
        >
          Login
        </Button>
        <Button variant="link">
          Forgot Password?
        </Button>
      </CardFooter>
    </Card>
  );
}
