const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors()); // Enable CORS for cross-origin requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'login_db',  // Hardcoded as per your instruction
  port: process.env.DB_PORT || 3307,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection and export pool
(async () => {
  try {
    await db.query('SELECT 1');
    console.log('✅ MySQL Connected');
    // Export DB pool after successful connection
    app.locals.db = db;
    console.log('🔧 DB pool exported for routes');
  } catch (err) {
    console.error('❌ MySQL Connection Error:', err.message);
    process.exit(1);
  }
})();

// Input validation utility for patient data
const validatePatientData = ({ name, email, phone, dob }) => {
  if (!name || !email || !phone || !dob) {
    return 'Missing required fields';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Invalid email format';
  }
  if (!/^\d{10}$/.test(phone)) {
    return 'Phone number must be 10 digits';
  }
  return null;
};
// In server.js - Mount the telemedicine routes
const telemedicineRoutes = require('./routes/telemedicine');
app.use('/api/telemedicine', telemedicineRoutes);
// In server.js - Mount EMR routes
const emrRoutes = require('./routes/emr');
app.use('/api/emr', emrRoutes);
// Mount lab routes in server.js (after middleware like express.json())
const labRoutes = require('./routes/lab');
app.use('/api/lab', labRoutes);

// Patient Routes (moved to /api/patients to match frontend)
app.get('/api/patients', async (req, res) => {
  try {
    const search = req.query.search?.trim() || '';
    let query = 'SELECT * FROM patients ORDER BY created_at DESC';
    let params = [];

    if (search) {
      query = 'SELECT * FROM patients WHERE name LIKE ? OR email LIKE ? ORDER BY created_at DESC';
      params = [`%${search}%`, `%${search}%`];
    }

    const [results] = await db.execute(query, params);  // Changed to execute for consistency

    if (req.headers.accept.includes('text/html')) {
      return res.send(`<pre>${JSON.stringify(results, null, 2)}</pre>`);
    }

    res.json(results);
  } catch (err) {
    console.error('❌ Patients GET Error:', err.message, { url: req.originalUrl });
    res.status(500).json({ error: 'Server error fetching patients' });
  }
});

app.get('/api/patients/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await db.execute('SELECT * FROM patients WHERE id = ?', [id]);  // Changed to execute
    if (results.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const patient = results[0];
    res.json({
      id: patient.id,
      name: patient.name,
      email: patient.email,
      phone: patient.phone,
      dob: patient.dob,
      notes: patient.notes,
      status: patient.status || 'Not Attended'
    });
  } catch (err) {
    console.error('❌ Error fetching patient:', err.message, { id, url: req.originalUrl });
    res.status(500).json({ error: 'Database error fetching patient' });
  }
});

app.post('/api/patients', async (req, res) => {
  const { name, email, phone, dob, notes } = req.body;
  const validationError = validatePatientData({ name, email, phone, dob });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const [result] = await db.execute(  // Changed to execute
      'INSERT INTO patients (name, email, phone, dob, notes, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, phone, dob, notes || null, 'Not Attended']
    );
    res.status(201).json({ message: 'Patient added successfully', patientId: result.insertId });
  } catch (err) {
    console.error('❌ Error inserting patient:', err.message, { body: req.body });
    res.status(500).json({ error: 'Database error adding patient' });
  }
});

app.patch('/api/patients/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, dob, notes, status } = req.body;

  console.log(`PATCH /api/patients/${id} received:`, req.body);

  // Validate that at least one field is provided for update
  if (!name && !email && !phone && !dob && notes === undefined && !status) {
    console.log('No fields provided for update');
    return res.status(400).json({ error: 'At least one field must be provided to update' });
  }

  // Validate email format if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.log('Invalid email format:', email);
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate phone (10 digits) if provided
  if (phone && !/^\d{10}$/.test(phone)) {
    console.log('Invalid phone format:', phone);
    return res.status(400).json({ error: 'Phone number must be 10 digits' });
  }

  // Validate status if provided
  if (status && !['Not Attended', 'Attended'].includes(status)) {
    console.log('Invalid status value:', status);
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    // Check if patient exists
    const [existing] = await db.execute('SELECT id FROM patients WHERE id = ?', [id]);  // Changed to execute
    console.log('Patient existence check:', existing);
    if (existing.length === 0) {
      console.log(`Patient with id ${id} not found`);
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Build update fields
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (phone) updates.phone = phone;
    if (dob) updates.dob = dob;
    if (notes !== undefined) updates.notes = notes; // Allow empty notes
    if (status) updates.status = status === 'toggle' ? (existing[0].status === 'Attended' ? 'Not Attended' : 'Attended') : status;

    if (Object.keys(updates).length === 0) {
      console.log('No valid fields to update after filtering');
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);

    console.log(`Executing update query: UPDATE patients SET ${fields} WHERE id = ?`, values);

    const [result] = await db.execute(  // Changed to execute
      `UPDATE patients SET ${fields} WHERE id = ?`,
      values
    );

    console.log('Update query result:', result);

    if (result.affectedRows === 0) {
      console.log(`No rows updated for id ${id}`);
      return res.status(400).json({ error: 'No changes applied to patient' });
    }

    console.log(`Successfully updated ${result.affectedRows} row(s) for patient id ${id}`);
    res.json({ message: 'Patient updated successfully', updatedFields: updates });
  } catch (err) {
    console.error('❌ Error updating patient:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

app.delete('/api/patients/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute('DELETE FROM patients WHERE id = ?', [id]);  // Changed to execute
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json({ message: 'Patient deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting patient:', err.message, { id });
    res.status(500).json({ error: 'Database error deleting patient' });
  }
});

// Authentication Routes
// Nodemailer setup (use OAuth2 for production)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-gmail@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Register route
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [results] = await db.execute('SELECT * FROM users WHERE username = ? OR email = ?', [username, normalizedEmail]);  // Changed to execute
    if (results.length > 0) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, normalizedEmail, hashedPassword]);  // Changed to execute
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('❌ Error registering user:', err.message, { body: req.body });
    res.status(500).json({ error: 'Server error registering user' });
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { identifier, password } = req.body;
  const normalizedIdentifier = identifier?.trim().toLowerCase();

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [results] = await db.execute('SELECT * FROM users WHERE username = ? OR email = ?', [normalizedIdentifier, normalizedIdentifier]);  // Changed to execute
    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const storedHash = results[0].password_hash;
    const match = await bcrypt.compare(password, storedHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: results[0].id,
        username: results[0].username,
        email: results[0].email
      }
    });
  } catch (err) {
    console.error('❌ Error logging in:', err.message, { body: req.body });
    res.status(500).json({ error: 'Server error logging in' });
  }
});

