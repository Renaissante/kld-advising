import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { API_BASE_URL } from '@/config/api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeClosed } from 'lucide-react';

const SetPasswordForm = () => {
  const { user, login, activeRole, setActiveRole, updateUser } = useAuth();
  const navigate = useNavigate();
  const { userId: urlUserId } = useParams(); // Get userId from URL parameters

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState(''); // New state for email
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const [tempPassword, setTempPassword] = useState(''); // New state for temporary password
  const [showTempPassword, setShowTempPassword] = useState(false); // State for temporary password visibility

  // When URL userId changes, update targetUserId
  // useEffect(() => {
  //   if (urlUserId) {
  //     setEmail(urlUserId); // Assuming urlUserId will be the email/KLD-ID for set password form
  //   }
  // }, [urlUserId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      setLoading(false);
      return;
    }

    // Determine the target user ID
    // If a userId is in the URL, use it. Otherwise, assume the email field contains the KLD-ID/Email.
    let targetUserId = urlUserId || email; // Use urlUserId if present, otherwise use the email from the form

    // For security, if userId is present in URL, we require it. If not, then email is mandatory.
    if (!targetUserId && !email) {
        setError('User ID (from URL) or Email is required.');
        setLoading(false);
        return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/set_password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: urlUserId, // Only send urlUserId if present, backend will prioritize
          email: email, // Always send email for verification/lookup
          temporaryPassword: tempPassword, // Send temporary password for verification
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        // Update the user context to reflect that the password has been set
        if (user) {
            updateUser({ password_set: true });
        }
        // Always redirect to login page after setting password
        navigate("/login");

      } else {
        setError(data.message || data.error || 'Failed to set password.');
      }
    } catch (err) {
      setError('Network error or server is unreachable.');
      console.error('Set password error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center pb-[200px]">
      <Card className="w-full max-w-[420px] shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold text-gray-800 dark:text-white">
            Set Your Password
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Please set a strong password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / KLD-ID input: Always show this field */}
            <div className="flex flex-col space-y-2">
              <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">
                KLD-ID / Email
              </Label>
              <Input 
                id="email" 
                type="text" // Changed to text to allow KLD-ID
                placeholder="Your KLD-ID or Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-md border-gray-300 focus:ring-[#205c1c] dark:bg-gray-800 dark:text-white"
                // disabled={!!urlUserId} // Disable if userId is present in URL
              />
            </div>

            {/* Temporary Password input: Always show this field */}
            <div className="flex flex-col space-y-2 relative">
              <Label htmlFor="tempPassword" className="text-gray-700 dark:text-gray-300">Temporary Password</Label>
              <div className="relative">
                <Input 
                  id="tempPassword" 
                  type={showTempPassword ? "text" : "password"} 
                  placeholder="Temporary Password"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  required
                  className="rounded-md border-gray-300 focus:ring-[#205c1c] dark:bg-gray-800 dark:text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowTempPassword(!showTempPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500 dark:text-gray-400 hover:text-[#205c1c]"
                  aria-label="Toggle temporary password visibility"
                >
                  {showTempPassword ? <EyeClosed size={25} /> : <Eye size={25} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col space-y-2 relative">
              <Label htmlFor="newPassword" className="text-gray-700 dark:text-gray-300">New Password</Label>
              <div className="relative">
                <Input 
                  id="newPassword" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="New Password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="rounded-md border-gray-300 focus:ring-[#205c1c] dark:bg-gray-800 dark:text-white pr-10"
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
            <div className="flex flex-col space-y-2 relative">
              <Label htmlFor="confirmPassword" className="text-gray-700 dark:text-gray-300">Confirm Password</Label>
              <div className="relative">
                <Input 
                  id="confirmPassword" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Confirm Password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="rounded-md border-gray-300 focus:ring-[#205c1c] dark:bg-gray-800 dark:text-white pr-10"
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
            {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
            {success && <p className="text-green-500 text-xs mt-2 text-center">Password set successfully!</p>}
          </form>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <Button
            type="submit" 
            onClick={handleSubmit}
            className="w-full px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-900"
            disabled={loading}
            size="lg"
            variant="green"
          >
            {loading ? 'Setting Password...' : 'Set Password'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SetPasswordForm;
