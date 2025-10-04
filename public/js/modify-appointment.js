document.addEventListener('DOMContentLoaded', function () {
    const urlParams = new URLSearchParams(window.location.search);
    const confirmationId = urlParams.get('confirmationId');
    const messageDiv = document.getElementById('message');

    if (!confirmationId) {
        messageDiv.textContent = 'No confirmation ID provided.';
        messageDiv.classList.add('error');
        return;
    }

    // Display the confirmation ID
    document.getElementById('confirmationId').value = confirmationId;

    // Fetch and display appointment details
    fetchAppointmentDetails(confirmationId);

    // Cancel button handler
    document.getElementById('cancel-button').addEventListener('click', async function () {
        if (confirm('Are you sure you want to cancel this appointment?')) {
            await cancelAppointment(confirmationId);
        }
    });

    async function fetchAppointmentDetails(confirmationId) {
        try {
            const response = await fetch(`/api/appointment/${confirmationId}`);
            
            if (!response.ok) {
                throw new Error('Appointment not found');
            }

            const appointment = await response.json();
            displayAppointmentDetails(appointment);
        } catch (error) {
            console.error('Error fetching appointment:', error);
            messageDiv.textContent = 'Error fetching appointment details. Please check your confirmation ID.';
            messageDiv.classList.add('error');
        }
    }

    function displayAppointmentDetails(appointment) {
        const detailsDiv = document.getElementById('appointment-details');
        if (detailsDiv) {
            detailsDiv.innerHTML = `
                <h3>Appointment Details</h3>
                <p><strong>Name:</strong> ${appointment.name}</p>
                <p><strong>Email:</strong> ${appointment.email}</p>
                <p><strong>Phone:</strong> ${appointment.phone}</p>
                <p><strong>Service:</strong> ${appointment.service}</p>
                <p><strong>Date:</strong> ${appointment.appointment_date}</p>
                <p><strong>Time:</strong> ${appointment.time_slot}</p>
                <p><strong>Status:</strong> ${appointment.status}</p>
            `;
        }
    }

    async function cancelAppointment(confirmationId) {
        try {
            messageDiv.textContent = 'Canceling appointment...';
            messageDiv.classList.remove('error', 'success');

            const response = await fetch('/cancel-appointment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ confirmationId })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to cancel appointment');
            }

            const result = await response.json();
            messageDiv.textContent = result.message || 'Appointment canceled successfully!';
            messageDiv.classList.add('success');
            messageDiv.classList.remove('error');

            // Disable the cancel button after successful cancellation
            document.getElementById('cancel-button').disabled = true;
            document.getElementById('cancel-button').textContent = 'Appointment Canceled';

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
