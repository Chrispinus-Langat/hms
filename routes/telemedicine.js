// routes/telemedicine.js - Express Router
const express = require('express');
const router = express.Router();
const db = require('../db');  // Assume your MySQL db module

// GET appointments for patient
router.get('/appointments/:patientId', async (req, res) => {
  const { patientId } = req.params;
  try {
    const [rows] = await db.execute(
      `SELECT id, specialty, date_time, status, notes 
       FROM telemedicine_appointments 
       WHERE patient_id = ? 
       ORDER BY date_time ASC`,
      [patientId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// POST new appointment
router.post('/appointments/:patientId', async (req, res) => {
  const { patientId } = req.params;
  const { specialty, date_time, notes, status } = req.body;
  try {
    const [result] = await db.execute(
      `INSERT INTO telemedicine_appointments (patient_id, specialty, date_time, notes, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [patientId, specialty, date_time, notes, status]
    );
    res.status(201).json({ id: result.insertId, message: 'Appointment scheduled' });
  } catch (err) {
    console.error('Error adding appointment:', err);
    res.status(500).json({ error: 'Failed to schedule appointment' });
  }
});

// DELETE appointment (for cancel)
router.delete('/appointments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute(
      'DELETE FROM telemedicine_appointments WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ message: 'Appointment cancelled' });
  } catch (err) {
    console.error('Error deleting appointment:', err);
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

// POST new prescription
router.post('/prescriptions/:patientId', async (req, res) => {
  const { patientId } = req.params;
  const { medication, dosage, duration, instructions, status } = req.body;
  try {
    const [result] = await db.execute(
      `INSERT INTO telemedicine_prescriptions (patient_id, medication, dosage, duration, instructions, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patientId, medication, dosage, duration, instructions, status]
    );
    res.status(201).json({ id: result.insertId, message: 'Prescription sent' });
  } catch (err) {
    console.error('Error adding prescription:', err);
    res.status(500).json({ error: 'Failed to send prescription' });
  }
});

// GET EMR for patient (simplified - aggregate from other tables)
router.get('/patients/:patientId/emr', async (req, res) => {
  const { patientId } = req.params;
  try {
    const [patientRows] = await db.execute('SELECT name, dob FROM patients WHERE id = ?', [patientId]);
    if (patientRows.length === 0) return res.status(404).json({ error: 'Patient not found' });
    
    // Mock history/labs - in prod, JOIN with history/lab tables
    const emr = {
      name: patientRows[0].name,
      history: 'Sample medical history...',
      labs: 'Recent labs: Normal'
    };
    res.json(emr);
  } catch (err) {
    console.error('Error fetching EMR:', err);
    res.status(500).json({ error: 'Failed to load EMR' });
  }
});

// POST message (for chat - store in DB)
router.post('/messages/:patientId', async (req, res) => {
  const { patientId } = req.params;
  const { text, sender } = req.body;
  try {
    const [result] = await db.execute(
      `INSERT INTO telemedicine_messages (patient_id, text, sender, timestamp) 
       VALUES (?, ?, ?, NOW())`,
      [patientId, text, sender]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;