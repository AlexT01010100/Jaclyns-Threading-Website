import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-app.js';
import { getFirestore, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/9.5.0/firebase-firestore.js';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@8.3.2';

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

    function formatTimeTo24HourString(time) {
        return time.toTimeString().split(' ')[0].slice(0, 5); // HH:MM format
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

    function filterSlotsForService(slots, service) {
        if (slots.length === 0) return [];

        // Define durations for different services
        const serviceDurations = {
            'microblading': 3 * 60 * 60 * 1000, // 3 hours
            'threading': 1 * 60 * 60 * 1000,   // 1 hour
            // Add other services here with their respective durations
        };

        // Default duration if the service is not found
        const duration = serviceDurations[service] || 1 * 60 * 60 * 1000; // Default to 1 hour if not found

        // Convert slot times to Date objects and sort them
        const timeSlots = slots.map(slot => parseTimeTo24Hour(slot.time)).filter(date => date !== null);
        timeSlots.sort((a, b) => a - b);

        console.log("Time Slots for Service:", timeSlots);

        const availableBlocks = [];
        const slotCount = timeSlots.length;

        function isSlotUnbooked(time) {
            return slots.some(slot => parseTimeTo24Hour(slot.time).getTime() === time.getTime() && slot.status === 'unbooked');
        }

        for (let i = 0; i < slotCount; i++) {
            const startSlot = timeSlots[i];
            let endSlot = new Date(startSlot.getTime() + duration);

            console.log(`Checking slot from ${formatTimeTo12Hour(startSlot)} to ${formatTimeTo12Hour(endSlot)}`);

            let currentSlot = new Date(startSlot.getTime());
            let isBlockAvailable = true;

            while (currentSlot < endSlot) {
                const timeKey = formatTimeTo24HourString(currentSlot);
                if (!isSlotUnbooked(currentSlot)) {
                    isBlockAvailable = false;
                    console.log(`Slot ${timeKey} is not available.`);
                    break;
                }
                currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000); // Increment by 30 minutes
            }

            if (isBlockAvailable) {
                console.log(`Available block starting at ${formatTimeTo12Hour(startSlot)}`);
                availableBlocks.push({
                    start: formatTimeTo12Hour(startSlot)
                });
            }
        }

        console.log("Available Blocks for Service:", availableBlocks);

        return availableBlocks.map(block => ({
            id: block.start,
            time: block.start
        }));
    }

    function renderSlots(slots) {
        timeSlotsContainer.innerHTML = "";

        if (slots.length === 0) {
            timeSlotsContainer.innerHTML = "<div class=\"no-slots-wrapper\"><div class='no-slots-message'>No available slots for the selected service.</p></div></div>";
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
            fetchAvailableSlotsForDate(selectedDate).then(slots => {
                if (selectedService === 'microblading' || selectedService === 'threading') {
                    slots = filterSlotsForService(slots, selectedService);
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
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const phone = document.getElementById("phone").value;
        const confirmationId = uuidv4(); // Generate a unique confirmation ID
        console.log('Generated UUID:', confirmationId);

        if (!selectedDate || !selectedService || !selectedSlotId) {
            messageDiv.textContent = "Please select a date, service, and time slot.";
            messageDiv.classList.add("error");
            return;
        }

        try {
            const availabilityRef = doc(db, "availability", selectedDate);
            const slotDoc = await getDoc(availabilityRef);

            if (!slotDoc.exists()) {
                console.error("No such document!");
                messageDiv.textContent = "No available slots for the selected date.";
                messageDiv.classList.add("error");
                return;
            }

            const availableSlotsData = slotDoc.data().availableSlots || {};
            console.log("Available Slots Data:", availableSlotsData);

            // Define service durations
            const serviceDurations = {
                'microblading': 3 * 60 * 60 * 1000, // 3 hours
                'threading': 1 * 60 * 60 * 1000,    // 1 hour
                // Add other services here with their respective durations
            };

            // Calculate end slot time based on selected service
            const startSlot = parseTimeTo24Hour(selectedSlotId);
            let endSlot = new Date(startSlot.getTime() + (serviceDurations[selectedService] || 1 * 60 * 60 * 1000));

            let currentSlot = new Date(startSlot.getTime());
            const updatedSlotsData = { ...availableSlotsData };

            // Mark slots as booked
            while (currentSlot < endSlot) {
                const timeKey = formatTimeTo24HourString(currentSlot);
                if (updatedSlotsData[timeKey]) {
                    updatedSlotsData[timeKey] = {
                        ...updatedSlotsData[timeKey],
                        status: "booked",
                        service: selectedService,
                        name: name,
                        email: email,
                        phone: phone,
                        confirmationId: confirmationId
                    };
                }
                currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000); // Increment by 30 minutes
            }

            // Update Firestore with new slot data
            await updateDoc(availabilityRef, { availableSlots: updatedSlotsData });

            // Notify user of successful booking
            messageDiv.textContent = "Appointment booked successfully.";
            messageDiv.classList.add("success");

            // Send appointment data to your server endpoint
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
                    slot: selectedSlotId,
                    confirmationId: confirmationId
                })
            });

            const result = await response.text();
            console.log("Server response:", result);
            messageDiv.textContent = result;
            messageDiv.classList.add("success");

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
