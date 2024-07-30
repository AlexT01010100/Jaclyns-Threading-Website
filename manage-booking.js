import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteField } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-firestore.js';

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
    const slotsListContainer = document.getElementById("slotsList");

    if (!slotForm || !slotDateInput || !timeSlotsContainer || !slotsListContainer) {
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
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    function generateTimeSlots() {
        const startTime = 8; // 8 AM
        const endTime = 19; // 7 PM
        const interval = 30; // 30 minutes

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
                        <div>
                            <input type="text" placeholder="Name" class="slot-name" />
                        </div>
                        <div>
                            <input type="email" placeholder="Email" class="slot-email" />
                        </div>
                        <div>
                            <input type="tel" placeholder="Phone Number" class="slot-phone" />
                        </div>
                    </div>
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

        slots.sort((a, b) => {
            const timeA = convertTo24HourFormat(a.time);
            const timeB = convertTo24HourFormat(b.time);
            return timeA.localeCompare(timeB);
        });

        slots.forEach(slot => {
            const slotElement = document.createElement("div");
            slotElement.classList.add("slot-item");

            const buttonText = slot.status === "booked" ? "Mark as Unbooked" : "Mark as Booked";

            slotElement.innerHTML = `
                <div class="info-row">
                    <div><strong>Time:</strong> ${slot.time}</div>
                    <div><strong>Status:</strong> ${slot.status}</div>
                    <div><strong>Service:</strong> ${slot.service || 'N/A'}</div>
                </div>
                <div class="details-row">
                    <div><strong>Name:</strong> ${slot.name || 'N/A'}</div>
                    <div><strong>Email:</strong> ${slot.email || 'N/A'}</div>
                    <div><strong>Phone Number:</strong> ${slot.phoneNumber || 'N/A'}</div>
                </div>
                <div class="button-container">
                    <button type="button" class="book-button" data-slot-id="${convertTo24HourFormat(slot.time)}">${buttonText}</button>
                    <button type="button" class="delete-button" data-slot-id="${convertTo24HourFormat(slot.time)}">Delete Slot</button>
                </div>
            `;

            const bookButton = slotElement.querySelector('.book-button');
            bookButton.addEventListener('click', async (event) => {
                event.preventDefault();
                await toggleBookingStatus(event.target.getAttribute('data-slot-id'));
            });

            const deleteButton = slotElement.querySelector('.delete-button');
            deleteButton.addEventListener('click', async (event) => {
                event.preventDefault();
                await deleteSlot(event.target.getAttribute('data-slot-id'));
            });

            slotsListContainer.appendChild(slotElement);
        });
    }

    async function toggleBookingStatus(slotTime24) {
        const selectedDate = slotDateInput.value;
        if (!selectedDate) {
            console.error("No date selected");
            return;
        }

        const availabilityRef = doc(db, "availability", selectedDate);

        try {
            const availableSlots = await fetchOrInitializeActiveSlots(selectedDate);
            const slotKey = slotTime24;

            if (availableSlots[slotKey]) {
                const currentStatus = availableSlots[slotKey].status;
                availableSlots[slotKey].status = currentStatus === "booked" ? "unbooked" : "booked";

                await setDoc(availabilityRef, {
                    availableSlots: availableSlots
                }, { merge: true });

                const slotsArray = Object.keys(availableSlots).map(slotKey => ({
                    time: convertTo12HourFormat(slotKey),
                    ...availableSlots[slotKey]
                }));

                renderSlots(slotsArray);
            } else {
                console.error(`Slot ${slotTime24} not found`);
            }
        } catch (error) {
            console.error("Error updating slot status:", error);
        }
    }

    async function deleteSlot(slotTime24) {
        const selectedDate = slotDateInput.value;
        if (!selectedDate) {
            console.error("No date selected");
            return;
        }

        const availabilityRef = doc(db, "availability", selectedDate);

        try {
            const availableSlots = await fetchOrInitializeActiveSlots(selectedDate);
            const slotKey = slotTime24;

            if (availableSlots[slotKey]) {
                delete availableSlots[slotKey];

                await setDoc(availabilityRef, {
                    availableSlots: availableSlots
                }, { merge: true });

                const slotsArray = Object.keys(availableSlots).map(slotKey => ({
                    time: convertTo12HourFormat(slotKey),
                    ...availableSlots[slotKey]
                }));

                renderSlots(slotsArray);
            } else {
                console.error(`Slot ${slotTime24} not found`);
            }
        } catch (error) {
            console.error("Error deleting slot:", error);
        }
    }

    async function addSlot(date, times) {
        if (!date || !times || times.length === 0) {
            console.error("Date or time slots input is empty");
            return;
        }

        const availabilityRef = doc(db, "availability", date);

        try {
            const availableSlots = await fetchOrInitializeActiveSlots(date);

            times.forEach(time => {
                const time24 = convertTo24HourFormat(time);
                if (!availableSlots[time24]) {
                    availableSlots[time24] = { status: "unbooked", service: "", name: "", email: "", phoneNumber: "" };
                }
            });

            await setDoc(availabilityRef, {
                availableSlots: availableSlots
            }, { merge: true });

            const slotsArray = Object.keys(availableSlots).map(slotKey => ({
                time: convertTo12HourFormat(slotKey),
                ...availableSlots[slotKey]
            }));

            renderSlots(slotsArray);
        } catch (error) {
            console.error("Error adding slots:", error);
        }
    }

    async function addSlotWithDetails(date, details) {
        if (!date || !details || details.length === 0) {
            console.error("Date or details input is empty");
            return;
        }

        const availabilityRef = doc(db, "availability", date);

        try {
            const availableSlots = await fetchOrInitializeActiveSlots(date);

            details.forEach(detail => {
                const time24 = convertTo24HourFormat(detail.time);
                if (!availableSlots[time24]) {
                    availableSlots[time24] = { status: "unbooked", service: "", name: detail.name, email: detail.email, phoneNumber: detail.phoneNumber };
                } else {
                    availableSlots[time24].name = detail.name;
                    availableSlots[time24].email = detail.email;
                    availableSlots[time24].phoneNumber = detail.phoneNumber;
                }
            });

            await setDoc(availabilityRef, {
                availableSlots: availableSlots
            }, { merge: true });

            const slotsArray = Object.keys(availableSlots).map(slotKey => ({
                time: convertTo12HourFormat(slotKey),
                ...availableSlots[slotKey]
            }));

            renderSlots(slotsArray);
        } catch (error) {
            console.error("Error adding slots with details:", error);
        }
    }

    slotForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const selectedDate = slotDateInput.value;
        const selectedSlots = Array.from(timeSlotsContainer.querySelectorAll('input[name="timeSlots"]:checked'));

        if (selectedDate && selectedSlots.length > 0) {
            const details = selectedSlots.map(slot => ({
                time: slot.value,
                name: slot.closest('.time-slot').querySelector('.slot-name').value,
                email: slot.closest('.time-slot').querySelector('.slot-email').value,
                phoneNumber: slot.closest('.time-slot').querySelector('.slot-phone').value
            }));

            await addSlotWithDetails(selectedDate, details);
        } else {
            console.error("Date or no time slots selected.");
            if (!selectedDate) console.error("Date is missing");
            if (selectedSlots.length === 0) console.error("No time slots selected");
        }
    });

    generateTimeSlots();
});
