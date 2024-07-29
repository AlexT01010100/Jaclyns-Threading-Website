import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-app.js';
import { getFirestore, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-firestore.js';

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
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based
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

        const availabilityRef = doc(db, "availability", date);

        try {
            const docSnapshot = await getDoc(availabilityRef);

            if (docSnapshot.exists()) {
                const availableSlotsData = docSnapshot.data().availableSlots || {};

                if (Object.keys(availableSlotsData).length > 0) {
                    const slotsArray = Object.keys(availableSlotsData).map(slotId => {
                        console.log("Processing slotId:", slotId);

                        const slotData = availableSlotsData[slotId];

                        return {
                            id: slotId,
                            time: slotId,
                            status: slotData.status
                        };
                    }).sort((a, b) => {
                        const aDate = parseTimeTo24Hour(a.time);
                        const bDate = parseTimeTo24Hour(b.time);
                        return aDate - bDate;
                    });

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

    function filterSlotsForMicroblading(slots) {
        if (slots.length === 0) return [];

        const timeSlots = slots.map(slot => parseTimeTo24Hour(slot.time)).filter(date => date !== null);
        timeSlots.sort((a, b) => a - b);

        const availableBlocks = [];
        const slotCount = timeSlots.length;

        function isSlotUnbooked(time) {
            return slots.some(slot => parseTimeTo24Hour(slot.time).getTime() === time.getTime() && slot.status === 'unbooked');
        }

        for (let i = 0; i < slotCount; i++) {
            const startSlot = timeSlots[i];
            let endSlot = new Date(startSlot.getTime() + 3 * 60 * 60 * 1000); // 3 hours later

            let currentSlot = new Date(startSlot.getTime());
            let isBlockAvailable = true;

            while (currentSlot < endSlot) {
                const timeKey = formatTimeTo12Hour(currentSlot);
                if (!isSlotUnbooked(currentSlot)) {
                    isBlockAvailable = false;
                    break;
                }
                currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000); // Increment by 30 minutes
            }

            if (isBlockAvailable) {
                availableBlocks.push({
                    start: formatTimeTo12Hour(startSlot)
                });
            }
        }

        return availableBlocks.map(block => ({
            id: block.start,
            time: block.start
        }));
    }

    function renderSlots(slots) {
        timeSlotsContainer.innerHTML = "";

        if (slots.length === 0) {
            timeSlotsContainer.innerHTML = "<p>No available slots for the selected service.</p>";
            return;
        }

        slots.forEach(slot => {
            if (slot.status === 'booked') {
                return;
            }

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

    async function bookAppointment() {
        try {
            const availabilityRef = doc(db, "availability", selectedDate);
            const slotDoc = await getDoc(availabilityRef);

            if (!slotDoc.exists()) {
                console.error("No such document!");
                return;
            }

            const availableSlotsData = slotDoc.data().availableSlots || {};
            console.log("Available Slots Data:", availableSlotsData);

            if (selectedService === 'microblading') {
                const startSlot = parseTimeTo24Hour(selectedSlotId);
                let endSlot = new Date(startSlot.getTime() + 3 * 60 * 60 * 1000);

                let currentSlot = new Date(startSlot.getTime());
                const updatedSlotsData = { ...availableSlotsData };

                while (currentSlot < endSlot) {
                    const timeKey = formatTimeTo12Hour(currentSlot);
                    if (updatedSlotsData[timeKey]) {
                        updatedSlotsData[timeKey] = {
                            ...updatedSlotsData[timeKey],
                            status: "booked",
                            service: selectedService
                        };
                    }
                    currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000);
                }

                await updateDoc(availabilityRef, {
                    availableSlots: updatedSlotsData
                });

                console.log("Appointment booked successfully.");
                messageDiv.textContent = "Appointment booked successfully.";
                messageDiv.classList.add("success");
            } else {
                // Handle other services similarly, if applicable
            }
        } catch (error) {
            console.error("Error booking appointment:", error);
            messageDiv.textContent = "Error booking appointment.";
            messageDiv.classList.add("error");
        }
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (!selectedSlotId) {
            console.error("No slot selected.");
            messageDiv.textContent = "Please select a slot.";
            messageDiv.classList.add("error");
            return;
        }

        if (!selectedDate || !selectedService) {
            console.error("Date or service not selected.");
            messageDiv.textContent = "Please select both date and service.";
            messageDiv.classList.add("error");
            return;
        }

        console.log("Form submitted with selected slotId:", selectedSlotId);
        bookAppointment();
    });
});
