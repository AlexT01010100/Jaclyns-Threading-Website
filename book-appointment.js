import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-app.js';
import { getFirestore, doc, getDoc, updateDoc, deleteField } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-firestore.js';

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

    // Initialize Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyBDPBRPGG2-FCnqX_mI8C2oyhBzrFuMql0",
        authDomain: "jaclyns-threading.firebaseapp.com",
        projectId: "jaclyns-threading",
        storageBucket: "jaclyns-threading.appspot.com",
        messagingSenderId: "599625407213",
        appId: "1:599625407213:web:8ee84fd1a0c4e74d474ae4",
        measurementId: "G-HSF7B83VYH"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    let selectedDate = null;
    let selectedService = null;
    let availableSlots = [];
    let selectedSlotId = null;

    // Function to format time from 24-hour to 12-hour format
    function formatTimeTo12Hour(timeString) {
        const [hour, minute] = timeString.split(':').map(Number);
        if (isNaN(hour) || isNaN(minute)) {
            return "Invalid Time";
        }
        const period = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12; // Convert 0 to 12 for midnight
        return `${formattedHour}:${minute.toString().padStart(2, '0')} ${period}`;
    }

    // Function to fetch available slots for a specific date
    async function fetchAvailableSlotsForDate(date) {
        console.log("Fetching available slots for date:", date);

        const availabilityRef = doc(db, "availability", date);

        try {
            const docSnapshot = await getDoc(availabilityRef);

            if (docSnapshot.exists()) {
                const availableSlotsData = docSnapshot.data().availableSlots || {};

                if (Object.keys(availableSlotsData).length > 0) {
                    const slotsArray = Object.keys(availableSlotsData).map(slotId => ({
                        id: slotId,
                        time: availableSlotsData[slotId]
                    })).sort((a, b) => new Date(`${date}T${a.time}:00`) - new Date(`${date}T${b.time}:00`)); // Sort slots by time

                    // Return slots with formatted times
                    return slotsArray.map(slot => ({
                        id: slot.id,
                        time: formatTimeTo12Hour(slot.time)
                    }));
                } else {
                    console.log("No available slots found for date:", date);
                    return [];
                }
            } else {
                console.log("Document does not exist for date:", date);
                return [];
            }
        } catch (error) {
            console.error("Error fetching document:", error);
            throw error;
        }
    }

    // Function to filter slots for microblading
    function filterSlotsForMicroblading(slots) {
        if (slots.length === 0) return [];

        // Convert formatted slot times to Date objects for easier manipulation
        const timeSlots = slots.map(slot => {
            const [time, period] = slot.time.split(' ');
            const [hour, minute] = time.split(':').map(Number);

            let hours24 = hour;
            if (period === 'PM' && hour !== 12) {
                hours24 += 12;
            } else if (period === 'AM' && hour === 12) {
                hours24 = 0;
            }

            return new Date(1970, 0, 1, hours24, minute); // Use a fixed date for comparison
        }).filter(date => date !== null);

        // Sort slots by time
        timeSlots.sort((a, b) => a - b);

        const availableBlocks = [];
        const slotCount = timeSlots.length;

        // Helper function to check if a given time is available
        function isSlotAvailable(time) {
            return timeSlots.some(slot => slot.getTime() === time.getTime());
        }

        // Check each slot to see if it can be the start of a 3-hour block
        for (let i = 0; i < slotCount; i++) {
            const startSlot = timeSlots[i];
            let endSlot = new Date(startSlot.getTime() + 3 * 60 * 60 * 1000); // 3 hours later

            let currentSlot = new Date(startSlot.getTime());
            let isBlockAvailable = true;

            // Check for continuous 30-minute slots
            while (currentSlot < endSlot) {
                const timeKey = formatTimeTo12Hour(currentSlot.toTimeString().slice(0, 5));
                const slotAvailable = isSlotAvailable(currentSlot);

                if (!slotAvailable) {
                    isBlockAvailable = false;
                    break;
                }
                currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000); // Increment by 30 minutes
            }

            if (isBlockAvailable) {
                availableBlocks.push({
                    start: formatTimeTo12Hour(startSlot.toTimeString().slice(0, 5)) // Use the new format
                });
            }
        }

        // Return only starting times
        return availableBlocks.map(block => ({
            id: block.start, // Unique ID for the starting time
            time: block.start // Only display the start time
        }));
    }

    // Function to render available slots
    function renderSlots(slots) {
        timeSlotsContainer.innerHTML = "";

        if (slots.length === 0) {
            timeSlotsContainer.innerHTML = "<p>No available slots for the selected service.</p>";
            return;
        }

        slots.forEach(slot => {
            const slotElement = document.createElement("div");
            slotElement.classList.add("slot-item");
            slotElement.setAttribute("data-slot-id", slot.id);

            slotElement.innerHTML = `
            <p><strong>Time:</strong> ${slot.time}</p>
            <button class="select-button" data-slot-id="${slot.id}">Select Slot</button>
            <hr>
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

    // Function to toggle slot selection
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

    // Function to check if both date and service are selected and update available slots
    function updateAvailableSlots() {
        if (selectedDate && selectedService) {
            fetchAvailableSlotsForDate(selectedDate).then(slots => {
                if (selectedService === 'microblading') {
                    slots = filterSlotsForMicroblading(slots);
                }
                renderSlots(slots);
            }).catch(error => {
                console.error("Error fetching available slots:", error);
                timeSlotsContainer.innerHTML = "<p>Error fetching available slots.</p>";
            });
        }
    }

    // Event listener for date input
    dateInput.addEventListener("change", function () {
        selectedDate = dateInput.value;
        console.log("Date input changed, selected date:", selectedDate);
        updateAvailableSlots();
    });

    // Event listener for service select
    serviceSelect.addEventListener("change", function () {
        selectedService = serviceSelect.value;
        console.log("Service select changed, selected service:", selectedService);
        updateAvailableSlots();
    });

    async function deleteAppointments(service) {
        try {
            const availabilityRef = doc(db, "availability", selectedDate);
            const slotDoc = await getDoc(availabilityRef);

            if (!slotDoc.exists()) {
                console.error("No such document!");
                return;
            }

            const availableSlotsData = slotDoc.data().availableSlots || {};
            console.log("Available Slots Data:", availableSlotsData);

            if (Object.keys(availableSlotsData).length === 0) {
                console.log("No available slots found for the selected date.");
                return;
            }

            const updates = {};

            if (service === 'threading') {
                if (selectedSlotId) {
                    console.log(`Preparing to delete selected slot ${selectedSlotId} for threading service.`);
                    updates[`availableSlots.${selectedSlotId}`] = deleteField();
                }
            } else if (service === 'microblading') {
                if (selectedSlotId) {
                    const slotParts = selectedSlotId.split(' ');
                    const slotTime = slotParts[0]; // Extract time in HH:MM format
                    const slotPeriod = (slotParts[1] || '').trim(); // AM or PM, with extra spaces removed

                    // Validate and parse time
                    const [hours, minutes] = slotTime.split(':').map(Number);
                    if (isNaN(hours) || isNaN(minutes)) {
                        console.error("Invalid time format:", slotTime);
                        return;
                    }

                    // Convert 12-hour time to 24-hour format
                    let hours24 = hours;
                    if (slotPeriod === 'PM' && hours !== 12) {
                        hours24 += 12;
                    } else if (slotPeriod === 'AM' && hours === 12) {
                        hours24 = 0;
                    }

                    const startSlotTime = new Date(`1970-01-01T${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`);
                    const endSlotTime = new Date(startSlotTime.getTime() + 3 * 60 * 60 * 1000); // 3 hours later

                    let currentSlotTime = new Date(startSlotTime);

                    while (currentSlotTime < endSlotTime) {
                        const hours24Formatted = String(currentSlotTime.getUTCHours()).padStart(2, '0');
                        const minutes24Formatted = String(currentSlotTime.getUTCMinutes()).padStart(2, '0');
                        const slotIdToMatch = `slot_${hours24Formatted}:${minutes24Formatted}_`;

                        const matchingSlotIds = Object.keys(availableSlotsData).filter(key => key.startsWith(slotIdToMatch));
                        console.log("Matching Slot IDs:", matchingSlotIds);

                        matchingSlotIds.forEach(matchingSlotId => {
                            updates[`availableSlots.${matchingSlotId}`] = deleteField();
                        });

                        currentSlotTime = new Date(currentSlotTime.getTime() + 30 * 60 * 1000); // Increment by 30 minutes
                    }
                }
            }

            console.log("Updates Object:", updates);

            if (Object.keys(updates).length > 0) {
                await updateDoc(availabilityRef, updates);
                console.log(`Appointments for service ${service} updated.`);

                // Fetch and render updated slots
                availableSlots = await fetchAvailableSlotsForDate(selectedDate);
                if (selectedService === 'microblading') {
                    availableSlots = filterSlotsForMicroblading(availableSlots);
                }
                renderSlots(availableSlots);
            } else {
                console.log("No slots to update.");
            }
        } catch (error) {
            console.error("Error deleting appointments:", error);
        }
    }


    // Handle form submission
    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!selectedService) {
            console.error("No service selected");
            messageDiv.textContent = "Please select a service.";
            return;
        }

        if (selectedSlotId) {
            await deleteAppointments(selectedService);
            messageDiv.textContent = `Appointment booked for slot ${selectedSlotId}.`;
        } else {
            console.error("No slot selected");
            messageDiv.textContent = "Please select a time slot.";
        }
    });
});