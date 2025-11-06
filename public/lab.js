const LAB_API = '/api/lab';
const patientId = new URLSearchParams(window.location.search).get('patient');

document.getElementById('labForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!patientId) {
        alert('No patient selected. Please go back to the patient list.');
        return;
    }
    const formData = {
        testType: document.getElementById('testType').value,
        testDate: document.getElementById('testDate').value,
        technicianName: document.getElementById('technicianName').value,
        result: document.getElementById('result').value
    };

    try {
        const res = await fetch(`${LAB_API}/${patientId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to add lab record');
        }
        loadLabRecords();
        e.target.reset();
        alert('Lab record added!');
    } catch (err) {
        console.error(err);
        alert('Error adding lab record: ' + err.message);
    }
});

async function loadLabRecords() {
    if (!patientId) {
        console.error('No patientId provided');
        return;
    }
    try {
        const res = await fetch(`${LAB_API}/${patientId}`);
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${res.status}`);
        }
        const records = await res.json();
        const tbody = document.querySelector('#labTable tbody');
        tbody.innerHTML = '';
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500">No lab records found for this patient.</td></tr>';
            return;
        }
        records.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-4 py-2 border">${r.test_type || 'N/A'}</td>
                <td class="px-4 py-2 border">${r.test_date ? new Date(r.test_date).toLocaleDateString() : 'N/A'}</td>
                <td class="px-4 py-2 border">${r.technician_name || 'N/A'}</td>
                <td class="px-4 py-2 border">${r.result || 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error loading lab records:', err);
        const tbody = document.querySelector('#labTable tbody');
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Error loading records: ${err.message}</td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', loadLabRecords);