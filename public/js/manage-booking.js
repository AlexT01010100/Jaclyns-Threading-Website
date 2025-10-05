// Full admin manage-booking interface - converted from Firebase to PostgreSQL

document.addEventListener('DOMContentLoaded', function () {
    const slotForm = document.getElementById('slotForm');
    const slotDateInput = document.getElementById('slotDate');
    const timeSlotsContainer = document.getElementById('timeSlots');
    const slotsListContainer = document.getElementById('slotsList');
    const rememberButton = document.getElementById('rememberButton');

    if (!slotForm || !slotDateInput || !timeSlotsContainer || !slotsListContainer) {
        console.error('One or more elements not found in the DOM');
        return;
    }

    function setMinDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const minDate = `${year}-${month}-${day}`;
        slotDateInput.setAttribute('min', minDate);
    }

    setMinDate();

    function generateTimeSlots() {
        const startTime = 9; // 9 AM
        const endTime = 17; // 5 PM
        const interval = 30; // 30 minutes
        timeSlotsContainer.innerHTML = '';

        for (let hour = startTime; hour <= endTime; hour++) {
            for (let minute = 0; minute < 60; minute += interval) {
                const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                const time12 = convertTo12HourFormat(time24);
                
                const timeSlot = document.createElement('div');
                timeSlot.className = 'time-slot';
                timeSlot.innerHTML = `
                    <input type="checkbox" id="${time12}" name="timeSlots" value="${time12}">
                    <label for="${time12}">${time12}</label>
                    <div class="slot-details" style="display: none;">
                        <div><input type="text" placeholder="Name" class="slot-name" /></div>
                        <div><input type="email" placeholder="Email" class="slot-email" /></div>
                        <div><input type="tel" placeholder="Phone Number" class="slot-phone" /></div>
                    </div>
                `;
                timeSlotsContainer.appendChild(timeSlot);
            }
        }
    }

    function convertTo12HourFormat(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    // Fetch all slots for admin view
    async function fetchAdminSlots(date) {
        try {
            const response = await fetch(`/api/admin/slots/${date}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching slots:', error);
            return [];
        }
    }

    slotDateInput.addEventListener('change', async function () {
        const selectedDate = slotDateInput.value;
        if (!selectedDate) return;

        try {
            const slots = await fetchAdminSlots(selectedDate);
            if (slots.length > 0) {
                renderSlots(slots);
            } else {
                slotsListContainer.innerHTML = '<p>No slots for selected date.</p>';
            }
        } catch (error) {
            console.error('Error loading slots:', error);
            slotsListContainer.innerHTML = '<p>Error loading slots.</p>';
        }
    });

    function renderSlots(slots) {
        slotsListContainer.innerHTML = '';
        if (slots.length === 0) {
            slotsListContainer.innerHTML = '<p>No slots available.</p>';
            return;
        }

        slots.forEach(slot => {
            const slotElement = document.createElement('div');
            slotElement.classList.add('slot-item');
            
            const status = slot.appointment_id ? 'booked' : (slot.is_available ? 'available' : 'unavailable');
            const buttonText = slot.is_available ? 'Mark as Unavailable' : 'Mark as Available';

            slotElement.innerHTML = `
                <div class="info-row">
                    <div><strong>Time:</strong> ${slot.time_slot}</div>
                    <div><strong>Status:</strong> <span class="status-${status}">${status}</span></div>
                    <div><strong>Service:</strong> ${slot.service || 'N/A'}</div>
                </div>
                <div class="details-row">
                    <div><strong>Name:</strong> ${slot.name || 'N/A'}</div>
                    <div><strong>Email:</strong> ${slot.email || 'N/A'}</div>
                    <div><strong>Phone:</strong> ${slot.phone || 'N/A'}</div>
                </div>
                <div class="button-container">
                    <button type="button" class="toggle-button" data-slot-time="${slot.time_slot}">${buttonText}</button>
                    <button type="button" class="delete-button" data-slot-time="${slot.time_slot}">Delete Slot</button>
                    ${slot.appointment_id ? `
                        <button type="button" class="edit-button" data-appointment-id="${slot.appointment_id}">Edit Details</button>
                    ` : ''}
                </div>
            `;

            // Toggle availability
            const toggleButton = slotElement.querySelector('.toggle-button');
            toggleButton.addEventListener('click', () => toggleSlotAvailability(slot.time_slot, !slot.is_available));

            // Delete slot
            const deleteButton = slotElement.querySelector('.delete-button');
            deleteButton.addEventListener('click', () => deleteSlot(slot.time_slot));

            // Edit appointment details
            if (slot.appointment_id) {
                const editButton = slotElement.querySelector('.edit-button');
                editButton.addEventListener('click', () => editAppointment(slot));
            }

            slotsListContainer.appendChild(slotElement);
        });
    }

    async function toggleSlotAvailability(timeSlot, isAvailable) {
        const selectedDate = slotDateInput.value;
        if (!selectedDate) return;

        try {
            const response = await fetch(`/api/admin/slots/${selectedDate}/${encodeURIComponent(timeSlot)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isAvailable })
            });

            if (response.ok) {
                alert(`Slot ${isAvailable ? 'marked as available' : 'marked as unavailable'}`);
                const slots = await fetchAdminSlots(selectedDate);
                renderSlots(slots);
            } else {
                alert('Error updating slot');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error updating slot');
        }
    }

    async function deleteSlot(timeSlot) {
        const selectedDate = slotDateInput.value;
        if (!selectedDate) return;
        
        if (!confirm(`Delete slot ${timeSlot}?`)) return;

        try {
            const response = await fetch(`/api/admin/slots/${selectedDate}/${encodeURIComponent(timeSlot)}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('Slot deleted');
                const slots = await fetchAdminSlots(selectedDate);
                renderSlots(slots);
            } else {
                alert('Error deleting slot');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error deleting slot');
        }
    }

    async function editAppointment(slot) {
        const newName = prompt('Enter new name:', slot.name);
        if (newName === null) return;
        
        const newEmail = prompt('Enter new email:', slot.email);
        if (newEmail === null) return;
        
        const newPhone = prompt('Enter new phone:', slot.phone);
        if (newPhone === null) return;
        
        const newService = prompt('Enter new service:', slot.service);
        if (newService === null) return;

        try {
            const response = await fetch(`/api/admin/appointments/${slot.appointment_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName, email: newEmail, phone: newPhone, service: newService })
            });

            if (response.ok) {
                alert('Appointment updated');
                const slots = await fetchAdminSlots(slotDateInput.value);
                renderSlots(slots);
            } else {
                alert('Error updating appointment');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error updating appointment');
        }
    }

    // Add selected time slots
    slotForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const selectedDate = slotDateInput.value;
        const selectedSlots = Array.from(timeSlotsContainer.querySelectorAll('input[name="timeSlots"]:checked'));
        
        if (!selectedDate || selectedSlots.length === 0) {
            alert('Please select a date and at least one time slot');
            return;
        }

        for (const slotCheckbox of selectedSlots) {
            try {
                const response = await fetch('/api/admin/slots', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: selectedDate, timeSlot: slotCheckbox.value })
                });

                if (!response.ok) {
                    console.error(`Failed to add slot ${slotCheckbox.value}`);
                }
            } catch (error) {
                console.error(`Error adding slot ${slotCheckbox.value}:`, error);
            }
        }

        alert('Slots added');
        const slots = await fetchAdminSlots(selectedDate);
        renderSlots(slots);
        
        // Uncheck all checkboxes
        selectedSlots.forEach(cb => cb.checked = false);
    });

    // Hide remember button (not needed for PostgreSQL - slots are persisted automatically)
    if (rememberButton) {
        rememberButton.style.display = 'none';
    }

    generateTimeSlots();
});
