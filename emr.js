const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:patientId', async (req, res) => {
  const { patientId } = req.params;
  console.log(`[EMR] Fetch for patient ${patientId}`);
  const emr = { 
    patient: null, 
    overview: { vitals: 'No vitals', allergies: 'No allergies' }, 
    family_history: 'No family history', 
    history: [], visits: [], progress_notes: [], soap_notes: [], labs: [], medications: [], alerts: [] 
  };

  try {
    // Fetch patient with all new columns (self-contained)
    const [patientRows] = await db.execute(`
      SELECT *, 
        TIMESTAMPDIFF(YEAR, dob, CURDATE()) as age  -- Calc age from dob
      FROM patients 
      WHERE id = ?
    `, [patientId]);
    if (patientRows.length === 0) return res.status(404).json({ error: 'Patient not found' });

    const patient = patientRows[0];
    emr.patient = {
      id: patient.id,
      name: patient.name,
      email: patient.email,  // Contact
      phone: patient.phone,  // Contact
      dob: patient.dob,
      age: patient.age,  // From calc
      gender: patient.gender || 'N/A',
      address: patient.address,
      insurance: patient.insurance || 'N/A',
      insurance_provider: patient.insurance_provider || 'N/A',
      insurance_policy: patient.insurance_policy || 'N/A',
      family_history: patient.family_history || patient.notes || 'No family history',  // From new col or fallback to notes
      status: patient.status
    };
    console.log(`[EMR] Patient loaded: ${emr.patient.name} (age: ${emr.patient.age})`);

    // Optional other queries (as before - skip if tables missing)
    const optional = [
      { key: 'labs', sql: 'SELECT * FROM lab_imaging WHERE patient_id = ? ORDER BY test_date DESC', fallback: [] },
      { key: 'medications', sql: 'SELECT * FROM medications WHERE patient_id = ? ORDER BY id DESC', fallback: [] },
      // Add more as tables exist
    ];
    for (const q of optional) {
      try {
        const [rows] = await db.execute(q.sql, [patientId]);
        emr[q.key] = rows;
      } catch (err) {
        console.warn(`[EMR] ${q.key} skipped: ${err.message}`);
      }
    }

    // Alerts from labs or mock
    emr.alerts = emr.labs.filter(l => l.result?.toLowerCase().includes('abnormal')).map(l => ({
      message: `Abnormal lab: ${l.test_type}`,
      timestamp: l.test_date
    })) || [{ message: 'No alerts', timestamp: new Date().toISOString() }];

    res.json(emr);
  } catch (err) {
    console.error('[EMR] Error:', err.message);
    res.status(500).json({ error: 'EMR fetch failed: ' + err.message });
  }
});

// POSTs unchanged (mock or real as before)
module.exports = router;