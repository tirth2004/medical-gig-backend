const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const db = require("./config/supabase");

const app = express();
const PORT = process.env.PORT || 3000;

// JWT verification middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Middleware
app.use(cors());
app.use(express.json());

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Medical Website Backend API" });
});

// Admin routes
app.post("/admin/admins", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        error: "Username and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    // Check if admin already exists
    const existingAdminResult = await db.query(
      "SELECT username FROM admins WHERE username = $1",
      [username]
    );

    if (existingAdminResult.rows.length > 0) {
      return res.status(400).json({
        error: "Admin with this username already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into database
    const insertResult = await db.query(
      "INSERT INTO admins (username, password) VALUES ($1, $2) RETURNING id, username, created_at",
      [username, hashedPassword]
    );

    const data = insertResult.rows[0];

    res.status(201).json({
      message: "Admin created successfully",
      admin: data[0],
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// Admin signin route
app.post("/admin/signin", async (req, res) => {
  try {
    const { username, password } = req.body;
    // console.log("Request body:", req.body);
    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        error: "Username and password are required",
      });
    }

    // Find admin by username
    const result = await db.query(
      "SELECT id, username, password FROM admins WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    const admin = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);

    if (!isValidPassword) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Signin successful",
      token,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}`);
});
