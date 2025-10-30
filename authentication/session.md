# Session-Based Authentication

## Overview
Session-based authentication is a stateful method where the server keeps session data after a user logs in. The server issues a session ID which is stored in a browser cookie. On each request the cookie is sent automatically and the server looks up the corresponding session to authenticate the user.

---

## How it works
1. User submits credentials to the server (login).
2. Server verifies credentials and creates a session object (e.g., user info, timestamps).
3. Server generates a unique, random session ID and stores the session in a session store.
4. Server sends the session ID to the client in a cookie.
5. For subsequent requests, the browser sends the cookie automatically.
6. Server verifies the cookie (signature) and retrieves the session from the store.
7. If session exists and is valid → user is authenticated. If not → user must log in.

---

## Example (Express.js)

```js
import express from "express";
import session from "express-session";

const app = express();

app.use(
  session({
    secret: "supersecretkey",        // signs the session ID cookie
    resave: false,                   // don't save session if unmodified
    saveUninitialized: false,        // don't save empty sessions
    cookie: {
      secure: false,                 // set true in production (HTTPS)
      httpOnly: true,                // JS can't access cookie
      sameSite: "lax",               // helps prevent CSRF
      maxAge: 1000 * 60 * 30         // 30 minutes
    }
  })
);
```

---

## Key configuration options

| Option | Purpose |
|--------|---------|
| secret | Used to sign and verify session ID cookies (prevents tampering). |
| resave | Avoids re-saving sessions that haven't changed. |
| saveUninitialized | Avoids storing empty sessions before login. |
| cookie.secure | Ensures cookies are only sent over HTTPS. |
| cookie.httpOnly | Protects against XSS by preventing JS access to the cookie. |
| cookie.sameSite | Helps mitigate CSRF attacks. |
| cookie.maxAge | How long the cookie/session lasts (ms). |

---

## Session storage
By default many frameworks use in-memory session storage (not suitable for production). For scalable production deployments use an external session store:

- Redis (connect-redis)
- MongoDB (connect-mongo)
- MySQL/Postgres (express-mysql-session)

Stored example (Redis):
```json
Key: sess:a9f04b87e51c74e2d8c123ad9c8e12ef
Value: {"cookie": {...}, "user": {"id": 1, "username": "admin"}}
```

---

## Validation process
- Browser sends the session cookie (e.g., connect.sid).
- Server verifies the cookie signature using the configured secret.
- Server queries the session store using the session ID.
- If session exists and has not expired → user is authenticated.
- If no session is found or it is expired → request re-authentication.

---

## Expiration & logout
- Sessions expire according to cookie.maxAge or the store's TTL.
- On logout, destroy the session server-side:

```js
req.session.destroy(err => {
  if (err) {
    // handle error
  }
  // clear cookie or redirect
});
```

---

## Pros and cons

| Pros | Cons |
|------|------|
| Simple to implement and secure when configured correctly. | Server must maintain session state (stateful). |
| Easy to invalidate sessions (logout or revoke). | Harder to scale horizontally without a shared store. |
| Natural fit for browser-based web apps using cookies and forms. | Requires correct cookie configuration to be secure. |

---

## Quick recap
- A session ID is a random identifier referencing server-side session data.
- The cookie contains only the session ID (not user data), making it safer than storing user info in the cookie.
- Session-based auth works well for traditional web applications where cookies and server-side state are acceptable.