// Forgot Password route
app.post('/forgot', async (req, res) => {
  const { identifier } = req.body;
  const normalizedIdentifier = identifier?.trim().toLowerCase();
  const token = crypto.randomBytes(20).toString('hex');
  const expires = new Date(Date.now() + 3600000); // 1 hour

  try {
    const [results] = await db.execute('SELECT email FROM users WHERE username = ? OR email = ?', [normalizedIdentifier, normalizedIdentifier]);  // Changed to execute
    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email = results[0].email;
    await db.execute('UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?', [token, expires, email]);  // Changed to execute

    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-gmail@gmail.com',
      to: email,
      subject: 'Password Reset',
      text: `Click to reset your password: ${process.env.APP_URL || 'http://localhost:3000'}/reset.html?token=${token}\nThis link expires in 1 hour.`
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Password reset email sent' });
  } catch (err) {
    console.error('❌ Error sending reset email:', err.message, { body: req.body });
    res.status(500).json({ error: 'Server error sending reset email' });
  }
});

// Reset Password route
app.post('/reset', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [results] = await db.execute('SELECT * FROM users WHERE reset_token = ? AND reset_expires > NOW()', [token]);  // Changed to execute
    if (results.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await db.execute('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE reset_token = ?', [hashed, token]);  // Changed to execute
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('❌ Error resetting password:', err.message, { body: req.body });
    res.status(500).json({ error: 'Server error resetting password' });
  }
});

// Serve reset.html
app.get('/reset.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset.html'));
});

// Metrics Routes
app.get('/metrics/patients', async (req, res) => {
  try {
    const [results] = await db.execute('SELECT COUNT(*) AS total FROM patients');  // Changed to execute
    res.json({ total: results[0].total });
  } catch (err) {
    console.error('❌ Error fetching patient count:', err.message);
    res.status(500).json({ error: 'Error fetching patient count' });
  }
});

app.get('/metrics/appointments', async (req, res) => {
  try {
    const [results] = await db.execute('SELECT COUNT(*) AS today FROM appointments WHERE DATE(date) = CURDATE()');  // Changed to execute
    res.json({ today: results[0].today });
  } catch (err) {
    console.error('❌ Error fetching appointments:', err.message);
    res.status(500).json({ error: 'Error fetching appointments' });
  }
});

app.get('/metrics/billing', async (req, res) => {
  try {
    const [results] = await db.execute("SELECT SUM(amount_due) AS pending FROM billing WHERE status = 'pending'");  // Changed to execute
    res.json({ pending: results[0].pending || 0 });
  } catch (err) {
    console.error('❌ Error fetching billing info:', err.message);
    res.status(500).json({ error: 'Error fetching billing info' });
  }
});

app.get('/metrics/beds', async (req, res) => {
  try {
    const [results] = await db.execute('SELECT occupied_beds, total_beds FROM beds_status LIMIT 1');  // Changed to execute
    if (results.length === 0) {
      return res.status(404).json({ error: 'Bed data not found' });
    }
    const { occupied_beds, total_beds } = results[0];
    const occupancy = total_beds > 0 ? Math.round((occupied_beds / total_beds) * 100) : 0;
    res.json({ occupancy });
  } catch (err) {
    console.error('❌ Error fetching bed data:', err.message);
    res.status(500).json({ error: 'Error fetching bed data' });
  }
});

// Optional: handle favicon.ico
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Temporary debug endpoint
app.get('/debug', async (req, res) => {
  try {
    const [results] = await db.execute('SELECT * FROM appointments LIMIT 1');  // Changed to execute
    res.json({ status: 'OK', data: results, connected: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all 404 handler (must be last)
app.use((req, res) => {
  console.warn('⚠️ Unmatched route:', req.originalUrl);
  res.status(404).json({ error: 'Route not found' });
});

// Mount appointments routes safely (keep only this, remove duplicate)
console.log('🔍 Loading /api/appointments routes...');
try {
  const appointmentsRouter = require('./routes/appointments');
  app.use('/api/appointments', appointmentsRouter);
  console.log('✅ Appointments routes mounted');
} catch (err) {
  console.error('❌ Failed to load routes:', err.message);
  // Fallback dummy route to test (returns sample data)
  app.use('/api/appointments', (req, res) => {
    if (req.method === 'GET') {
      res.json([
        { id: 1, patientName: 'Test Patient', doctorName: 'Dr. Test', date: '2025-10-12', time: '10:00:00', reason: 'Test', status: 'scheduled', createdAt: '2025-10-11T00:00:00.000Z' }
      ]);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  });
  console.log('🔧 Fallback route active—check routes.js file');
}



// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});