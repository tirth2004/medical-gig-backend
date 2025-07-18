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
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
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

// Protected admin routes (require authentication)
app.post("/admin/countries", authenticateToken, async (req, res) => {
  try {
    const { name, flag_image, body } = req.body;

    // Validate input
    if (!name || !flag_image || !body) {
      return res.status(400).json({
        error: "Name, flag_image, and body are required",
      });
    }

    // Check if country already exists
    const existingCountryResult = await db.query(
      "SELECT name FROM countries WHERE name = $1",
      [name]
    );

    if (existingCountryResult.rows.length > 0) {
      return res.status(400).json({
        error: "Country with this name already exists",
      });
    }

    // Insert into database
    const insertResult = await db.query(
      "INSERT INTO countries (name, flag_image, body) VALUES ($1, $2, $3) RETURNING id, name, flag_image, created_at",
      [name, flag_image, body]
    );

    const data = insertResult.rows[0];

    res.status(201).json({
      message: "Country created successfully",
      country: data,
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// Add college (admin route)
app.post("/admin/colleges", authenticateToken, async (req, res) => {
  try {
    const {
      name,
      country,
      state,
      year_of_establishment,
      logo_link,
      intake,
      duration,
      recognition,
      medium,
      intro,
      course_fees,
      admission_eligibility,
      benefits,
      campus_info,
    } = req.body;

    // Validate required fields
    if (!name || !country || !state || !year_of_establishment) {
      return res.status(400).json({
        error: "name, country, state, and year_of_establishment are required",
      });
    }

    // Check if country exists
    const countryResult = await db.query(
      "SELECT name FROM countries WHERE name = $1",
      [country]
    );
    if (countryResult.rows.length === 0) {
      return res.status(400).json({ error: "Country does not exist" });
    }

    // Check if college with same name and country exists
    const duplicateCheck = await db.query(
      "SELECT id FROM colleges WHERE name = $1 AND country = $2",
      [name, country]
    );
    if (duplicateCheck.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "College with this name and country already exists" });
    }
    // Insert college
    const insertResult = await db.query(
      `INSERT INTO colleges
        (name, country, state, year_of_establishment, logo_link, intake, duration, recognition, medium, intro, course_fees, admission_eligibility, benefits, campus_info)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        name,
        country,
        state,
        year_of_establishment,
        logo_link,
        intake,
        duration,
        recognition,
        medium,
        intro,
        course_fees,
        admission_eligibility,
        benefits,
        campus_info,
      ]
    );
    res.status(201).json({
      message: "College added successfully",
      college: insertResult.rows[0],
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all countries (public route)
app.get("/countries", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, flag_image, created_at FROM countries ORDER BY name"
    );

    res.json({
      countries: result.rows,
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// Get country by ID (public route)
app.get("/countries/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "SELECT id, name, flag_image, body, created_at, updated_at FROM countries WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Country not found",
      });
    }

    res.json({
      country: result.rows[0],
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// View all colleges (public route)
app.get("/colleges", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, logo_link, name, country, state, intake, year_of_establishment, recognition, duration, medium FROM colleges ORDER BY name`
    );
    res.json({ colleges: result.rows });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// View college by id (public route)
app.get("/colleges/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`SELECT * FROM colleges WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "College not found" });
    }
    res.json({ college: result.rows[0] });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}`);
});
