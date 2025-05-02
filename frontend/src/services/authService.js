export async function loginUser(email, password) {
    const response = await fetch("http://localhost/kld-advising/backend/api/auth/login.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({email, password }),
    });
  
    const data = await response.json();
    return data;
  }
  