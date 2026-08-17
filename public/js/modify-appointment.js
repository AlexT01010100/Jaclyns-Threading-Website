document.addEventListener('DOMContentLoaded', function () {
    const urlParams = new URLSearchParams(window.location.search);
    const confirmationId = urlParams.get('confirmationId');
    const messageDiv = document.getElementById('message');
    let currentAppointment = null;

    if (!confirmationId) {
        messageDiv.textContent = 'No confirmation ID provided.';
        messageDiv.classList.add('error');
        return;
    }

    // Display the confirmation ID if element exists
    const confirmationIdInput = document.getElementById('confirmationId');
    if (confirmationIdInput) {
        confirmationIdInput.value = confirmationId;
    }

    // Fetch and display appointment details
    fetchAppointmentDetails(confirmationId);
 
    async function fetchAppointmentDetails(confirmationId) {
        try {
            const response = await fetch(`/api/appointment/${confirmationId}`);
            
            if (!response.ok) {
                throw new Error('Appointment not found');
            }

            currentAppointment = await response.json();
            displayAppointmentDetails(currentAppointment);
        } catch (error) {
            console.error('Error fetching appointment:', error);
            messageDiv.textContent = 'Error fetching appointment details. Please check your confirmation ID.';
            messageDiv.classList.add('error');
        }
    }

    // Customer-submitted name/email/phone/service get rendered into this
    // page's innerHTML below - without escaping, an appointment with a
    // service name like "<img src=x onerror=...>" would execute here.
    function escapeHtml(str) {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // The API returns time_slot as a 24-hour "HH:MM:SS" string (Postgres TIME column)
    function formatTimeTo12Hour(timeString) {
        const [hour, minute] = timeString.split(':').map(Number);
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
    }

    function displayAppointmentDetails(appointment) {
        const detailsDiv = document.getElementById('appointment-details');
        if (detailsDiv) {
            // Format the date to remove T00:00:00.000Z
            const formattedDate = appointment.appointment_date.split('T')[0];

            // Capitalize first letter of service
            const capitalizedService = appointment.service.charAt(0).toUpperCase() + appointment.service.slice(1);

            // Check if appointment is cancelled
            const isCancelled = appointment.status === 'cancelled';

            detailsDiv.innerHTML = `
                <h3>Appointment Details</h3>

                <!-- Read-only fields -->
                <div class="detail-group read-only">
                    <p><strong>🔖 Confirmation ID:</strong> ${appointment.confirmation_id || confirmationId}</p>
                    <p><strong>💼 Service:</strong> ${escapeHtml(capitalizedService)}</p>
                    <p><strong>📅 Date:</strong> ${formattedDate}</p>
                    <p><strong>🕒 Time:</strong> ${formatTimeTo12Hour(appointment.time_slot)}</p>
                    <p><strong>📊 Status:</strong> <span class="status-${appointment.status}">${appointment.status.toUpperCase()}</span></p>
                </div>

                ${!isCancelled ? `
                <!-- Editable fields (only shown if not cancelled) -->
                <div class="detail-group editable">
                    <h4>Edit Your Information:</h4>
                    <div class="form-group">
                        <label for="edit-name">👤 Name:</label>
                        <input type="text" id="edit-name" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-email">📧 Email:</label>
                        <input type="email" id="edit-email" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-phone">📱 Phone:</label>
                        <input type="tel" id="edit-phone" required>
                    </div>
                </div>

                <div class="button-group">
                    <button id="update-button" class="btn btn-primary">💾 Update Information</button>
                    <button id="cancel-button" class="btn btn-danger">❌ Cancel Appointment</button>
                </div>
                ` : `
                <div class="button-group">
                    <button class="btn btn-danger" disabled>❌ Appointment Canceled</button>
                </div>
                `}
            `;

            // Re-attach event listeners after DOM update (only if not cancelled)
            if (!isCancelled) {
                // Set via the .value property rather than interpolating into
                // the value="" attribute above - property assignment isn't
                // parsed as HTML, so it can't be broken out of regardless of
                // what characters the name/email/phone contain.
                document.getElementById('edit-name').value = appointment.name;
                document.getElementById('edit-email').value = appointment.email;
                document.getElementById('edit-phone').value = appointment.phone;

                document.getElementById('update-button').addEventListener('click', async function () {
                    await updateAppointment(confirmationId);
                });

                document.getElementById('cancel-button').addEventListener('click', async function () {
                    if (confirm('Are you sure you want to cancel this appointment?')) {
                        await cancelAppointment(confirmationId);
                    }
                });
            }
        }
    }

    async function updateAppointment(confirmationId) {
        const name = document.getElementById('edit-name').value.trim();
        const email = document.getElementById('edit-email').value.trim();
        const phone = document.getElementById('edit-phone').value.trim();

        if (!name || !email || !phone) {
            messageDiv.textContent = 'Please fill in all fields.';
            messageDiv.classList.add('error');
            messageDiv.classList.remove('success');
            return;
        }

        try {
            messageDiv.textContent = 'Updating appointment...';
            messageDiv.classList.remove('error', 'success');

            // Use confirmation ID to update
            const response = await fetch(`/api/appointment/${confirmationId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    email,
                    phone
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to update appointment');
            }

            messageDiv.textContent = 'Appointment updated successfully! ✅';
            messageDiv.classList.add('success');
            messageDiv.classList.remove('error');

            // Refresh appointment details without clearing the success message
            setTimeout(() => {
                fetchAppointmentDetails(confirmationId);
            }, 2000);

        } catch (error) {
            console.error('Error updating appointment:', error);
            messageDiv.textContent = error.message || 'Error updating appointment. Please try again.';
            messageDiv.classList.add('error');
            messageDiv.classList.remove('success');
        }
    }

    async function cancelAppointment(confirmationId) {
        try {
            messageDiv.textContent = 'Canceling appointment...';
            messageDiv.classList.remove('error', 'success');

            const date = currentAppointment.appointment_date;
            const response = await fetch(`/cancel-appointment?confirmationId=${confirmationId}&date=${date}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to cancel appointment');
            }

            const result = await response.json();
            messageDiv.textContent = result.message || 'Appointment canceled successfully! ✅';
            messageDiv.classList.add('success');
            messageDiv.classList.remove('error');

            // Refresh appointment details
            setTimeout(() => {
                fetchAppointmentDetails(confirmationId);
            }, 2000);

        } catch (error) {
            console.error('Error canceling appointment:', error);
            messageDiv.textContent = error.message || 'Error canceling appointment. Please try again.';
            messageDiv.classList.add('error');
            messageDiv.classList.remove('success');
        }
    }
});
