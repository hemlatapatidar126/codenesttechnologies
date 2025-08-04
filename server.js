const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db'); // Using the connection pool from db.js

const app = express();
const port = 5000; // Changed port to 5000 to avoid conflicts with MySQL's default 3306

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Create Table if it doesn't exist ---
const createTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS contact_form (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      password VARCHAR(255) NOT NULL,
      image_path VARCHAR(255),
      address TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await db.query(sql);
    console.log('Table `contact_form` is ready.');
  } catch (err) {
    console.error('Error creating table:', err);
  }
};

// --- Multer Setup for File Uploads ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Make sure this 'uploads' directory exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Append extension
  }
});
const upload = multer({ storage: storage });

// --- Custom Middleware to handle Multer errors ---
const uploadWithErrorHandler = (req, res, next) => {
  const uploader = upload.single('image');
  uploader(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      console.error('Multer error:', err);
      return res.status(400).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
      // An unknown error occurred when uploading.
      console.error('An unknown error occurred during file upload:', err);
      return res.status(500).json({ error: 'An unknown error occurred during file upload.' });
    }
    // Everything went fine, proceed to the next middleware.
    next();
  });
};

// --- API Route for Form Submission ---
app.post('/api/contact', uploadWithErrorHandler, async (req, res, next) => {
  try {
    console.log('Received request body:', req.body);
    console.log('Received file:', req.file);

    const { firstName, lastName, email, mobile, password, address } = req.body;
    const imagePath = req.file ? req.file.path : null;

    // Check for missing fields
    if (!firstName || !lastName || !email || !mobile || !password || !address) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const sql = `
      INSERT INTO contact_form (first_name, last_name, email, mobile, password, image_path, address)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

    await db.query(sql, [firstName, lastName, email, mobile, hashedPassword, imagePath, address]);
    res.status(201).json({ message: 'Form submitted successfully!' });
  } catch (err) {
    // Pass error to the global error handler
    next(err);
  }
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error('--- An unhandled error occurred ---');
  console.error(err.stack);
  res.status(500).json({ error: 'An internal server error occurred. Please try again later.' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  createTable(); // Ensure the table exists when the server starts
});

