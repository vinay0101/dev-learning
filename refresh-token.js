/**
 * ========================================
 * 🔐 Express JWT Auth with Access + Refresh Tokens
 * ========================================
 * - Short-lived access token for authorization
 * - Long-lived refresh token to issue new access tokens
 * ========================================
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

const JWT_ACCESS_SECRET = 'access_secret_vinay';
const JWT_REFRESH_SECRET = 'refresh_secret_vinay';

// Simulated user DB
const users = [
  { id: 1, username: 'user1', password: 'pass1', role: 'admin' },
  { id: 2, username: 'user2', password: 'pass2', role: 'user' }
];

// Store valid refresh tokens (in production, store in DB or Redis)
let refreshTokens = [];

/**
 * ========================================
 * 🧩 Route: POST /login
 * ========================================
 * 1. Validates credentials
 * 2. Generates both access and refresh tokens
 * 3. Sends refresh token as cookie and access token in body
 */
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  // Create access + refresh tokens
  const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    JWT_ACCESS_SECRET,
    { expiresIn: '15m' } // short life
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' } // long life
  );

  // Save refresh token
  refreshTokens.push(refreshToken);

  // Send refresh token in httpOnly cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: false, // set true in production (HTTPS)
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({
    message: 'Login successful',
    accessToken
  });
});

/**
 * ========================================
 * 🛡️ Middleware: authenticateAccessToken
 * ========================================
 * Protects routes by verifying the access token
 */
const authenticateAccessToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Missing Authorization header' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });

  jwt.verify(token, JWT_ACCESS_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

/**
 * ========================================
 * 🔄 Route: POST /refresh
 * ========================================
 * Uses refresh token to issue a new access token
 */
app.post('/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ message: 'Refresh token missing' });

  if (!refreshTokens.includes(refreshToken)) {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }

  jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired refresh token' });

    // Generate new access token
    const newAccessToken = jwt.sign(
      { id: user.id, role: user.role },
      JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken: newAccessToken });
  });
});

/**
 * ========================================
 * 🚪 Route: POST /logout
 * ========================================
 * Invalidates the refresh token
 */
app.post('/logout', (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  refreshTokens = refreshTokens.filter(token => token !== refreshToken);
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

/**
 * ========================================
 * 👤 Protected Route: GET /profile
 * ========================================
 * Example protected endpoint using access token
 */
app.get('/profile', authenticateAccessToken, (req, res) => {
  res.json({ message: 'Protected profile data', user: req.user });
});

/**
 * ========================================
 * ⚙️ Admin Route: GET /admin
 * ========================================
 */
app.get('/admin', authenticateAccessToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
  res.json({ message: 'Admin data access granted', user: req.user });
});

/**
 * ========================================
 * 🚀 Start Server
 * ========================================
 */
app.listen(3000, () => {
  console.log('✅ Server running on port 3000 (Access + Refresh tokens)');
});

/**
 * ========================================
 * 🧠 Summary / Notes
 * ========================================
 * ▶ Login:
 *    POST /login  → returns access token + sets refresh token cookie
 * ▶ Access protected route:
 *    Use `Authorization: Bearer <access_token>`
 * ▶ When access token expires:
 *    POST /refresh  → returns new access token using refresh token cookie
 * ▶ Logout:
 *    POST /logout  → clears refresh token + cookie
 * 
 * ⚠️ In Production:
 *   - Store refresh tokens in DB (not memory)
 *   - Add rotation (new refresh token each refresh)
 *   - Set secure: true and use HTTPS
 * ========================================
 */
