/**
 * ========================================
 * 🔐 JWT Authentication Example with Express
 * ========================================
 * This Node.js application demonstrates how to:
 *  - Use Express.js for server setup and routes
 *  - Authenticate users with JSON Web Tokens (JWT)
 *  - Protect routes using JWT verification middleware
 *  - Implement role-based access control (admin/user)
 *
 * Run:   node jwt.js
 * Test:  Use Postman or curl to login and access protected routes
 * ========================================
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();

// Parse incoming JSON request bodies
app.use(bodyParser.json());

// Secret key for JWT signing (keep it private in real projects — use environment variables)
const JWT_SECRET = 'vinay_jain//jnf';

// In-memory "user database"
const users = [
  { id: 1, username: 'user1', password: 'pass1', role1: 'admin' },
  { id: 2, username: 'user2', password: 'pass2', role1: 'user' }
];

/**
 * ========================================
 * 🧩 Route: POST /login
 * ========================================
 * Accepts username + password, verifies credentials, and returns a signed JWT.
 * The JWT includes the user ID and role and expires in 1 hour.
 */
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Find user matching username + password
  const user = users.find(u => u.username === username && u.password === password);

  // If no match, return Unauthorized
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Create JWT payload with id + role
  const token = jwt.sign(
    { id: user.id, role: user.role1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Send token to client
  res.json({ message: 'Login successful', token });
});

/**
 * ========================================
 * 🛡️ Middleware: authenticateJWT
 * ========================================
 * Verifies the JWT from the `Authorization` header.
 * Adds decoded user info to `req.user` if valid.
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Require the header: Authorization: Bearer <token>
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];

  // Require the actual token
  if (!token) {
    return res.status(401).json({ message: 'Token missing' });
  }

  try {
    // Verify and decode token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // attach decoded payload (id + role)
    next(); // continue to next handler
  } catch (err) {
    // Token expired or invalid
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

/**
 * ========================================
 * 👤 Route: GET /profile
 * ========================================
 * Protected route — requires valid JWT.
 * Returns the authenticated user’s info (from token).
 */
app.get('/profile', authenticateJWT, (req, res) => {
  res.json({ message: 'Profile data', user: req.user });
});

/**
 * ========================================
 * ⚙️ Route: GET /admin
 * ========================================
 * Protected route — requires valid JWT AND admin role.
 */
app.get('/admin', authenticateJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  res.json({ message: 'Admin data', user: req.user });
});

/**
 * ========================================
 * 🚀 Start Server
 * ========================================
 */
app.listen(3000, () => {
  console.log('✅ Server running on port 3000');
});

/**
 * ========================================
 * 🧠 Summary / Notes:
 * ========================================
 * ▶ This is a basic example — not production ready.
 * ▶ In production:
 *    - Use bcrypt to hash passwords
 *    - Store JWT_SECRET in environment variables
 *    - Use a database instead of in-memory users
 * ▶ JWTs are stateless — no need to store sessions on the server.
 * ▶ To test:
 *    1️⃣ POST /login with { "username": "user1", "password": "pass1" }
 *    2️⃣ Copy returned token
 *    3️⃣ Use Authorization header for other routes:
 *       Authorization: Bearer <your_token>
 * ========================================
 */
