
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, deleteField } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-firestore.js';

document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM fully loaded and parsed");

    const slotForm = document.getElementById("slotForm");
    const slotDateInput = document.getElementById("slotDate");
    const slotTimeInput = document.getElementById("slotTime");
    const slotsListContainer = document.getElementById("slotsList");

    if (!slotForm || !slotDateInput || !slotTimeInput || !slotsListContainer) {
        console.error("One or more elements not found in the DOM");
        return;
    }

    console.log("slotForm, slotDateInput, slotTimeInput, and slotsListContainer elements found");

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

    // Function to fetch active slots for a specific date
    async function fetchActiveSlotsForDate(selectedDate) {
        console.log("Fetching active slots for date:", selectedDate);

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

                    console.log("Active Slots:", slotsArray);
                    return slotsArray;
                } else {
                    console.log("No active slots found for date:", selectedDate);
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

    // Display active slots based on selected date
    slotDateInput.addEventListener("change", async function () {
        selectedDate = slotDateInput.value;
        console.log("Date input changed, selected date:", selectedDate);

        if (!selectedDate) {
            console.error("Selected date is empty");
            return;
        }

        try {
            const activeSlots = await fetchActiveSlotsForDate(selectedDate);

            if (activeSlots.length > 0) {
                renderSlots(activeSlots);
            } else {
                slotsListContainer.innerHTML = "<p>No active slots for selected date.</p>";
            }
        } catch (error) {
            console.error("Error fetching active slots:", error);
            slotsListContainer.innerHTML = "<p>Error fetching active slots.</p>";
        }
    });

    // Function to render active slots
    function renderSlots(slots) {
        slotsListContainer.innerHTML = "";

        slots.forEach(slot => {
            const slotElement = document.createElement("div");
            slotElement.classList.add("slot-item");

            slotElement.innerHTML = `
                  <p><strong>Time:</strong> ${slot.time}</p>
                  <button class="delete-button" data-slot-id="${slot.id}">Delete Slot</button>
                  <hr>
              `;

            // Add event listener to delete button
            const deleteButton = slotElement.querySelector('.delete-button');
            deleteButton.addEventListener('click', async (event) => {
                event.preventDefault(); // Prevent form submission
                await deleteSlot(slot.id); // Call deleteSlot function on click
            });

            slotsListContainer.appendChild(slotElement);
        });
    }

    // Function to add a new time slot
    slotForm.addEventListener('submit', async function (event) {
        event.preventDefault(); // Prevent form submission

        const slotDate = slotDateInput.value;
        const slotTime = slotTimeInput.value;

        if (slotDate && slotTime) {
            try {
                const availabilityRef = doc(db, "availability", slotDate);
                const docSnapshot = await getDoc(availabilityRef);

                if (docSnapshot.exists()) {
                    const availableSlotsData = docSnapshot.data().availableSlots;

                    // Generate a unique ID for the new slot
                    const newSlotId = `slot_${Date.now()}`;

                    // Add the new slot to the available slots
                    availableSlotsData[newSlotId] = slotTime;

                    await setDoc(availabilityRef, { availableSlots: availableSlotsData }, { merge: true });
                } else {
                    const availableSlotsData = {
                        [`slot_${Date.now()}`]: slotTime
                    };

                    await setDoc(availabilityRef, { availableSlots: availableSlotsData });
                }

                console.log(`Time slot ${slotTime} added for date ${slotDate}.`);

                // Optionally, re-fetch and re-render slots after adding new slot
                const activeSlots = await fetchActiveSlotsForDate(slotDate);
                renderSlots(activeSlots);
            } catch (error) {
                console.error("Error adding time slot:", error);
            }
        } else {
            console.error("Date or time input is empty");
        }
    });

    // Function to delete a slot
    async function deleteSlot(slotId) {
        try {
            const availabilityRef = doc(db, "availability", selectedDate);
            const slotDoc = await getDoc(availabilityRef);

            if (slotDoc.exists()) {
                const availableSlotsData = slotDoc.data().availableSlots;

                // Check if slotId exists in availableSlotsData
                if (availableSlotsData[slotId]) {
                    delete availableSlotsData[slotId]; // Delete the slot from availableSlotsData

                    await setDoc(availabilityRef, { availableSlots: availableSlotsData }, { merge: true });

                    console.log(`Slot ${slotId} deleted.`);

                    // Optionally, re-fetch and re-render slots after deletion
                    const activeSlots = await fetchActiveSlotsForDate(selectedDate);
                    renderSlots(activeSlots);
                } else {
                    console.log(`Slot ${slotId} does not exist.`);
                }
            } else {
                console.log(`No availability document found for date ${selectedDate}.`);
            }
        } catch (error) {
            console.error("Error deleting slot:", error);
        }
    }
});