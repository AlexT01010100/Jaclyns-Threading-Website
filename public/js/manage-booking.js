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

    // Customer-submitted name/email/phone/service get rendered into this
    // page's innerHTML below - without escaping, a booking with a name like
    // "<img src=x onerror=...>" would execute in the admin's authenticated
    // session. Uses the browser's own text encoding rather than a manual
    // regex swap.
    function escapeHtml(str) {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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
                    <input type="checkbox" id="${time12}" name="timeSlots" value="${time24}">
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

    // Same service list/values as book-appointment.html's dropdown - values
    // must match exactly since the server looks up duration by this string.
    const SERVICE_OPTIONS = [
        'Threading - Eyebrows ($14)', 'Threading - Upper Lip ($7)', 'Threading - Lower Lip ($6)',
        'Threading - Chin ($8)', 'Threading - Neck ($8)', 'Threading - Forehead ($7)',
        'Threading - Sideburns ($12)', 'Threading - Fullface Special ($38)',
        'Microblading ($380)', 'Machine Hair Strokes ($395)',
        'Lash Lift + Tint ($150)', 'Lash Tint ($25)',
        'Brow Lamination + Tint ($120)', 'Brow Tint ($18)',
        'Phi-Hygienic Facial ($130)',
        'Bioneedling ($220)'
    ];

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

        // time_slot comes back from the API as a zero-padded 24-hour "HH:MM:SS"
        // string (Postgres TIME column), so it already sorts correctly as text
        slots.sort((a, b) => a.time_slot.localeCompare(b.time_slot));

        slots.forEach(slot => {
            const slotElement = document.createElement('div');
            slotElement.classList.add('slot-item');
            
            const status = slot.appointment_id ? 'booked' : (slot.is_available ? 'available' : 'unavailable');
            const buttonText = slot.is_available ? 'Mark as Unavailable' : 'Mark as Available';
            const displayTime = convertTo12HourFormat(slot.time_slot);

            slotElement.innerHTML = `
                <div class="status-header">
                    <span class="status-${status}">${status.toUpperCase()}</span>
                </div>
                <div class="details-row">
                    <div>
                        <strong>🕒 Time:</strong> ${displayTime}
                    </div>
                    <div>
                        <strong>👤 Name:</strong> ${escapeHtml(slot.name) || 'N/A'}
                        ${slot.appointment_id ? `<button type="button" class="edit-name-btn" data-appointment-id="${slot.appointment_id}">✏️</button>` : ''}
                    </div>
                    <div>
                        <strong>📧 Email:</strong> ${escapeHtml(slot.email) || 'N/A'}
                        ${slot.appointment_id ? `<button type="button" class="edit-email-btn" data-appointment-id="${slot.appointment_id}">✏️</button>` : ''}
                    </div>
                </div>
                <div class="details-row">
                    <div>
                        <strong>📱 Phone:</strong> ${escapeHtml(slot.phone) || 'N/A'}
                        ${slot.appointment_id ? `<button type="button" class="edit-phone-btn" data-appointment-id="${slot.appointment_id}">✏️</button>` : ''}
                    </div>
                    <div>
                        <strong>💼 Service:</strong> ${escapeHtml(slot.service) || 'N/A'}
                        ${slot.appointment_id ? `<button type="button" class="edit-service-btn" data-appointment-id="${slot.appointment_id}">✏️</button>` : ''}
                    </div>
                    <div>
                        <strong>🔖 Confirmation:</strong> ${slot.confirmation_id || 'N/A'}
                    </div>
                </div>
                <div class="button-container">
                    ${status === 'available' ? '<button type="button" class="book-button">📞 Book Appointment</button>' : ''}
                    <button type="button" class="toggle-button" data-slot-time="${slot.time_slot}">${buttonText}</button>
                    <button type="button" class="delete-button" data-slot-time="${slot.time_slot}">🗑️ Delete</button>
                </div>
                ${status === 'available' ? `
                <div class="slot-details book-form">
                    <div><input type="text" placeholder="Customer Name" class="book-name" required /></div>
                    <div><input type="email" placeholder="Customer Email" class="book-email" required /></div>
                    <div><input type="tel" placeholder="Customer Phone" class="book-phone" required /></div>
                    <div>
                        <select class="book-service" required>
                            <option value="" disabled selected>Select a service</option>
                            ${SERVICE_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                    </div>
                    <div class="button-container">
                        <button type="button" class="book-confirm-button">Confirm Booking</button>
                        <button type="button" class="book-cancel-button">Cancel</button>
                    </div>
                </div>
                ` : ''}
            `;

            // Toggle availability
            const toggleButton = slotElement.querySelector('.toggle-button');
            toggleButton.addEventListener('click', () => toggleSlotAvailability(slot.time_slot, !slot.is_available));

            // Delete slot
            const deleteButton = slotElement.querySelector('.delete-button');
            deleteButton.addEventListener('click', () => deleteSlot(slot.time_slot));

            // Book an available slot for a phone-in customer
            const bookButton = slotElement.querySelector('.book-button');
            const bookForm = slotElement.querySelector('.book-form');
            if (bookButton && bookForm) {
                bookButton.addEventListener('click', () => {
                    bookForm.style.display = bookForm.style.display === 'block' ? 'none' : 'block';
                });

                bookForm.querySelector('.book-cancel-button').addEventListener('click', () => {
                    bookForm.style.display = 'none';
                });

                bookForm.querySelector('.book-confirm-button').addEventListener('click', () =>
                    bookSlotForCustomer(slot.time_slot, bookForm)
                );
            }

            // Edit individual fields - ALL slots are now editable
            const editNameBtn = slotElement.querySelector('.edit-name-btn');
            if (editNameBtn) {
                editNameBtn.addEventListener('click', () => editField(slot.appointment_id, 'name', slot.name));
            }

            const editEmailBtn = slotElement.querySelector('.edit-email-btn');
            if (editEmailBtn) {
                editEmailBtn.addEventListener('click', () => editField(slot.appointment_id, 'email', slot.email));
            }

            const editPhoneBtn = slotElement.querySelector('.edit-phone-btn');
            if (editPhoneBtn) {
                editPhoneBtn.addEventListener('click', () => editField(slot.appointment_id, 'phone', slot.phone));
            }

            const editServiceBtn = slotElement.querySelector('.edit-service-btn');
            if (editServiceBtn) {
                editServiceBtn.addEventListener('click', () => editField(slot.appointment_id, 'service', slot.service));
            }

            slotsListContainer.appendChild(slotElement);
        });
    }

    async function bookSlotForCustomer(timeSlot, bookForm) {
        const selectedDate = slotDateInput.value;
        if (!selectedDate) return;

        const name = bookForm.querySelector('.book-name').value.trim();
        const email = bookForm.querySelector('.book-email').value.trim();
        const phone = bookForm.querySelector('.book-phone').value.trim();
        const service = bookForm.querySelector('.book-service').value;

        if (!name || !email || !phone || !service) {
            alert('Please fill in name, email, phone, and service.');
            return;
        }

        const confirmButton = bookForm.querySelector('.book-confirm-button');
        confirmButton.disabled = true;
        confirmButton.textContent = 'Booking...';

        try {
            const response = await fetch('/api/admin/book-appointment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, service, date: selectedDate, slot: timeSlot })
            });

            const result = await response.json();

            if (response.ok) {
                alert(`Appointment booked. Confirmation ID: ${result.confirmationId}`);
                const slots = await fetchAdminSlots(selectedDate);
                renderSlots(slots);
            } else {
                alert(result.error || 'Error booking appointment');
                confirmButton.disabled = false;
                confirmButton.textContent = 'Confirm Booking';
            }
        } catch (error) {
            console.error('Error booking appointment:', error);
            alert('Error booking appointment');
            confirmButton.disabled = false;
            confirmButton.textContent = 'Confirm Booking';
        }
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
        
        if (!confirm(`Delete slot ${convertTo12HourFormat(timeSlot)}?`)) return;

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

    async function editField(appointmentId, fieldName, currentValue) {
        const fieldLabel = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
        const newValue = prompt(`Enter new ${fieldLabel}:`, currentValue);
        
        if (newValue === null || newValue === currentValue) return;

        try {
            // Get current appointment data
            const slots = await fetchAdminSlots(slotDateInput.value);
            const slot = slots.find(s => s.appointment_id === appointmentId);
            
            if (!slot) {
                alert('Appointment not found');
                return;
            }

            // Prepare updated data
            const updateData = {
                name: slot.name,
                email: slot.email,
                phone: slot.phone,
                service: slot.service
            };
            updateData[fieldName] = newValue;

            const response = await fetch(`/api/admin/appointments/${appointmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                alert(`${fieldLabel} updated successfully`);
                const updatedSlots = await fetchAdminSlots(slotDateInput.value);
                renderSlots(updatedSlots);
            } else {
                alert(`Error updating ${fieldLabel}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert(`Error updating ${fieldLabel}`);
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
