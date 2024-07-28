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
                    }));

                    console.log("Available Slots:", slotsArray);
                    return slotsArray;
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

    // Function to render available slots
    function renderSlots(slots) {
        timeSlotsContainer.innerHTML = "";

        slots.forEach(slot => {
            if (slot.id !== 'booked') {
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
            }
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
                if (slots.length > 0) {
                    renderSlots(slots);
                } else {
                    timeSlotsContainer.innerHTML = "<p>No available slots for selected date and service.</p>";
                }
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

    // Function to delete appointments based on service
    async function deleteAppointments(service) {
        try {
            const availabilityRef = doc(db, "availability", selectedDate);
            const slotDoc = await getDoc(availabilityRef);

            if (!slotDoc.exists()) {
                console.error("No such document!");
                return;
            }

            const availableSlotsData = slotDoc.data().availableSlots || {};

            // Log available slots data for debugging
            console.log("Available Slots Data:", availableSlotsData);

            if (Object.keys(availableSlotsData).length === 0) {
                console.log("No available slots found for the selected date.");
                return;
            }

            const updates = {};
            const slotDurationInHours = 3; // Microblading: 3 hours

            // Convert selectedDate to a Date object
            const selectedDateObj = new Date(selectedDate);

            // If service is microblading, use the selectedSlotId's time to determine which slots to delete
            if (service === 'microblading') {
                if (!selectedSlotId) {
                    console.error("No slot selected for microblading.");
                    return;
                }

                // Get the time for the selected slot
                const selectedSlot = availableSlotsData[selectedSlotId];
                const selectedSlotDateTimeStr = `${selectedDate}T${selectedSlot}:00`; // Assume slot is in HH:MM format
                const selectedSlotTime = new Date(selectedSlotDateTimeStr);

                // Ensure slotTime is a valid date
                if (isNaN(selectedSlotTime.getTime())) {
                    console.error(`Invalid slot time for slotId ${selectedSlotId}: ${selectedSlotDateTimeStr}`);
                    return;
                }

                // Calculate end time which is 3 hours from the selected slot
                const endTime = new Date(selectedSlotTime.getTime() + slotDurationInHours * 60 * 60 * 1000);

                // Log values for debugging
                console.log(`Selected Slot Time: ${selectedSlotTime}`);
                console.log(`End Time: ${endTime}`);

                Object.keys(availableSlotsData).forEach(slotId => {
                    const slotTimeStr = availableSlotsData[slotId];

                    // Construct full date-time string
                    const slotDateTimeStr = `${selectedDate}T${slotTimeStr}:00`; // Assume slotTimeStr is in HH:MM format
                    const slotTime = new Date(slotDateTimeStr);

                    // Ensure slotTime is a valid date
                    if (isNaN(slotTime.getTime())) {
                        console.error(`Invalid slot time for slotId ${slotId}: ${slotDateTimeStr}`);
                        return;
                    }

                    // Check if slot is within the 3-hour window
                    if (slotTime >= selectedSlotTime && slotTime <= endTime) {
                        console.log(`Preparing to delete slot ${slotId} for microblading service.`);
                        updates[`availableSlots.${slotId}`] = deleteField();
                    }
                });
            } else if (service === 'threading') {
                if (selectedSlotId) {
                    console.log(`Preparing to delete selected slot ${selectedSlotId} for threading service.`);
                    updates[`availableSlots.${selectedSlotId}`] = deleteField();
                }
            }

            // Log the updates object
            console.log("Updates Object:", updates);

            if (Object.keys(updates).length > 0) {
                await updateDoc(availabilityRef, updates);
                console.log(`Appointments for service ${service} updated.`);

                // Fetch updated slots
                availableSlots = await fetchAvailableSlotsForDate(selectedDate);
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
