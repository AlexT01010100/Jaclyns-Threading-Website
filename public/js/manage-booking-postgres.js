document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.getElementById('appointmentDate');
    const appointmentsList = document.getElementById('appointmentsList');
    const loadingMessage = document.getElementById('loadingMessage');

    // Set today as default date
    const today = new Date().toISOString().split('T')[0];
    if (dateInput) {
        dateInput.value = today;
        dateInput.setAttribute('min', '2020-01-01');
        dateInput.setAttribute('max', '2030-12-31');
    }

    // Load appointments when date changes
    if (dateInput) {
        dateInput.addEventListener('change', loadAppointments);
        // Load today's appointments on page load
        loadAppointments();
    }

    async function loadAppointments() {
        const selectedDate = dateInput.value;
        
        if (!selectedDate) {
            appointmentsList.innerHTML = '<p>Please select a date</p>';
            return;
        }

        // Show loading message
        if (loadingMessage) {
            loadingMessage.style.display = 'block';
        }
        appointmentsList.innerHTML = '';

        try {
            const response = await fetch(`/api/appointments/${selectedDate}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const appointments = await response.json();

            // Hide loading message
            if (loadingMessage) {
                loadingMessage.style.display = 'none';
            }

            if (appointments.length === 0) {
                appointmentsList.innerHTML = '<p class="no-appointments">No appointments for this date</p>';
                return;
            }

            // Sort appointments by time
            appointments.sort((a, b) => {
                return a.time_slot.localeCompare(b.time_slot);
            });

            // Display appointments
            appointments.forEach(appointment => {
                const appointmentCard = document.createElement('div');
                appointmentCard.className = 'appointment-card';
                appointmentCard.innerHTML = `
                    <div class="appointment-header">
                        <h3>${appointment.time_slot}</h3>
                        <span class="status-badge ${appointment.status}">${appointment.status}</span>
                    </div>
                    <div class="appointment-details">
                        <p><strong>Name:</strong> ${appointment.name || 'N/A'}</p>
                        <p><strong>Email:</strong> ${appointment.email || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${appointment.phone || 'N/A'}</p>
                        <p><strong>Service:</strong> ${appointment.service || 'N/A'}</p>
                        <p><strong>Confirmation ID:</strong> ${appointment.confirmation_id || 'N/A'}</p>
                    </div>
                `;
                appointmentsList.appendChild(appointmentCard);
            });

        } catch (error) {
            console.error('Error loading appointments:', error);
            if (loadingMessage) {
                loadingMessage.style.display = 'none';
            }
            appointmentsList.innerHTML = `<p class="error-message">Error loading appointments: ${error.message}</p>`;
        }
    }
});
