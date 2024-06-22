import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-app.js';
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-firestore.js';

document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM fully loaded and parsed");

    const form = document.getElementById("appointment-form");
    const timeSlotsContainer = document.getElementById("time-slots");
    const dateInput = document.getElementById("date");
    const messageDiv = document.getElementById("message");

    if (!form || !timeSlotsContainer || !dateInput || !messageDiv) {
        console.error("One or more elements not found in the DOM");
        return;
    }

    console.log("Form, timeSlotsContainer, and dateInput elements found");

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

    let selectedDate = null; // Variable to store selected date
    let availableSlots = []; // Array to store available slots
    let selectedSlotId = null; // Variable to store selected slot ID

    // Function to fetch available slots for a specific date
    async function fetchAvailableSlotsForDate(selectedDate) {
        console.log("Fetching available slots for date:", selectedDate);

        const availabilityRef = doc(db, "availability", selectedDate);

        try {
            const docSnapshot = await getDoc(availabilityRef);

            if (docSnapshot.exists()) {
                const availableSlotsData = docSnapshot.data().availableSlots;

                if (availableSlotsData) {
                    // Convert availableSlots object into an array of objects
                    const slotsArray = Object.keys(availableSlotsData).map(slotId => ({
                        id: slotId,
                        time: availableSlotsData[slotId]
                    }));

                    console.log("Available Slots:", slotsArray);
                    return slotsArray;
                } else {
                    console.log("No available slots found for date:", selectedDate);
                    return [];
                }
            } else {
                console.log("Document does not exist for date:", selectedDate);
                return [];
            }
        } catch (error) {
            console.error("Error fetching document:", error);
            throw error;
        }
    }

    // Display available slots based on selected date
    dateInput.addEventListener("change", async function () {
        selectedDate = dateInput.value;
        console.log("Date input changed, selected date:", selectedDate);

        if (!selectedDate) {
            console.error("Selected date is empty");
            return;
        }

        try {
            availableSlots = await fetchAvailableSlotsForDate(selectedDate);

            if (availableSlots.length > 0) {
                renderSlots(availableSlots);
            } else {
                timeSlotsContainer.innerHTML = "<p>No available slots for selected date.</p>";
            }
        } catch (error) {
            console.error("Error fetching available slots:", error);
            timeSlotsContainer.innerHTML = "<p>Error fetching available slots.</p>";
        }
    });

    // Function to render available slots
    function renderSlots(slots) {
        timeSlotsContainer.innerHTML = "";

        slots.forEach(slot => {
            if (slot.id !== 'booked') { // Check if slot is not already booked
                const slotElement = document.createElement("div");
                slotElement.classList.add("slot-item");

                // Display slot.time initially
                slotElement.innerHTML = `
                    <p><strong>Time:</strong> ${slot.time}</p>
                    <button class="select-button" data-slot-id="${slot.id}">Select Slot</button> <!-- Add a button to select the slot -->
                    <hr>
                `;

                // Add event listener to select button
                const selectButton = slotElement.querySelector('.select-button');
                selectButton.addEventListener('click', (event) => {
                    event.preventDefault(); // Prevent form submission
                    selectedSlotId = slot.id; // Update selected slot ID
                    toggleSlotSelection(slot.id); // Call toggleSlotSelection function on click
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

    // Function to book a slot
    async function bookSlot(slotId) {
        try {
            const availabilityRef = doc(db, "availability", selectedDate); // Replace with the correct document ID

            const slotDoc = await getDoc(availabilityRef);
            const availableSlotsData = slotDoc.data().availableSlots;

            // Check if slotId exists in availableSlotsData
            if (availableSlotsData[slotId]) {
                // Create a new object with 'booked' as key and slotTime as value
                const updatedSlots = { ...availableSlotsData }; // Create a copy of availableSlotsData
                updatedSlots.booked = availableSlotsData[slotId]; // Set 'booked' key
                delete updatedSlots[slotId]; // Delete the old slotId key

                // Update Firestore document with updated object
                await updateDoc(availabilityRef, { availableSlots: updatedSlots });

                console.log(`Slot ${slotId} marked as booked and old entry deleted.`);

                // Optionally, re-fetch and re-render slots after update
                availableSlots = availableSlots.filter(slot => slot.id !== slotId); // Remove booked slot from availableSlots array
                renderSlots(availableSlots);
            } else {
                console.log(`Slot ${slotId} is already booked.`);
            }
        } catch (error) {
            console.error("Error marking slot as booked and deleting old entry:", error);
        }
    }

    // Handle form submission
    form.addEventListener('submit', async function (event) {
        event.preventDefault(); // Prevent form submission

        // Ensure a slot is selected
        if (selectedSlotId) {
            await bookSlot(selectedSlotId);
            messageDiv.textContent = `Appointment booked for slot ${selectedSlotId}.`;
        } else {
            console.error("No slot selected");
            messageDiv.textContent = "Please select a time slot.";
        }
    });

});
