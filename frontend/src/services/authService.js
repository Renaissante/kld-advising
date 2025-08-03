import { API_BASE_URL } from '@/config/api'; 
export async function loginUser(email, password) {
  
    const response = await fetch(`${API_BASE_URL}/auth/login.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({email, password }),
    });
  
    const data = await response.json();
    return data;
  }
  