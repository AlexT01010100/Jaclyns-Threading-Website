const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config()
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const app = express();
const port = 63342;

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static('public'));

// Serve the index.html file from the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Endpoint to handle appointment booking and sending confirmation and admin notification emails
app.post('/book_appointment', (req, res) => {
    const { name, email, phone, service, date, slot } = req.body;

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    // Email options for user confirmation
    let userMailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Appointment Confirmation`,
        text: `Dear ${name},\n\nYour appointment for ${service} has been successfully booked on ${date} at ${slot}.\n\nThank you!`
    };

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

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
