const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all lab/imaging records with patient info
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT 
                l.id,
                l.test_type,
                l.test_date,
                l.result,
                l.technician_name,
                p.name AS patient_name,
                p.dob AS patient_dob
             FROM lab_imaging l
             JOIN patients p ON l.patient_id = p.id
             ORDER BY l.test_date DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching lab records with patient info:', err);
        res.status(500).json({ error: 'Failed to fetch lab records' });
    }
});

// GET lab/imaging records for a specific patient with patient info
router.get('/:patientId', async (req, res) => {
    const { patientId } = req.params;
    try {
        const [rows] = await db.execute(
            `SELECT 
                l.id,
                l.test_type,
                l.test_date,
                l.result,
                l.technician_name,
                p.name AS patient_name,
                p.dob AS patient_dob
             FROM lab_imaging l
             JOIN patients p ON l.patient_id = p.id
             WHERE l.patient_id = ?
             ORDER BY l.test_date DESC`,
            [patientId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching lab records with patient info:', err);
        res.status(500).json({ error: 'Failed to fetch lab records' });
    }
});

// POST new lab/imaging record for a specific patient
router.post('/:patientId', async (req, res) => {
    const { patientId } = req.params;
    const { testType, testDate, result, technicianName } = req.body;
    try {
        const [resultDb] = await db.execute(
            'INSERT INTO lab_imaging (patient_id, test_type, test_date, result, technician_name) VALUES (?, ?, ?, ?, ?)',
            [patientId, testType, testDate, result, technicianName]
        );
        res.status(201).json({ id: resultDb.insertId, message: 'Lab record added' });
    } catch (err) {
        console.error('Error adding lab record:', err);
        res.status(500).json({ error: 'Failed to add lab record' });
    }
});

// PUT update lab/imaging record
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { testType, testDate, result, technicianName } = req.body;
    try {
        const [resultDb] = await db.execute(
            `UPDATE lab_imaging 
             SET test_type = ?, test_date = ?, result = ?, technician_name = ? 
             WHERE id = ?`,
            [testType, testDate, result, technicianName, id]
        );
        if (resultDb.affectedRows === 0) {
            return res.status(404).json({ error: 'Lab record not found' });
        }
        res.json({ message: 'Lab record updated successfully' });
    } catch (err) {
        console.error('Error updating lab record:', err);
        res.status(500).json({ error: 'Failed to update lab record' });
    }
});

// DELETE lab/imaging record
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [resultDb] = await db.execute(
            'DELETE FROM lab_imaging WHERE id = ?',
            [id]
        );
        if (resultDb.affectedRows === 0) {
            return res.status(404).json({ error: 'Lab record not found' });
        }
        res.json({ message: 'Lab record deleted successfully' });
    } catch (err) {
        console.error('Error deleting lab record:', err);
        res.status(500).json({ error: 'Failed to delete lab record' });
    }
});

module.exports = router;