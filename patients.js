const express = require('express');
const router = express.Router();
const db = require('../db');  // Adjust path if your DB pool is elsewhere, e.g., '../config/db'

// Optional: Auth middleware (add if you have JWT)
const requireAuth = (req, res, next) => {
    // TODO: Implement auth check, e.g., const token = req.headers.authorization;
    next();  // Bypass for now
};

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

// GET /api/patients - Fetch all patients (for selector dropdown or list, with optional search)
router.get('/', requireAuth, async (req, res) => {
    try {
        const search = req.query.search?.trim() || '';
        let query = 'SELECT * FROM patients ORDER BY COALESCE(created_at, id) DESC';  // Safe ORDER BY: fallback to id if created_at missing
        let params = [];

        if (search) {
          query = 'SELECT * FROM patients WHERE name LIKE ? OR email LIKE ? ORDER BY COALESCE(created_at, id) DESC';
          params = [`%${search}%`, `%${search}%`];
        }

        console.log('Executing query:', query, 'with params:', params);  // Debug log
        const [rows] = await db.execute(query, params);
        console.log('Fetched rows:', rows.length);  // Debug log
        res.json(rows);  // Direct array: [{ id: 1, name: 'John Doe', email: '...', ... }]
    } catch (err) {
        console.error('DB Error in /api/patients:', err.message);  // Log full error for debug
        res.status(500).json({ error: 'Failed to fetch patients', details: err.message });
    }
});

// GET /api/patients/:id - Fetch single patient (for loadPatientInfo)
router.get('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        console.log('Fetching patient ID:', id);  // Debug log
        const [rows] = await db.execute(
            'SELECT * FROM patients WHERE id = ?',  // Full fields
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        const patient = rows[0];
        console.log('Fetched patient:', patient);  // Debug log
        res.json({
            id: patient.id,
            name: patient.name,
            email: patient.email,
            phone: patient.phone,  // Original had phone
            dob: patient.dob,
            address: patient.address || null,  // Added address
            notes: patient.notes || null,
            status: patient.status || 'Not Attended'  // Uncommented
        });
    } catch (err) {
        console.error('DB Error in /api/patients/:id:', err.message);
        res.status(500).json({ error: 'Failed to fetch patient', details: err.message });
    }
});

// POST /api/patients - Add new patient
router.post('/', requireAuth, async (req, res) => {
    const { name, email, phone, dob, address, notes } = req.body;  // Added address
    const validationError = validatePatientData({ name, email, phone, dob });
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        console.log('Adding patient:', req.body);  // Debug log
        const [result] = await db.execute(
            'INSERT INTO patients (name, email, phone, dob, address, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [name, email, phone, dob, address || null, notes || null, 'Not Attended']
        );
        console.log('Added patient ID:', result.insertId);  // Debug log
        res.status(201).json({ message: 'Patient added successfully', patientId: result.insertId });
    } catch (err) {
        console.error('DB Error adding patient:', err.message);
        res.status(500).json({ error: 'Failed to add patient', details: err.message });
    }
});

// PATCH /api/patients/:id - Update patient (partial updates)
router.patch('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, dob, address, notes, status } = req.body;  // Added address

    // Validate provided fields
    if (!name && !email && !phone && !dob && address === undefined && notes === undefined && status === undefined) {
        return res.status(400).json({ error: 'At least one field must be provided' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    if (phone && !/^\d{10}$/.test(phone)) {
        return res.status(400).json({ error: 'Phone must be 10 digits' });
    }
    if (status && !['Not Attended', 'Attended'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        console.log('Updating patient ID:', id, 'with:', req.body);  // Debug log
        // Check existence
        const [existing] = await db.execute('SELECT * FROM patients WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Build dynamic update
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email;
        if (phone !== undefined) updates.phone = phone;
        if (dob !== undefined) updates.dob = dob;
        if (address !== undefined) updates.address = address;  // Added
        if (notes !== undefined) updates.notes = notes;
        if (status !== undefined) {
            updates.status = status === 'toggle' ? (existing[0].status === 'Attended' ? 'Not Attended' : 'Attended') : status;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid updates' });
        }

        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];

        const [result] = await db.execute(
            `UPDATE patients SET ${setClause}, updated_at = NOW() WHERE id = ?`,
            values
        );

        console.log('Update result:', result);  // Debug log
        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'No changes applied' });
        }

        res.json({ message: 'Patient updated successfully' });
    } catch (err) {
        console.error('DB Error updating patient:', err.message);
        res.status(500).json({ error: 'Failed to update patient', details: err.message });
    }
});

// DELETE /api/patients/:id - Delete patient
router.delete('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        console.log('Deleting patient ID:', id);  // Debug log
        const [result] = await db.execute('DELETE FROM patients WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        console.log('Deleted patient:', result.affectedRows);  // Debug log
        res.json({ message: 'Patient deleted successfully' });
    } catch (err) {
        console.error('DB Error deleting patient:', err.message);
        res.status(500).json({ error: 'Failed to delete patient', details: err.message });
    }
});

module.exports = router;