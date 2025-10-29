/**
 * ========================================
 * 🍪 Express + JWT Auth Example using Cookies
 * ========================================
 * This version stores the JWT in an HTTP cookie
 * instead of returning it in the response body.
 * 
 * Benefits:
 *   - Safer in browsers (cannot be read via JavaScript if httpOnly is true)
 *   - Convenient automatic inclusion with requests (if same-origin)
 * 
 * Requirements:
 *   npm install express jsonwebtoken body-parser cookie-parser
 * ========================================
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

const JWT_SECRET = 'vinay_jain//jnf'; // Use env var in real projects

// Dummy in-memory users
const users = [
  { id: 1, username: 'user1', password: 'pass1', role1: 'admin' },
  { id: 2, username: 'user2', password: 'pass2', role1: 'user' }
];

/**
 * ========================================
 * 🧩 Route: POST /login
 * ========================================
 * Validates credentials and sets JWT as a secure cookie.
 */
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Create a signed JWT
  const token = jwt.sign(
    { id: user.id, role: user.role1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Set the token as an HTTP-only cookie
  res.cookie('token', token, {
    httpOnly: true,   // prevents JS access (helps avoid XSS)
    secure: false,    // set to true in production (requires HTTPS)
    sameSite: 'strict', // restricts cross-site sending
    maxAge: 60 * 60 * 1000 // 1 hour
  });

  res.json({ message: 'Login successful. Token stored in cookie.' });
});

/**
 * ========================================
 * 🛡️ Middleware: authenticateJWT (Cookie-based)
 * ========================================
 * Reads JWT from cookie instead of Authorization header.
 */
const authenticateJWT = (req, res, next) => {
  const token = req.cookies.token; // Read from cookies

  if (!token) {
    return res.status(401).json({ message: 'Token missing (not logged in)' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // attach user data
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

/**
 * ========================================
 * 👤 Route: GET /profile
 * ========================================
 * Protected route — requires valid JWT in cookie.
 */
app.get('/profile', authenticateJWT, (req, res) => {
  res.json({ message: 'Profile data', user: req.user });
});

/**
 * ========================================
 * ⚙️ Route: GET /admin
 * ========================================
 * Protected route — only admin users can access.
 */
app.get('/admin', authenticateJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied (admin only)' });
  }
  res.json({ message: 'Admin data', user: req.user });
});

/**
 * ========================================
 * 🚪 Route: POST /logout
 * ========================================
 * Clears the authentication cookie.
 */
app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

/**
 * ========================================
 * 🚀 Start Server
 * ========================================
 */
app.listen(3000, () => {
  console.log('✅ Server running on port 3000 (cookie-based auth)');
});

/**
 * ========================================
 * 🧠 Summary / Notes:
 * ========================================
 * ▶ Login: 
 *    POST /login with { "username": "user1", "password": "pass1" }
 * ▶ After login, JWT is stored in a secure cookie (`token`).
 * ▶ Protected routes automatically read from cookies.
 * ▶ To log out, call POST /logout to clear the cookie.
 * ▶ Always use HTTPS + secure cookies in production.
 * 
 * Example workflow:
 *  1️⃣ Login to receive cookie
 *  2️⃣ Access /profile or /admin
 *  3️⃣ Logout clears the cookie
 * ========================================
 */
