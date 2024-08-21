const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config()
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { v4: uuidv4 } = require('uuid');
const { getFirestore, doc, getDoc, updateDoc, deleteDoc } = require('firebase/firestore');
const app = express();
const port = 63342;
const { initializeApp } = require('firebase/app');
const admin = require('firebase-admin');
const serviceAccount = require('./jaclyns-threading-firebase-admin.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://jaclyns-threading.firebaseio.com'
});

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

const initDB = initializeApp(firebaseConfig);
const db = getFirestore(initDB);

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static('public'));

// Serve the index.html file from the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res, next) => {
    // Skip redirection for root URL
    if (req.url === '/') {
        return next();
    }

    // Remove trailing slash if present
    if (req.url.endsWith('/') && req.url.length > 1) {
        res.redirect(301, req.url.slice(0, -1));
    } else {
        next();
    }
});


// Endpoint to handle form submission
app.post('/send_email', (req, res) => {
    const { fullName, phoneNumber, email, message } = req.body;

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    let mailOptions = {
        from: email,
        to: 'alexterry179@gmail.com',
        subject: `Contact Form Submission from ${fullName}`,
        text: `Name: ${fullName}\nPhone: ${phoneNumber}\nEmail: ${email}\n\nMessage:\n${message}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            return res.status(500).send('Failed to send email.');
        }
        console.log('Email sent:', info.response);
        res.send('Email sent successfully.');
    });
});

// Endpoint to handle fetching booking details
app.get('/get_booking_details', async (req, res) => {
    const { confirmationId } = req.query;

    if (!confirmationId) {
        return res.status(400).send('Confirmation ID is required.');
    }

    console.log(confirmationId)

    try {
        const bookingRef = db.collection('availability').doc(confirmationId);
        const bookingDoc = await bookingRef.get();

        if (!bookingDoc.exists()) {
            return res.status(404).send('Booking not found.');
        }

        res.json(bookingDoc.data());
    } catch (error) {
        console.error('Error fetching booking details:', error);
        res.status(500).send('Error fetching booking details.');
    }
});

// Endpoint to handle appointment booking and sending confirmation and admin notification emails
app.post('/book_appointment', (req, res) => {
    const { name, email, phone, service, date, slot, confirmationId } = req.body;

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    let userMailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Appointment Confirmation`,
        text: `
                Dear ${name},
                
                Your appointment for ${service} has been successfully booked on ${date} at ${slot}.
                
                You can manage your appointment using the following link:
                http://localhost:63342/modify-appointment.html?confirmationId=${confirmationId}
                
                Thank you!
            `};

    // Email options for admin notification
    let adminMailOptions = {
        from: process.env.EMAIL_USER,
        to: 'alexterry179@gmail.com',
        subject: `New Appointment Booking`,
        text: `New appointment booking:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nService: ${service}\nDate: ${date}\nSlot: ${slot}\n\nPlease review the booking.`
    };

    // Text message options for user confirmation
    const userSmsOptions = {
        body: `Hi ${name}, your appointment for ${service} is confirmed on ${date} at ${slot}.`,
        from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
        to: phone
    };

    // Text message options for admin notification
    const adminSmsOptions = {
        body: `New appointment booking:\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nService: ${service}\nDate: ${date}\nSlot: ${slot}`,
        from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
        to: process.env.ADMIN_PHONE_NUMBER // Admin's phone number
    };


    // Send confirmation email to user
    transporter.sendMail(userMailOptions, (error, info) => {
        if (error) {
            console.error('Error sending user email:', error);
            return res.status(500).send('Failed to send email.');
        }
        console.log('User email sent:', info.response);

        // Send notification email to admin
        transporter.sendMail(adminMailOptions, (error, info) => {
            if (error) {
                console.error('Error sending admin email:', error);
                return res.status(500).send('Failed to send email.');
            }

            // Send confirmation SMS to user
            client.messages.create(userSmsOptions)
                .then(message => console.log(`User SMS sent with SID: ${message.sid}`))
                .catch(error => console.error('Error sending user SMS:', error));

            // Send notification SMS to admin
            client.messages.create(adminSmsOptions)
                .then(message => console.log(`Admin SMS sent with SID: ${message.sid}`))
                .catch(error => console.error('Error sending admin SMS:', error));

            res.send('Emails and SMS sent successfully.');
            console.log('Admin email sent:', info.response);
        });
    });
});

app.post('/cancel-appointment', async (req, res) => {
    const { confirmationId } = req.body;

    if (!confirmationId) {
        return res.status(400).send('Confirmation ID is required.');
    }

    try {
        // Fetch the booking
        const bookingRef = doc(db, "appointments", confirmationId);
        const bookingDoc = await getDoc(bookingRef);

        if (!bookingDoc.exists()) {
            return res.status(404).send('Booking not found.');
        }

        const bookingData = bookingDoc.data();

        // Remove the booking
        await deleteDoc(bookingRef);

        // Handle updating available slots if needed
        // ...

        res.send('Appointment canceled successfully.');
    } catch (error) {
        console.error('Error canceling appointment:', error);
        res.status(500).send('Error canceling appointment.');
    }
});

app.post('/edit-appointment', async (req, res) => {
    const { confirmationId, newDate, newSlot, newService } = req.body;

    if (!confirmationId || !newDate || !newSlot || !newService) {
        return res.status(400).send('All fields are required.');
    }

    try {
        // Fetch the existing booking
        const bookingRef = doc(db, "appointments", confirmationId);
        const bookingDoc = await getDoc(bookingRef);

        if (!bookingDoc.exists()) {
            return res.status(404).send('Booking not found.');
        }

        const bookingData = bookingDoc.data();

        // Update the booking details
        await updateDoc(bookingRef, {
            date: newDate,
            slot: newSlot,
            service: newService
        });

        // Handle updating available slots if needed
        // ...

        res.send('Appointment updated successfully.');
    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).send('Error updating appointment.');
    }
});




// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
