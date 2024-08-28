document.addEventListener('DOMContentLoaded', function () {
    const urlParams = new URLSearchParams(window.location.search);
    const confirmationId = urlParams.get('confirmationId');

    if (!confirmationId) {
        document.getElementById('message').textContent = 'No confirmation ID provided.';
        return;
    }

    document.getElementById('confirmationId').value = confirmationId;


    document.getElementById('cancel-button').addEventListener('click', async function () {
        if (confirm('Are you sure you want to cancel this appointment?')) {
            const urlParams = new URLSearchParams(window.location.search);
            const confirmationId = urlParams.get('confirmationId');
            const date = urlParams.get('date');

            if (!confirmationId || !date) {
                document.getElementById('message').textContent = 'Missing confirmation ID or date.';
                return;
            }

            try {
                const response = await fetch(`/cancel-appointment?confirmationId=${confirmationId}&date=${date}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const result = await response.text();
                document.getElementById('message').textContent = result;
            } catch (error) {
                console.error('Fetch error:', error);
                document.getElementById('message').textContent = 'Error canceling appointment.';
            }
        }
    });
});