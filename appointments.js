const express = require('express');
const router = express.Router();

// Safe middleware to set db (with fallback log)
router.use((req, res, next) => {
  if (!req.app.locals.db) {
    console.error('DB pool not available in middleware');
    return res.status(500).json({ error: 'DB pool not available' });
  }
  req.db = req.app.locals.db;
  next();
});

// GET all appointments (with optional filters)
router.get('/', async (req, res) => {
  try {
    const db = req.db;
    let sql = 'SELECT id, patientName, doctorName, DATE(date) AS date, time, reason, status, createdAt, updatedAt FROM appointments';  // DATE() for calendar compatibility
    let params = [];
    
    let whereClause = [];
    if (req.query.patientName) {
      whereClause.push('patientName LIKE ?');
      params.push(`%${req.query.patientName}%`);
    }
    if (req.query.date) {
      whereClause.push('DATE(date) = ?');
      params.push(req.query.date);
    }
    if (req.query.status) {
      whereClause.push('status = ?');
      params.push(req.query.status);
    }
    
    if (whereClause.length > 0) {
      sql += ' WHERE ' + whereClause.join(' AND ');
    }
    
    sql += ' ORDER BY date ASC, time ASC';
    
    const [results] = await db.query(sql, params);
    res.json(results);
  } catch (err) {
    console.error('GET appointments error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET single by ID
router.get('/:id', async (req, res) => {
  try {
    const db = req.db;
    const sql = 'SELECT id, patientName, doctorName, DATE(date) AS date, time, reason, status, createdAt, updatedAt FROM appointments WHERE id = ?';  // DATE() for consistency
    const [results] = await db.query(sql, [req.params.id]);
    if (results.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json(results[0]);
  } catch (err) {
    console.error('GET appointment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST create (with basic validation)
router.post('/', async (req, res) => {
  try {
    const db = req.db;
    const { patientName, doctorName, date, time, reason } = req.body;
    
    console.log('POST body received:', { patientName, doctorName, date, time, reason });  // Debug log
    
    // Basic validation
    if (!patientName || !doctorName || !date || !time || !reason) {
      console.error('Validation failed: Missing fields');
      return res.status(400).json({ error: 'Missing required fields: patientName, doctorName, date, time, reason' });
    }
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error('Invalid date format:', date);
      return res.status(400).json({ error: 'Invalid date format (use YYYY-MM-DD)' });
    }
    
    // Validate time format (HH:MM or HH:MM:SS)
    if (!/^(\d{2}:\d{2}(:\d{2})?)$/.test(time)) {
      console.error('Invalid time format:', time);
      return res.status(400).json({ error: 'Invalid time format (use HH:MM or HH:MM:SS)' });
    }
    
    // Ensure time has seconds for TIME column
    const fullTime = time.split(':').length === 2 ? time + ':00' : time;
    
    // Default status to 'scheduled' if not provided
    const status = req.body.status || 'scheduled';
    
    const sql = 'INSERT INTO appointments (patientName, doctorName, date, time, reason, status) VALUES (?, ?, ?, ?, ?, ?)';
    const [result] = await db.query(sql, [patientName, doctorName, date, fullTime, reason, status]);
    
    console.log('Appointment inserted with ID:', result.insertId);  // Success log
    
    res.status(201).json({ id: result.insertId, message: 'Appointment created successfully' });
  } catch (err) {
    console.error('POST appointment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update (handle status, reason, date, time)
router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    const { status, reason, date, time } = req.body;
    let sql = 'UPDATE appointments SET ';
    let params = [];
    
    let updates = 0;
    if (status !== undefined) {
      sql += 'status = ?, ';
      params.push(status);
      updates++;
    }
    if (reason !== undefined) {
      sql += 'reason = ?, ';
      params.push(reason);
      updates++;
    }
    if (date) {
      sql += 'date = ?, ';
      params.push(date);
      updates++;
    }
    if (time) {
      // Ensure time has seconds
      const fullTime = time.split(':').length === 2 ? time + ':00' : time;
      sql += 'time = ?, ';
      params.push(fullTime);
      updates++;
    }
    
    if (updates === 0) return res.status(400).json({ error: 'No fields to update' });
    sql = sql.slice(0, -2) + ' WHERE id = ?';
    params.push(req.params.id);
    
    const [result] = await db.query(sql, params);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ message: 'Appointment updated' });
  } catch (err) {
    console.error('PUT appointment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const db = req.db;
    const sql = 'DELETE FROM appointments WHERE id = ?';
    const [result] = await db.query(sql, [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ message: 'Appointment deleted' });
  } catch (err) {
    console.error('DELETE appointment error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;