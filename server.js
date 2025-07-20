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
    origin: "*",
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

// Update country (admin route)
app.put("/admin/countries/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, flag_image, body } = req.body;

    // Validate input
    if (!name || !flag_image || !body) {
      return res.status(400).json({
        error: "Name, flag_image, and body are required",
      });
    }

    // Check if country exists
    const existingCountry = await db.query(
      "SELECT id FROM countries WHERE id = $1",
      [id]
    );
    if (existingCountry.rows.length === 0) {
      return res.status(404).json({ error: "Country not found" });
    }

    // Check if new name conflicts with another country
    const nameConflict = await db.query(
      "SELECT id FROM countries WHERE name = $1 AND id != $2",
      [name, id]
    );
    if (nameConflict.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Country with this name already exists" });
    }

    // Update country
    const updateResult = await db.query(
      "UPDATE countries SET name = $1, flag_image = $2, body = $3, updated_at = now() WHERE id = $4 RETURNING *",
      [name, flag_image, body, id]
    );

    res.json({
      message: "Country updated successfully",
      country: updateResult.rows[0],
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete country (admin route)
app.delete("/admin/countries/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if country exists
    const existingCountry = await db.query(
      "SELECT id FROM countries WHERE id = $1",
      [id]
    );
    if (existingCountry.rows.length === 0) {
      return res.status(404).json({ error: "Country not found" });
    }

    // Check if any colleges reference this country
    const collegesUsingCountry = await db.query(
      "SELECT id FROM colleges WHERE country = (SELECT name FROM countries WHERE id = $1)",
      [id]
    );
    if (collegesUsingCountry.rows.length > 0) {
      return res.status(400).json({
        error:
          "Cannot delete country. There are colleges associated with this country.",
      });
    }

    // Delete country
    await db.query("DELETE FROM countries WHERE id = $1", [id]);

    res.json({ message: "Country deleted successfully" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
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

// Update college (admin route)
app.put("/admin/colleges/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
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

    // Check if college exists
    const existingCollege = await db.query(
      "SELECT id FROM colleges WHERE id = $1",
      [id]
    );
    if (existingCollege.rows.length === 0) {
      return res.status(404).json({ error: "College not found" });
    }

    // Check if country exists
    const countryResult = await db.query(
      "SELECT name FROM countries WHERE name = $1",
      [country]
    );
    if (countryResult.rows.length === 0) {
      return res.status(400).json({ error: "Country does not exist" });
    }

    // Check if new name and country combination conflicts with another college
    const nameConflict = await db.query(
      "SELECT id FROM colleges WHERE name = $1 AND country = $2 AND id != $3",
      [name, country, id]
    );
    if (nameConflict.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "College with this name and country already exists" });
    }

    // Update college
    const updateResult = await db.query(
      `UPDATE colleges SET 
        name = $1, country = $2, state = $3, year_of_establishment = $4, 
        logo_link = $5, intake = $6, duration = $7, recognition = $8, 
        medium = $9, intro = $10, course_fees = $11, admission_eligibility = $12, 
        benefits = $13, campus_info = $14
       WHERE id = $15 RETURNING *`,
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
        id,
      ]
    );

    res.json({
      message: "College updated successfully",
      college: updateResult.rows[0],
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete college (admin route)
app.delete("/admin/colleges/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if college exists
    const existingCollege = await db.query(
      "SELECT id FROM colleges WHERE id = $1",
      [id]
    );
    if (existingCollege.rows.length === 0) {
      return res.status(404).json({ error: "College not found" });
    }

    // Delete college
    await db.query("DELETE FROM colleges WHERE id = $1", [id]);

    res.json({ message: "College deleted successfully" });
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

// Blog routes
// Get all blogs (public route)
app.get("/blogs", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, title, author, image_url, created_at FROM blogs ORDER BY created_at DESC"
    );
    res.json({ blogs: result.rows });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get blog by ID (public route)
app.get("/blogs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM blogs WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Blog not found" });
    }
    res.json({ blog: result.rows[0] });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add blog (admin route)
app.post("/admin/blogs", authenticateToken, async (req, res) => {
  try {
    const { title, content, author, image_url } = req.body;

    // Validate required fields
    if (!title || !content || !author) {
      return res.status(400).json({
        error: "Title, content, and author are required",
      });
    }

    // Insert blog
    const insertResult = await db.query(
      "INSERT INTO blogs (title, content, author, image_url) VALUES ($1, $2, $3, $4) RETURNING *",
      [title, content, author, image_url]
    );

    res.status(201).json({
      message: "Blog created successfully",
      blog: insertResult.rows[0],
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update blog (admin route)
app.put("/admin/blogs/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, author, image_url } = req.body;

    // Validate required fields
    if (!title || !content || !author) {
      return res.status(400).json({
        error: "Title, content, and author are required",
      });
    }

    // Check if blog exists
    const existingBlog = await db.query("SELECT id FROM blogs WHERE id = $1", [
      id,
    ]);
    if (existingBlog.rows.length === 0) {
      return res.status(404).json({ error: "Blog not found" });
    }

    // Update blog
    const updateResult = await db.query(
      "UPDATE blogs SET title = $1, content = $2, author = $3, image_url = $4, updated_at = now() WHERE id = $5 RETURNING *",
      [title, content, author, image_url, id]
    );

    res.json({
      message: "Blog updated successfully",
      blog: updateResult.rows[0],
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete blog (admin route)
app.delete("/admin/blogs/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if blog exists
    const existingBlog = await db.query("SELECT id FROM blogs WHERE id = $1", [
      id,
    ]);
    if (existingBlog.rows.length === 0) {
      return res.status(404).json({ error: "Blog not found" });
    }

    // Delete blog
    await db.query("DELETE FROM blogs WHERE id = $1", [id]);

    res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Customer routes
// Add customer interest (public route)
app.post("/customers", async (req, res) => {
  try {
    const {
      name,
      phone_number,
      email_address,
      country,
      state,
      college_of_interest,
    } = req.body;

    // Validate required fields
    if (!name || !phone_number) {
      return res.status(400).json({
        error: "Name and phone number are required",
      });
    }

    // Basic phone number validation (you can enhance this)
    if (phone_number.length < 10) {
      return res.status(400).json({
        error: "Phone number must be at least 10 digits",
      });
    }

    // Insert customer interest
    const insertResult = await db.query(
      "INSERT INTO customers (name, phone_number, email_address, country, state, college_of_interest) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [name, phone_number, email_address, country, state, college_of_interest]
    );

    res.status(201).json({
      message: "Interest registered successfully",
      customer: {
        id: insertResult.rows[0].id,
        name: insertResult.rows[0].name,
        phone_number: insertResult.rows[0].phone_number,
        created_at: insertResult.rows[0].created_at,
      },
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all customers (admin route)
app.get("/admin/customers", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM customers ORDER BY created_at DESC"
    );
    res.json({ customers: result.rows });
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
