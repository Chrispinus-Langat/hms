const API_BASE = 'http://localhost:3000/api/appointments';

// Global variables
let currentRole = 'patient';
let calendar;

// Load all appointments on page load
document.addEventListener('DOMContentLoaded', () => {
    loadAppointments();
    setupRoleSwitch();
    attachEventListeners();  // Attach all listeners here
    initCalendar();  // Initialize FullCalendar
});

// Role switching
function setupRoleSwitch() {
    document.getElementById('roleSelect').addEventListener('change', (e) => {
        currentRole = e.target.value;
        const formTitle = document.getElementById('formTitle');
        const patientFields = document.getElementById('patientFields');
        const doctorFields = document.getElementById('doctorFields');
        
        if (currentRole === 'patient') {
            formTitle.textContent = 'Book Appointment (Patient View)';
            patientFields.style.display = 'block';
            doctorFields.style.display = 'none';
            document.getElementById('patientName').required = true;
            document.getElementById('doctorName').required = true;
        } else if (currentRole === 'doctor') {
            formTitle.textContent = 'Schedule Appointment (Doctor View)';
            patientFields.style.display = 'none';
            doctorFields.style.display = 'block';
            document.getElementById('patientNameDoc').required = true;
            document.getElementById('doctorNameDoc').required = true;
        } else {  // admin
            formTitle.textContent = 'Manage Appointment (Admin View)';
            patientFields.style.display = 'block';
            doctorFields.style.display = 'none';
        }
    });
}

function loadAppointments(filters = {}) {
    let url = `${API_BASE}`;
    const params = new URLSearchParams();
    if (filters.date) params.append('date', filters.date);
    if (filters.status) params.append('status', filters.status);
    if (params.toString()) url += `?${params.toString()}`;
    
    console.log('Fetching from:', url);  // Debug log
    
    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.json();
        })
        .then(data => {
            console.log('API Data Loaded:', data);  // Debug log
            const tbody = document.querySelector('#appointmentsTable tbody');
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">No appointments found.</td></tr>';
                return;
            }
            data.forEach(apt => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${apt.id}</td>
                    <td>${apt.patientName || 'N/A'}</td>
                    <td>${apt.doctorName || 'N/A'}</td>
                    <td>${apt.date}</td>
                    <td>${apt.time}</td>
                    <td>${apt.reason || 'N/A'}</td>
                    <td><span class="status ${apt.status}">${apt.status}</span></td>
                    <td>${apt.createdAt}</td>
                    <td>
                        <button class="btn btn-update" onclick="updateAppointment(${apt.id})">Update</button>
                        <button class="btn btn-delete" onclick="deleteAppointment(${apt.id})">Delete</button>
                    </td>
                `;
            });
            // Refresh calendar events
            refreshCalendarEvents(data);
        })
        .catch(err => {
            console.error('Error loading appointments:', err);
            alert('Failed to load appointments: ' + err.message);
        });
}

// Create new appointment
function createAppointment(formData) {
    fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
    })
    .then((data) => {
        alert('Appointment booked! ID: ' + data.id);
        document.getElementById('appointmentForm').reset();
        loadAppointments();
    })
    .catch(err => {
        console.error('Error creating appointment:', err);
        alert('Booking failed: ' + err.message);
    });
}

// Attach all event listeners
function attachEventListeners() {
    // Form submit
    const form = document.getElementById('appointmentForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Submit button clicked!');  // Debug: Confirm click
            let formData = {};
            
            if (currentRole === 'patient') {
                formData = {
                    patientName: document.getElementById('patientName').value,
                    doctorName: document.getElementById('doctorName').value,
                    date: document.getElementById('date').value,
                    time: document.getElementById('time').value + ':00',
                    reason: document.getElementById('reason').value
                };
            } else if (currentRole === 'doctor') {
                formData = {
                    patientName: document.getElementById('patientNameDoc').value,
                    doctorName: document.getElementById('doctorNameDoc').value,
                    date: document.getElementById('date').value,
                    time: document.getElementById('time').value + ':00',
                    reason: document.getElementById('reason').value
                };
            } else {  // admin
                formData = {
                    patientName: document.getElementById('patientName').value,
                    doctorName: document.getElementById('doctorName').value,
                    date: document.getElementById('date').value,
                    time: document.getElementById('time').value + ':00',
                    reason: document.getElementById('reason').value
                };
            }
            
            console.log('Form data to submit:', formData);  // Debug log
            
            createAppointment(formData);
        });
    } else {
        console.error('Form not found on page load');
    }

    // Filter date change
    const filterDate = document.getElementById('filterDate');
    if (filterDate) {
        filterDate.addEventListener('change', (e) => {
            const date = e.target.value;
            loadAppointments({ date: date || null });
        });
    }

    // Filter status change
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) {
        filterStatus.addEventListener('change', applyFilters);
    }
}

// Apply filters (for button)
function applyFilters() {
    const date = document.getElementById('filterDate').value;
    const status = document.getElementById('filterStatus').value;
    loadAppointments({ date, status });
}

// Clear filters
function clearFilters() {
    document.getElementById('filterDate').value = '';
    document.getElementById('filterStatus').value = '';
    loadAppointments();
}

// Update appointment
function updateAppointment(id) {
    const newStatus = prompt('New status (scheduled/confirmed/cancelled/completed/postponed):');
    if (newStatus) {
        fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.json();
        })
        .then(() => {
            alert('Appointment updated!');
            loadAppointments();
        })
        .catch(err => console.error('Error updating:', err));
    }
}

// Delete appointment
function deleteAppointment(id) {
    if (confirm('Delete this appointment?')) {
        fetch(`${API_BASE}/${id}`, { method: 'DELETE' })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.json();
        })
        .then(() => {
            alert('Appointment deleted!');
            loadAppointments();
        })
        .catch(err => console.error('Error deleting:', err));
    }
}

// FullCalendar Integration
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            initialDate: '2025-10-11',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            events: [],
            eventClick: function(info) {
                alert(`Appointment: ${info.event.title}\nID: ${info.event.extendedProps.id}\nDate: ${info.event.start.toISOString().split('T')[0]}\nTime: ${info.event.extendedProps.time}`);
            },
            eventColor: '#007bff',
            height: 'auto'
        });
        calendar.render();
    }
}

function refreshCalendarEvents(data) {
    if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(data.map(apt => ({
            title: `${apt.patientName} with ${apt.doctorName} - ${apt.reason}`,
            start: `${apt.date}T${apt.time}`,
            extendedProps: { 
                id: apt.id, 
                status: apt.status,
                time: apt.time
            },
            backgroundColor: getStatusColor(apt.status)
        })));
    }
}

function getStatusColor(status) {
    const colors = {
        'scheduled': '#007bff',
        'confirmed': '#28a745',
        'postponed': '#ffc107',
        'cancelled': '#dc3545',
        'completed': '#6c757d'
    };
    return colors[status] || '#007bff';
}