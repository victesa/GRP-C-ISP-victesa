const express = require('express');
const { json, urlencoded } = require('body-parser');
const session = require('express-session');
const crypto = require("crypto");
const bcrypt = require('bcrypt');

const getUserIdFromSession = require('./middleware/userIdSession');
const userRoutes = require('./routes/userRoutes');
const db = require('./config/db');
const { createUser } = require('./models/userModels');
const { sendVerificationEmail } = require('./utils/sendEmailVerification');

const app = express();

const sessionStore = new session.MemoryStore();
const twoDaysMilliseconds = 172800000;

app.use(urlencoded({ extended: true }));
app.use(json());

app.use(session({
  key: 'user_sid',
  secret: 'your_secret_key',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: twoDaysMilliseconds,
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}));

// ===================== SIGN UP ===================== //
app.post('/signUp', (req, res) => {
  const userData = req.body;
  const { emailAddress, userPassword } = userData;
  const verifyEmailToken = crypto.randomBytes(32).toString('hex');
  const verifyEmailDeadline = new Date(Date.now() + 3600000);

  db.query("SELECT * FROM users WHERE email = ?", [emailAddress], (err, rows) => {
    if (err) {
      console.error("Error checking user existence:", err);
      return res.status(500).json({ errors: [{ msg: "Internal Server Error" }] });
    }

    if (rows.length > 0) {
      return res.status(400).json({ errors: [{ msg: "Email Address already exists", path: "emailAddress" }] });
    }

    // Hash the password
    bcrypt.hash(userPassword, 10, (hashErr, hashedPassword) => {
      if (hashErr) {
        console.error("Error hashing password:", hashErr);
        return res.status(500).json({ errors: [{ msg: "Internal Server Error" }] });
      }

      // Update userData with the hashed password
      userData.userPassword = hashedPassword;

      createUser(userData, verifyEmailToken, verifyEmailDeadline, (createErr, result) => {
        if (createErr) {
          console.error("Error creating user:", createErr);
          return res.status(500).json({ errors: [{ msg: "Internal Server Error" }] });
        }

        // Send email verification after user creation
        sendVerificationEmail(emailAddress, verifyEmailToken, res);

        res.status(200).json({ message: "User created successfully" });
      });
    });
  });
});

// ===================== AUTH ROUTES ===================== //
app.use('/auth', userRoutes);

// ===================== PROTECT ROUTE (GET) ===================== //
app.get('/protect', (req, res) => {
  if (req.session && req.session.authenticated) {
    const { userId, username, role } = req.session;
    res.json({ authenticated: true, userId, username, role });
  } else {
    res.status(401).json({ authenticated: false, message: 'Unauthorized' });
  }
});

// ===================== GET USER ID FROM SESSION ===================== //
app.get('/userId', (req, res) => {
  const userId = req.session.userId;
  res.json({ userId });
});

// ===================== LOGOUT ===================== //
app.post('/logOut', (req, res) => {
  req.session.authenticated = false;
  req.session.role = null;
  req.session.userId = null;

  res.status(200).json({ msg: "ok" });
});

// ===================== PROTECTED ROUTE (POST) ===================== //
app.post('/protectedRoute', (req, res) => {
  if (req.session && req.session.authenticated) {
    const { userId, username, role } = req.session;
    res.json({ authenticated: true, userId, username, role });
  } else {
    res.status(401).json({ authenticated: false, message: 'Unauthorized' });
  }
});

// ===================== DEBUG SESSION ===================== //
app.get('/w', (req, res) => {
  res.json(req.session);
});

// ===================== START SERVER ===================== //
const port = 5000;
app.listen(port, () => {
  console.log('Listening on port', port);
});
