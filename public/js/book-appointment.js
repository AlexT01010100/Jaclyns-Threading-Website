document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM fully loaded and parsed");
    const form = document.getElementById("appointment-form");
    const timeSlotsContainer = document.getElementById("time-slots");
    const dateInput = document.getElementById("date");
    const messageDiv = document.getElementById("message");
    const serviceSelect = document.getElementById("service");

    if (!form || !timeSlotsContainer || !dateInput || !messageDiv || !serviceSelect) {
        console.error("One or more elements not found in the DOM");
        return;
    }

    let selectedDate = null;
    let selectedService = null;
    let selectedSlotId = null;

    function setMinDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const minDate = `${year}-${month}-${day}`;
        dateInput.setAttribute('min', minDate);
    }

    setMinDate();

    function parseTimeTo24Hour(timeString) {
        const [time, period] = timeString.split(' ');
        let [hour, minute] = time.split(':').map(Number);

        if (period === 'PM' && hour !== 12) {
            hour += 12;
        } else if (period === 'AM' && hour === 12) {
            hour = 0;
        }

        return new Date(1970, 0, 1, hour, minute);
    }

    function formatTimeTo12Hour(time) {
        const hour = time.getHours();
        const minute = time.getMinutes();
        const period = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12;
        return `${formattedHour}:${minute.toString().padStart(2, '0')} ${period}`;
    }

    async function fetchAvailableSlotsForDate(date) {
        console.log("Fetching available slots for date:", date);

        try {
            const response = await fetch(`/api/available-slots/${date}`);
            if (!response.ok) {
                throw new Error('Failed to fetch available slots');
            }
            
            const slots = await response.json();
            console.log("Fetched slots from server:", slots);
            console.log("Number of slots:", slots.length);
            
            // Log each slot's availability status
            slots.forEach(slot => {
                console.log(`Slot ${slot.time_slot}: is_available = ${slot.is_available}`);
            });
            
            return slots;
        } catch (error) {
            console.error("Error fetching available slots:", error);
            throw error;
        }
    }

    function filterSlotsForService(slots, service) {
        console.log("Filtering slots for service:", service);
        console.log("Input slots:", slots.length);
        
        if (slots.length === 0) {
            console.log("No slots to filter");
            return [];
        }

        // First, filter out any unavailable slots (safety check)
        // The server should already only send available slots, but double-check
        const availableSlots = slots.filter(slot => {
            const isAvailable = slot.is_available === true;
            if (!isAvailable) {
                console.warn("Found unavailable slot in response:", slot);
            }
            return isAvailable;
        });
        
        console.log("After availability filter:", availableSlots.length, "slots");
        
        if (availableSlots.length === 0) {
            console.log("No available slots after filtering");
            return [];
        }

        // Define durations for different services (in milliseconds)
        // Each service blocks out consecutive time slots based on its duration
        const serviceDurations = {
            // Threading services - 30 minutes each
            'threading - eyebrows ($14)': 0.5 * 60 * 60 * 1000,
            'threading - upper lip ($7)': 0.5 * 60 * 60 * 1000,
            'threading - lower lip ($6)': 0.5 * 60 * 60 * 1000,
            'threading - chin ($8)': 0.5 * 60 * 60 * 1000,
            'threading - neck ($8)': 0.5 * 60 * 60 * 1000,
            'threading - forehead ($7)': 0.5 * 60 * 60 * 1000,
            'threading - sideburns ($12)': 0.5 * 60 * 60 * 1000,
            'threading - fullface special ($38)': 1 * 60 * 60 * 1000, // 1 hour for full face
            
            // Permanent Makeup - 2-3 hours
            'microblading ($380)': 2.5 * 60 * 60 * 1000,
            'machine hair strokes ($395)': 2.5 * 60 * 60 * 1000,
            
            // Lash services - 45-60 minutes
            'lash lift + tint ($150)': 1 * 60 * 60 * 1000,
            'lash tint ($25)': 0.5 * 60 * 60 * 1000,
            
            // Brow services - 45-60 minutes
            'brow lamination + tint ($120)': 1 * 60 * 60 * 1000,
            'brow tint ($18)': 0.5 * 60 * 60 * 1000,
            
            // Microneedling - 60-90 minutes
            'microneedling ($250)': 1.5 * 60 * 60 * 1000,
            'microneedling + nano brows ($390)': 2 * 60 * 60 * 1000,
            'phibright microneedling ($270)': 1.5 * 60 * 60 * 1000,
            
            // Bioneedling - 60-90 minutes
            'bioneedling ($220)': 1.5 * 60 * 60 * 1000
        };

        const duration = serviceDurations[service.toLowerCase()] || 1 * 60 * 60 * 1000;

        // Convert slot times to Date objects and sort them
        const timeSlots = availableSlots
            .map(slot => ({
                time: parseTimeTo24Hour(slot.time_slot),
                original: slot.time_slot
            }))
            .sort((a, b) => a.time - b.time);

        console.log("Available time slots for service:", timeSlots);

        const availableBlocks = [];

        function isSlotAvailable(time) {
            return timeSlots.some(slot => 
                slot.time.getTime() === time.getTime()
            );
        }

        for (let i = 0; i < timeSlots.length; i++) {
            const startSlot = timeSlots[i].time;
            let endSlot = new Date(startSlot.getTime() + duration);

            let currentSlot = new Date(startSlot.getTime());
            let isBlockAvailable = true;

            while (currentSlot < endSlot) {
                if (!isSlotAvailable(currentSlot)) {
                    isBlockAvailable = false;
                    break;
                }
                currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000);
            }

            if (isBlockAvailable) {
                availableBlocks.push({
                    id: timeSlots[i].original,
                    time: timeSlots[i].original
                });
            }
        }

        console.log("Available blocks for service:", availableBlocks);
        return availableBlocks;
    }

    function renderSlots(slots) {
        timeSlotsContainer.innerHTML = "";

        if (slots.length === 0) {
            timeSlotsContainer.innerHTML = "<div class=\"no-slots-wrapper\"><div class='no-slots-message'>No available slots for the selected service.</div></div>";
            return;
        }

        slots.forEach(slot => {
            const slotElement = document.createElement("div");
            slotElement.classList.add("slot-item");
            slotElement.setAttribute("data-slot-id", slot.id);

            slotElement.innerHTML = `
                <p>${slot.time}</p>
                <button class="select-button" data-slot-id="${slot.id}">Select Slot</button>
                <hr class="time-slots-hr">
            `;

            const selectButton = slotElement.querySelector('.select-button');
            selectButton.addEventListener('click', (event) => {
                event.preventDefault();
                selectedSlotId = slot.id;
                toggleSlotSelection(slot.id);
            });

            timeSlotsContainer.appendChild(slotElement);
        });
    }

    function toggleSlotSelection(slotId) {
        const selectedSlot = timeSlotsContainer.querySelector('.slot-item.selected');
        if (selectedSlot) {
            selectedSlot.classList.remove('selected');
        }

        const slotElement = timeSlotsContainer.querySelector(`[data-slot-id="${slotId}"]`);
        if (slotElement) {
            slotElement.classList.add('selected');
        }
    }

    function updateAvailableSlots() {
        if (selectedDate && selectedService) {
            fetchAvailableSlotsForDate(selectedDate)
                .then(slots => {
                    // Always filter slots through the service-specific logic
                    // This ensures proper duration checking for all services
                    const filteredSlots = filterSlotsForService(slots, selectedService);
                    renderSlots(filteredSlots);
                })
                .catch(error => {
                    console.error("Error fetching available slots:", error);
                    timeSlotsContainer.innerHTML = "<p>Error fetching available slots.</p>";
                });
        }
    }

    dateInput.addEventListener("change", function () {
        selectedDate = dateInput.value;
        console.log("Date input changed, selected date:", selectedDate);
        updateAvailableSlots();
    });

    serviceSelect.addEventListener("change", function () {
        selectedService = serviceSelect.value;
        console.log("Service select changed, selected service:", selectedService);
        updateAvailableSlots();
    });

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = ''; // Clear all classes
        if (type) {
            messageDiv.classList.add(type);
        }
        // Scroll message into view
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async function bookAppointment() {
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const phone = document.getElementById("phone").value;

        if (!selectedDate || !selectedService || !selectedSlotId) {
            showMessage("Please select a date, service, and time slot.", "error");
            return;
        }

        try {
            showMessage("Booking appointment...", "");

            const response = await fetch('/book_appointment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    email,
                    phone,
                    service: selectedService,
                    date: selectedDate,
                    slot: selectedSlotId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                // Display user-friendly error message
                const errorMessage = result.error || 'Failed to book appointment. Please try selecting a different time slot.';
                throw new Error(errorMessage);
            }

            console.log("Server response:", result);
            
            showMessage(`✓ Appointment booked successfully! Your confirmation ID is: ${result.confirmationId}. Check your email for details.`, "success");

            // Reset form after successful booking
            setTimeout(() => {
                location.reload();
            }, 4000);

        } catch (error) {
            console.error("Error booking appointment:", error);
            // Show user-friendly error message
            showMessage(error.message || "Unable to book this time slot. It may have just been booked. Please select a different time.", "error");
            
            // Refresh available slots after error
            updateAvailableSlots();
        }
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (!selectedSlotId) {
            console.error("No slot selected.");
            showMessage("Please select a time slot.", "error");
            return;
        }

        if (!selectedDate || !selectedService) {
            console.error("Date or service not selected.");
            showMessage("Please select both date and service.", "error");
            return;
        }

        console.log("Form submitted with selected slotId:", selectedSlotId);
        bookAppointment();
    });
});
