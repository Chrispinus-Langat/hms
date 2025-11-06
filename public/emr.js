const API_BASE = '/api/emr';  // Your backend base
let currentPatientId = null;  // Set from URL or Patients link, e.g., ?patient=123

// Load EMR on page load
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentPatientId = urlParams.get('patient');
    if (currentPatientId) {
        loadPatientInfo(currentPatientId);
        loadEMR(currentPatientId);
        hidePatientSelector();
    } else {
        loadPatientsDropdown();  // Show and populate selector
    }
});

// Load patients dropdown if selector visible
async function loadPatientsDropdown() {
    try {
        const res = await fetch('/api/patients');  // GET all patients
        if (!res.ok) throw new Error('Failed to load patients');
        const patients = await res.json();  // Assume array of patients
        const select = document.getElementById('selectPatient');
        select.innerHTML = '<option value="">-- Choose a Patient --</option>';  // Clear
        patients.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.name} (${p.id})`;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading patients:', err);
        document.getElementById('patientSelector').innerHTML = '<p style="color: red;">Error loading patients. Check backend.</p>';
    }
}

function loadSelectedPatient() {
    const id = document.getElementById('selectPatient').value;
    if (id) {
        window.location.href = `emr.html?patient=${id}`;
    } else {
        alert('Please select a patient.');
    }
}

function hidePatientSelector() {
    document.getElementById('patientSelector').classList.remove('active');
}

// Load patient basic info (from your Patients API)
async function loadPatientInfo(patientId) {
    try {
        const res = await fetch(`/api/patients/${patientId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const patient = await res.json();
        document.getElementById('patientInfo').innerHTML = `
            <h2>Patient: ${patient.name} (${patient.id})</h2>
            <p>DOB: ${patient.dob} | Contact: ${patient.contact}</p>
        `;
    } catch (err) {
        console.error('Error loading patient:', err);
        document.getElementById('patientInfo').innerHTML = '<p style="color: red;">Error loading patient info.</p>';
    }
}

// Load full EMR
async function loadEMR(patientId) {
    try {
        console.log('Loading EMR for patient:', patientId);
        const res = await fetch(`${API_BASE}/${patientId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = await res.json();
        console.log('EMR data loaded:', data);
        populateTable('notesTable', data.notes, ['visit_date', 'notes', 'doctor_name']);
        populateTable('diagsTable', data.diagnoses, ['diagnosis_code', 'description', 'severity']);
        populateTable('presTable', data.prescriptions, ['medication_name', 'dosage', 'duration', 'instructions']);
        populateTable('allergiesTable', data.allergies, ['allergen', 'reaction', 'severity']);
    } catch (err) {
        console.error('Error loading EMR:', err);
        alert('Failed to load EMR. Check console for details.');
    }
}

function populateTable(tableId, data, cols) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';
    if (!data || data.length === 0) {
        const colspan = cols.length + 1;
        tbody.innerHTML = `<tr><td colspan="${colspan}">No data available.</td></tr>`;
        return;
    }
    data.forEach(row => {
        const tr = document.createElement('tr');
        cols.forEach(col => {
            const td = document.createElement('td');
            td.textContent = row[col] || '';
            tr.appendChild(td);
        });
        const actionsTd = document.createElement('td');
        actionsTd.innerHTML = `<button onclick="editRow('${tableId}', ${row.id})">Edit</button> <button onclick="deleteRow('${tableId}', ${row.id})">Delete</button>`;
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
    });
}

// Tab switching
function showTab(tabName, event) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    if (event && event.target) event.target.classList.add('active');
}

// Form submissions (example for notes)
document.getElementById('noteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
        visitDate: document.getElementById('visitDate').value,
        notes: document.getElementById('notes').value,
        doctorId: document.getElementById('doctorId').value
    };
    if (!formData.visitDate || !formData.notes || !formData.doctorId) {
        alert('Please fill all required fields.');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/${currentPatientId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        if (res.ok) {
            loadEMR(currentPatientId);
            e.target.reset();
            alert('Note added successfully!');
        } else {
            const errorData = await res.json();
            throw new Error(errorData.error || `HTTP ${res.status}`);
        }
    } catch (err) {
        console.error('Error adding note:', err);
        alert('Error adding note. Check console.');
    }
});

// Diagnoses form
document.getElementById('diagForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
        emrNoteId: document.getElementById('emrNoteId').value || null,
        diagnosisCode: document.getElementById('diagnosisCode').value,
        description: document.getElementById('description').value,
        severity: document.getElementById('severity').value
    };
    if (!formData.description) {
        alert('Description is required.');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/${currentPatientId}/diagnoses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        if (res.ok) {
            loadEMR(currentPatientId);
            e.target.reset();
            alert('Diagnosis added successfully!');
        } else {
            const errorData = await res.json();
            throw new Error(errorData.error || `HTTP ${res.status}`);
        }
    } catch (err) {
        console.error('Error adding diagnosis:', err);
        alert('Error adding diagnosis. Check console.');
    }
});
// Notes form
document.getElementById('noteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
        visitDate: document.getElementById('visitDate').value,
        notes: document.getElementById('notes').value,
        doctorId: document.getElementById('doctorId').value
    };

    if (!formData.visitDate || !formData.notes || !formData.doctorId) {
        alert('Please fill all required fields.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/${currentPatientId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (res.ok) {
            loadEMR(currentPatientId);
            e.target.reset();
            alert('Note added successfully!');
        } else {
            const errorData = await res.json();
            throw new Error(errorData.error || `HTTP ${res.status}`);
        }
    } catch (err) {
        console.error('Error adding note:', err);
        alert('Error adding note. Check console.');
    }
});


// Prescriptions form
document.getElementById('presForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
        emrNoteId: document.getElementById('presEmrNoteId').value || null,
        medicationName: document.getElementById('medicationName').value,
        dosage: document.getElementById('dosage').value,
        duration: document.getElementById('duration').value,
        instructions: document.getElementById('instructions').value || ''
    };

    if (!formData.medicationName) {
        alert('Medication name is required.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/${currentPatientId}/prescriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (res.ok) {
            loadEMR(currentPatientId);
            e.target.reset();
            alert('Prescription added successfully!');
        } else {
            const errorData = await res.json();
            throw new Error(errorData.error || `HTTP ${res.status}`);
        }
    } catch (err) {
        console.error('Error adding prescription:', err);
        alert('Error adding prescription. Check console.');
    }
});



// Allergies form
document.getElementById('allergyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
        allergen: document.getElementById('allergen').value,
        reaction: document.getElementById('reaction').value || '',
        severity: document.getElementById('allergySeverity').value
    };

    if (!formData.allergen) {
        alert('Allergen is required.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/${currentPatientId}/allergies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (res.ok) {
            loadEMR(currentPatientId);
            e.target.reset();
            alert('Allergy added successfully!');
        } else {
            const errorData = await res.json();
            throw new Error(errorData.error || `HTTP ${res.status}`);
        }
    } catch (err) {
        console.error('Error adding allergy:', err);
        alert('Error adding allergy. Check console.');
    }
});
