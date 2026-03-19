async function testLogin() {
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    const data = await response.json();
    console.log('Login Status:', response.status);
    console.log('Login Result:', JSON.stringify(data, null, 2));
  } catch (error: any) {
    console.log('Login Error:', error.message);
  }
}

testLogin();
