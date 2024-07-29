import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-firestore.js';

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

document.addEventListener("DOMContentLoaded", function () {
    const slotForm = document.getElementById("slotForm");
    const slotDateInput = document.getElementById("slotDate");
    const timeSlotsContainer = document.getElementById("timeSlots");
    const rememberButton = document.getElementById("rememberButton");
    const slotsListContainer = document.getElementById("slotsList");

    if (!slotForm || !slotDateInput || !timeSlotsContainer || !rememberButton || !slotsListContainer) {
        console.error("One or more elements not found in the DOM");
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

    function convertTo12HourFormat(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

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

    function generateTimeSlots() {
        const startTime = 8;
        const endTime = 19;
        const interval = 30;

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

    async function fetchOrInitializeActiveSlots(date) {
        const availabilityRef = doc(db, "availability", date);

        try {
            const docSnapshot = await getDoc(availabilityRef);

            if (!docSnapshot.exists()) {
                await setDoc(availabilityRef, { availableSlots: {} });
                console.log(`Document created for date: ${date}`);
                return {};
            } else {
                return docSnapshot.data().availableSlots || {};
            }
        } catch (error) {
            console.error("Error fetching or initializing document:", error);
            return {};
        }
    }

    slotDateInput.addEventListener("change", async function () {
        const selectedDate = slotDateInput.value;

        if (!selectedDate) {
            console.error("Selected date is empty");
            return;
        }

        try {
            const availableSlots = await fetchOrInitializeActiveSlots(selectedDate);
            const slotsArray = Object.keys(availableSlots).map(slotTime => ({
                time: convertTo12HourFormat(slotTime),
                ...availableSlots[slotTime]
            }));

            if (slotsArray.length > 0) {
                renderSlots(slotsArray);
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

        slots.sort((a, b) => a.time.localeCompare(b.time));

        slots.forEach(slot => {
            const slotElement = document.createElement("div");
            slotElement.classList.add("slot-item");

            const buttonText = slot.status === "booked" ? "Mark as Unbooked" : "Mark as Booked";

            slotElement.innerHTML = `
                <div>
                    <p><strong>Time:</strong> ${slot.time}</p>
                    <p><strong>Status:</strong> ${slot.status}</p>
                    <p><strong>Service:</strong> ${slot.service}</p>
                </div>
                <div class="button-container">
                    <button type="button" class="book-button" data-slot-id="${slot.time}">${buttonText}</button>
                    <button type="button" class="delete-button" data-slot-id="${slot.time}">Delete Slot</button>
                </div>
            `;

            const bookButton = slotElement.querySelector('.book-button');
            bookButton.addEventListener('click', async (event) => {
                event.preventDefault();
                await toggleBookingStatus(slot.time);
            });

            const deleteButton = slotElement.querySelector('.delete-button');
            deleteButton.addEventListener('click', async (event) => {
                event.preventDefault();
                const slotId = event.target.getAttribute('data-slot-id');
                await deleteSlot(slotId);
            });

            slotsListContainer.appendChild(slotElement);
        });
    }

    async function toggleBookingStatus(slotTime) {
        const selectedDate = slotDateInput.value;
        if (!selectedDate) {
            console.error("No date selected");
            return;
        }

        const availabilityRef = doc(db, "availability", selectedDate);

        try {
            const availableSlots = await fetchOrInitializeActiveSlots(selectedDate);

            const slotKey = slotTime; // Use the 12-hour format directly
            if (availableSlots[slotKey]) {
                const currentStatus = availableSlots[slotKey].status;
                const newStatus = currentStatus === "booked" ? "unbooked" : "booked";

                availableSlots[slotKey].status = newStatus;

                await setDoc(availabilityRef, {
                    availableSlots: availableSlots
                }, { merge: true });

                const slotsArray = Object.keys(availableSlots).map(slotKey => ({
                    time: slotKey, // Use the 12-hour format directly
                    ...availableSlots[slotKey]
                }));

                renderSlots(slotsArray);
            } else {
                console.error(`Slot ${slotTime} not found`);
            }
        } catch (error) {
            console.error("Error updating slot status:", error);
        }
    }

    async function deleteSlot(slotTime) {
        const selectedDate = slotDateInput.value;
        if (!selectedDate) {
            console.error("No date selected");
            return;
        }

        const availabilityRef = doc(db, "availability", selectedDate);

        try {
            const availableSlots = await fetchOrInitializeActiveSlots(selectedDate);

            // Convert slotTime to 24-hour format if needed
            const slotKey = slotTime; // Ensure this key matches what's stored

            if (availableSlots[slotKey]) {
                // Delete the slot from the availableSlots object
                delete availableSlots[slotKey];

                // Update the Firestore document with the modified availableSlots
                await setDoc(availabilityRef, {
                    availableSlots: availableSlots
                }, { merge: true });

                console.log(`Slot ${slotKey} deleted successfully`);

                // Update the UI to reflect the changes immediately
                const slotsArray = Object.keys(availableSlots).map(slotKey => ({
                    time: slotKey,
                    ...availableSlots[slotKey]
                }));

                renderSlots(slotsArray);
            } else {
                console.error(`Slot ${slotTime} not found`);
            }
        } catch (error) {
            console.error("Error deleting slot:", error);
        }
    }


    slotForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const selectedDate = slotDateInput.value;
        const selectedTimes = Array.from(timeSlotsContainer.querySelectorAll('input[name="timeSlots"]:checked')).map(input => input.value);

        if (selectedDate && selectedTimes.length > 0) {
            await addSlot(selectedDate, selectedTimes);
        } else {
            console.error("Date or no time slots selected.");
            if (!selectedDate) console.error("Date is missing");
            if (selectedTimes.length === 0) console.error("No time slots selected");
        }
    });

    rememberButton.addEventListener("click", async () => {
        const selectedDate = slotDateInput.value;
        const selectedTimes = Array.from(timeSlotsContainer.querySelectorAll('input[name="timeSlots"]:checked')).map(input => input.value);

        if (selectedDate) {
            if (selectedTimes.length > 0) {
                await saveAvailabilityForWeekday(selectedDate, selectedTimes);
                alert("Availability for the weekday has been remembered.");
            } else {
                alert("No time slots selected for the selected date.");
            }
        } else {
            alert("Please select a date.");
        }
    });

    async function addSlot(date, times) {
        if (!date || !times || times.length === 0) {
            console.error("Date or time slots input is empty");
            return;
        }

        const availabilityRef = doc(db, "availability", date);

        try {
            const availableSlots = await fetchOrInitializeActiveSlots(date);

            times.forEach(time => {
                const time12 = time; // Use the 12-hour format directly
                if (!availableSlots[time12]) {
                    availableSlots[time12] = { status: "unbooked", service: "" };
                }
            });

            await setDoc(availabilityRef, {
                availableSlots: availableSlots
            }, { merge: true });

            const slotsArray = Object.keys(availableSlots).map(slotKey => ({
                time: slotKey, // Use the 12-hour format directly
                ...availableSlots[slotKey]
            }));

            renderSlots(slotsArray);
        } catch (error) {
            console.error("Error adding slots:", error);
        }
    }

    async function saveAvailabilityForWeekday(date, times) {
        if (!date || !times || times.length === 0) {
            console.error("Date or time slots input is empty");
            return;
        }

        const availabilityRef = doc(db, "availability", date);

        try {
            const availableSlots = await fetchOrInitializeActiveSlots(date);

            times.forEach(time => {
                const time12 = time; // Use the 12-hour format directly
                if (!availableSlots[time12]) {
                    availableSlots[time12] = { status: "unbooked", service: "" };
                }
            });

            await setDoc(availabilityRef, {
                availableSlots: availableSlots
            }, { merge: true });

            console.log("Availability saved for weekday:", availableSlots);
        } catch (error) {
            console.error("Error saving availability for weekday:", error);
        }
    }

    generateTimeSlots();
});
