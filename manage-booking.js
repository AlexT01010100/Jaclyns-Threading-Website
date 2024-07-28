import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteField } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-firestore.js';

document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM fully loaded and parsed");

    const slotForm = document.getElementById("slotForm");
    const slotDateInput = document.getElementById("slotDate");
    const slotsListContainer = document.getElementById("slotsList");
    const timeSlotsContainer = document.getElementById("timeSlots");
    const rememberButton = document.getElementById("rememberButton");

    if (!slotForm || !slotDateInput || !slotsListContainer || !timeSlotsContainer || !rememberButton) {
        console.error("One or more elements not found in the DOM");
        return;
    }

    console.log("slotForm, slotDateInput, slotsListContainer, timeSlotsContainer, and rememberButton elements found");

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

    // Set the minimum date to today
    function setMinDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const day = String(today.getDate()).padStart(2, '0');
        const minDate = `${year}-${month}-${day}`;
        slotDateInput.setAttribute('min', minDate);
    }

    setMinDate(); // Call the function to set the minimum date on page load

    // Function to convert time from 24-hour to AM/PM format
    function convertTo12HourFormat(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12; // Convert hour to 12-hour format
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    // Function to convert time from AM/PM to 24-hour format
    function convertTo24HourFormat(time) {
        const [timePart, period] = time.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);

        if (period === 'PM' && hours !== 12) {
            hours += 12;
        } else if (period === 'AM' && hours === 12) {
            hours = 0;
        }

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Function to generate time slots in AM/PM format
    function generateTimeSlots() {
        const startTime = 8; // 8 AM
        const endTime = 19; // 7 PM
        const interval = 30; // 30 minutes

        for (let hour = startTime; hour <= endTime; hour++) {
            for (let minute = 0; minute < 60; minute += interval) {
                let timeLabel24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                let timeLabel12 = convertTo12HourFormat(timeLabel24);
                let timeSlot = document.createElement('div');
                timeSlot.className = 'time-slot';
                timeSlot.innerHTML = `
                    <input type="checkbox" id="${timeLabel12}" name="timeSlots" value="${timeLabel12}">
                    <label for="${timeLabel12}">${timeLabel12}</label>
                `;
                timeSlotsContainer.appendChild(timeSlot);
            }
        }
    }

    // Function to get the weekday from a date
    function getWeekday(dateString) {
        const date = new Date(dateString);
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return weekdays[date.getDay()];
    }

    // Function to fetch active slots for a specific date
    async function fetchActiveSlotsForDate(date) {
        console.log("Fetching active slots for date:", date);

        const availabilityRef = doc(db, "availability", date);

        try {
            const docSnapshot = await getDoc(availabilityRef);

            if (docSnapshot.exists()) {
                const availableSlotsData = docSnapshot.data().availableSlots;

                if (availableSlotsData) {
                    const slotsArray = Object.keys(availableSlotsData).map(slotId => ({
                        id: slotId,
                        time: slotId,
                        status: availableSlotsData[slotId]
                    }));

                    console.log("Active Slots retrieved:", slotsArray);
                    return slotsArray;
                } else {
                    console.log("No available slots data found for date:", date);
                    return [];
                }
            } else {
                console.log("Document does not exist for date:", date);
                return [];
            }
        } catch (error) {
            console.error("Error fetching document:", error);
            return []; // Return empty array in case of error
        }
    }

    // Display active slots based on selected date
    slotDateInput.addEventListener("change", async function () {
        const selectedDate = slotDateInput.value;
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

    function renderSlots(slots) {
        slotsListContainer.innerHTML = "";

        if (slots.length === 0) {
            slotsListContainer.innerHTML = "<p>No active slots available.</p>";
            return;
        }

        // Convert time from 12-hour to 24-hour format for sorting
        const slotsWithTimes = slots.map(slot => {
            return {
                ...slot,
                time24: convertTo24HourFormat(slot.time)
            };
        });

        // Sort slots by time in 24-hour format
        slotsWithTimes.sort((a, b) => {
            return a.time24.localeCompare(b.time24);
        });

        // Render sorted slots
        slotsWithTimes.forEach(slot => {
            const slotElement = document.createElement("div");
            slotElement.classList.add("slot-item");

            // Determine button text based on slot status
            const buttonText = slot.status === "booked" ? "Mark as Unbooked" : "Mark as Booked";

            slotElement.innerHTML = `
            <div>
                <p><strong>Time:</strong> ${slot.time}</p>
                <p><strong>Status:</strong> ${slot.status}</p>
            </div>
            <div class="button-container">
                <button type="button" class="book-button" data-slot-id="${slot.id}">${buttonText}</button>
                <button type="button" class="delete-button" data-slot-id="${slot.id}">Delete Slot</button>
            </div>
        `;

            // Add event listener to book button
            const bookButton = slotElement.querySelector('.book-button');
            bookButton.addEventListener('click', async (event) => {
                event.preventDefault(); // Prevent form submission and page reload
                console.log(`Book button clicked for slot ${slot.id}`);
                await toggleBookingStatus(slot.id); // Call toggleBookingStatus function on click
            });

            // Add event listener to delete button
            const deleteButton = slotElement.querySelector('.delete-button');
            deleteButton.addEventListener('click', async (event) => {
                event.preventDefault(); // Prevent form submission and page reload
                console.log(`Delete button clicked for slot ${slot.id}`);
                await deleteSlot(slot.id); // Call deleteSlot function on click
            });

            slotsListContainer.appendChild(slotElement);
        });
    }

    // Function to toggle booking status of a slot
    async function toggleBookingStatus(slotId) {
        const selectedDate = slotDateInput.value;
        if (!selectedDate) {
            console.error("No date selected");
            return;
        }

        const availabilityRef = doc(db, "availability", selectedDate);

        try {
            // Check if the document exists
            const slotDoc = await getDoc(availabilityRef);

            if (slotDoc.exists()) {
                // Check if the slot exists in the document
                const availableSlotsData = slotDoc.data().availableSlots || {};

                if (availableSlotsData[slotId]) {
                    const newStatus = availableSlotsData[slotId] === "booked" ? "unbooked" : "booked";

                    console.log(`Updating slot ${slotId} to ${newStatus} for date ${selectedDate}`);

                    // Update the slot status
                    await updateDoc(availabilityRef, {
                        [`availableSlots.${slotId}`]: newStatus
                    });

                    console.log(`Slot ${slotId} updated to ${newStatus}.`);

                    // Re-fetch and re-render slots after updating
                    const activeSlots = await fetchActiveSlotsForDate(selectedDate);
                    renderSlots(activeSlots);
                } else {
                    console.log(`Slot ${slotId} does not exist in the document.`);
                }
            } else {
                console.log(`No availability document found for date ${selectedDate}.`);
            }
        } catch (error) {
            console.error("Error updating slot:", error);
        }
    }

    // Function to add or update individual time slots
    async function addSlot(date, times) {
        if (!date || !times || times.length === 0) {
            console.error("Date or time slots input is empty");
            return;
        }

        const availabilityRef = doc(db, "availability", date);

        try {
            const docSnapshot = await getDoc(availabilityRef);
            let availableSlotsData = docSnapshot.exists() ? docSnapshot.data().availableSlots || {} : {};

            let newSlotsData = {};

            // Check each time slot
            times.forEach(time => {
                const standardizedTime = convertTo24HourFormat(time); // Convert time to 24-hour format
                const timeLabel = convertTo12HourFormat(standardizedTime); // Convert back to 12-hour format for key

                // Check if this time slot already exists
                if (!availableSlotsData[timeLabel]) {
                    newSlotsData[timeLabel] = "unbooked"; // Add to new slots data if it doesn't exist
                }
            });

            // Only update if there are new slots to add
            if (Object.keys(newSlotsData).length > 0) {
                // Merge new slots into the existing data
                availableSlotsData = { ...availableSlotsData, ...newSlotsData };

                await setDoc(availabilityRef, { availableSlots: availableSlotsData }, { merge: true });

                console.log(`Time slots ${Object.keys(newSlotsData).join(", ")} added for date ${date}.`);

                // Re-fetch and re-render slots after addition
                const activeSlots = await fetchActiveSlotsForDate(date);
                renderSlots(activeSlots);
            } else {
                console.log("No new time slots to add.");
            }
        } catch (error) {
            console.error("Error adding time slots:", error);
        }
    }

    // Function to delete a slot
    async function deleteSlot(slotId) {
        const selectedDate = slotDateInput.value;
        if (!selectedDate) {
            console.error("No date selected");
            return;
        }

        const availabilityRef = doc(db, "availability", selectedDate);

        try {
            // Check if the document exists
            const slotDoc = await getDoc(availabilityRef);

            if (slotDoc.exists()) {
                // Check if the slot exists in the document
                const availableSlotsData = slotDoc.data().availableSlots || {};

                if (availableSlotsData[slotId]) {
                    console.log(`Deleting slot ${slotId} from document for date ${selectedDate}`);

                    // Use updateDoc to delete the slot field
                    await updateDoc(availabilityRef, {
                        [`availableSlots.${slotId}`]: deleteField()
                    });

                    console.log(`Slot ${slotId} deleted.`);

                    // Re-fetch and re-render slots after deletion
                    const activeSlots = await fetchActiveSlotsForDate(selectedDate);
                    renderSlots(activeSlots);
                } else {
                    console.log(`Slot ${slotId} does not exist in the document.`);
                }
            } else {
                console.log(`No availability document found for date ${selectedDate}.`);
            }
        } catch (error) {
            console.error("Error deleting slot:", error);
        }
    }

    // Function to generate all future dates for a specific weekday
    async function getAllFutureDates(startDate, weekday) {
        const dates = [];
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekdayIndex = weekdays.indexOf(weekday);

        let currentDate = new Date(startDate);

        // Move to the next occurrence of the desired weekday
        while (currentDate.getDay() !== weekdayIndex) {
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Set end date
        const endDate = new Date("2024-12-31");

        // Collect all future dates
        while (currentDate <= endDate) {
            dates.push(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 7); // Move to the same day next week
        }

        return dates;
    }

    // Function to save availability for a weekday
    async function saveAvailabilityForWeekday(date, times) {
        const weekday = getWeekday(date);
        const futureDates = await getAllFutureDates(new Date(date), weekday);

        for (const futureDate of futureDates) {
            await addSlot(futureDate, times);
        }
    }

    // Function to delete all slots for a specific date
    async function deleteAllSlots(date) {
        const availabilityRef = doc(db, "availability", date);

        try {
            // Check if the document exists
            const slotDoc = await getDoc(availabilityRef);

            if (slotDoc.exists()) {
                // Clear the availableSlots field
                await updateDoc(availabilityRef, {
                    availableSlots: deleteField()
                });

                console.log(`All slots deleted for date ${date}.`);

                // Optionally re-fetch and re-render slots after deletion
                const activeSlots = await fetchActiveSlotsForDate(date);
                renderSlots(activeSlots);
            } else {
                console.log(`No availability document found for date ${date}.`);
            }
        } catch (error) {
            console.error("Error deleting all slots:", error);
        }
    }

    // Handle remember button click
    rememberButton.addEventListener("click", async () => {
        const selectedDate = slotDateInput.value;
        const selectedTimes = Array.from(timeSlotsContainer.querySelectorAll('input[name="timeSlots"]:checked')).map(input => input.value);

        if (selectedDate) {
            try {
                if (selectedTimes.length > 0) {
                    // Save availability for future occurrences if times are selected
                    await saveAvailabilityForWeekday(selectedDate, selectedTimes);
                    alert("Availability for weekday has been remembered for all future occurrences until Dec 31st, 2024.");
                } else {
                    // Delete all times for the selected weekday if no times are selected
                    const weekday = getWeekday(selectedDate);
                    const futureDates = await getAllFutureDates(new Date(selectedDate), weekday);

                    for (const futureDate of futureDates) {
                        await deleteAllSlots(futureDate);
                    }

                    alert("All times for the selected weekday have been deleted until Dec 31st, 2024.");
                }
            } catch (error) {
                console.error("Error handling availability:", error);
                alert("An error occurred while processing availability.");
            }
        } else {
            alert("Please select a date.");
        }
    });

    // Add slot on form submission
    slotForm.addEventListener('submit', async function (event) {
        event.preventDefault(); // Prevent form submission

        const selectedDate = slotDateInput.value;
        const selectedTimes = Array.from(timeSlotsContainer.querySelectorAll('input[name="timeSlots"]:checked')).map(input => input.value);

        if (selectedDate && selectedTimes.length > 0) {
            await addSlot(selectedDate, selectedTimes);
        } else {
            console.error("Date or no time slots selected.");
        }
    });

    // Generate time slots on page load
    generateTimeSlots();
});
