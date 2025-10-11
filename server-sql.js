const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcrypt');
require('dotenv').config();
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const app = express();
const port = process.env.PORT || 3000;

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true only when using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'jaclyns_threading',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
    } else {
        console.log('Successfully connected to PostgreSQL database');
        release();
    }
});

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }
    // Redirect to login page instead of returning JSON
    res.redirect('/admin-login.html');
};

// Protected route for manage-booking - must come BEFORE express.static
app.get('/manage-booking.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'manage-booking.html'));
});

// Serve static files
app.use(express.static('public'));

// Admin login endpoint
app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Get credentials from environment variables
        const adminUsername = process.env.ADMIN_USERNAME;
        const adminPassword = process.env.ADMIN_PASSWORD;

        // In production, use bcrypt for password hashing
        // For now, simple comparison (you should hash passwords in production)
        if (username === adminUsername && password === adminPassword) {
            req.session.isAuthenticated = true;
            req.session.username = username;
            res.json({ success: true, message: 'Login successful' });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Admin logout endpoint
app.post('/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Check authentication status
app.get('/admin/check-auth', (req, res) => {
    if (req.session && req.session.isAuthenticated) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

// Serve the index.html file from the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Remove trailing slash middleware
app.use((req, res, next) => {
    if (req.url === '/') {
        return next();
    }
    if (req.url.endsWith('/') && req.url.length > 1) {
        res.redirect(301, req.url.slice(0, -1));
    } else {
        next();
    }
});

// Endpoint to handle contact form submission
app.post('/send_email', async (req, res) => {
    const { fullName, phoneNumber, email, message } = req.body;

    try {
        // Store contact message in database
        await pool.query(
            'INSERT INTO contact_messages (full_name, phone_number, email, message) VALUES ($1, $2, $3, $4)',
            [fullName, phoneNumber, email, message]
        );

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        let mailOptions = {
            from: email,
            to: process.env.ADMIN_EMAIL || 'alexterry179@gmail.com',
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
    } catch (error) {
        console.error('Error processing contact form:', error);
        res.status(500).send('Error processing contact form.');
    }
});

// Endpoint to get available time slots for a specific date
app.get('/api/available-slots/:date', async (req, res) => {
    const { date } = req.params;

    try {
        // Query with explicit check for is_available = true AND appointment_id IS NULL
        // This ensures we don't show slots that are linked to any appointment
        const result = await pool.query(
            `SELECT time_slot, is_available 
             FROM time_slots 
             WHERE slot_date = $1 
             AND is_available = true 
             AND appointment_id IS NULL
             ORDER BY time_slot`,
            [date]
        );

        console.log(`Available slots for ${date}:`, result.rows.length, 'slots found');
        
        // Extra safety: ensure we only return truly available slots
        const availableSlots = result.rows.filter(slot => slot.is_available === true);
        
        console.log(`Returning ${availableSlots.length} available slots`);
        
        // Return the array directly with correct property names (time_slot, is_available)
        res.json(availableSlots);
    } catch (error) {
        console.error('Error fetching available slots:', error);
        res.status(500).json({ error: 'Error fetching available slots' });
    }
});

// Endpoint to handle appointment booking
app.post('/book_appointment', async (req, res) => {
    const { name, email, phone, service, date, slot } = req.body;

    // Generate confirmation ID on server side
    const { v4: uuidv4 } = require('uuid');
    const confirmationId = uuidv4();

    const connection = await pool.connect();
    
    try {
        await connection.query('BEGIN');

        // Check if slot is still available
        const slotCheck = await connection.query(
            'SELECT is_available FROM time_slots WHERE slot_date = $1 AND time_slot = $2 FOR UPDATE',
            [date, slot]
        );

        if (slotCheck.rows.length === 0 || !slotCheck.rows[0].is_available) {
            await connection.query('ROLLBACK');
            return res.status(400).json({ error: 'This time slot is no longer available' });
        }

        // Create appointment
        const appointmentResult = await connection.query(
            `INSERT INTO appointments (confirmation_id, name, email, phone, service, appointment_date, time_slot, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'booked') RETURNING id`,
            [confirmationId, name, email, phone, service, date, slot]
        );

        const appointmentId = appointmentResult.rows[0].id;

        // Update time slot availability
        await connection.query(
            'UPDATE time_slots SET is_available = false, appointment_id = $1 WHERE slot_date = $2 AND time_slot = $3',
            [appointmentId, date, slot]
        );

        await connection.query('COMMIT');

        // Send confirmation emails and SMS
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
        
        let userMailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `Appointment Confirmation`,
            html: `
                <div style="color: #000000; font-family: Arial, sans-serif;">
                    <h2 style="color: #000000;">Dear ${name},</h2>
                    <p style="color: #000000;">Your appointment for <strong>${service}</strong> has been successfully booked on <strong>${date}</strong> at <strong>${slot}</strong>.</p>
                    <p style="color: #000000;">You can manage your appointment using the following link:</p>
                    <p style="color: #000000;"><a href="${baseUrl}/modify-appointment.html?confirmationId=${confirmationId}&date=${date}" style="color: #0066cc;">Manage Appointment</a></p>
                    <p style="color: #000000;">Confirmation ID: <strong>${confirmationId}</strong></p>
                    <br>
                    <p style="color: #000000;">Thank you!</p>
                    <p style="color: #000000;">Jaclyn's Threading Salon</p>
                </div>
            `
        };

        let adminMailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL || 'alexterry179@gmail.com',
            subject: `New Appointment Booking`,
            text: `New appointment booking:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nService: ${service}\nDate: ${date}\nSlot: ${slot}\nConfirmation ID: ${confirmationId}\n\nPlease review the booking.`
        };

        // Send emails
        await transporter.sendMail(userMailOptions);
        await transporter.sendMail(adminMailOptions);

        // Send SMS notifications if Twilio is configured
        if (process.env.TWILIO_PHONE_NUMBER) {
            const userSmsOptions = {
                body: `Hi ${name}, your appointment for ${service} is confirmed on ${date} at ${slot}. Confirmation: ${confirmationId}`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phone
            };

            const adminSmsOptions = {
                body: `New appointment: ${name}, ${service}, ${date} at ${slot}`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: process.env.ADMIN_PHONE_NUMBER
            };

            try {
                await client.messages.create(userSmsOptions);
                await client.messages.create(adminSmsOptions);
            } catch (smsError) {
                console.error('Error sending SMS:', smsError);
                // Continue even if SMS fails
            }
        }

        res.json({ success: true, message: 'Appointment booked successfully', confirmationId });

    } catch (error) {
        await connection.query('ROLLBACK');
        console.error('Error booking appointment:', error);
        res.status(500).json({ error: 'Error booking appointment' });
    } finally {
        connection.release();
    }
});

// Endpoint to cancel an appointment
app.post('/cancel-appointment', async (req, res) => {
    const { confirmationId, date } = req.query;

    if (!confirmationId || !date) {
        return res.status(400).json({ error: 'Confirmation ID and date are required' });
    }

    const connection = await pool.connect();

    try {
        await connection.query('BEGIN');

        // Get appointment details
        const appointmentResult = await connection.query(
            'SELECT id, name, email, time_slot FROM appointments WHERE confirmation_id = $1 AND appointment_date = $2 AND status = $3',
            [confirmationId, date, 'booked']
        );

        if (appointmentResult.rows.length === 0) {
            await connection.query('ROLLBACK');
            return res.status(404).json({ error: 'Appointment not found' });
        }

        const appointment = appointmentResult.rows[0];

        // Update appointment status
        await connection.query(
            'UPDATE appointments SET status = $1 WHERE id = $2',
            ['cancelled', appointment.id]
        );

        // Free up the time slot
        await connection.query(
            'UPDATE time_slots SET is_available = true, appointment_id = NULL WHERE appointment_id = $1',
            [appointment.id]
        );

        await connection.query('COMMIT');

        // Send cancellation email
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        let mailOptions = {
            from: process.env.EMAIL_USER,
            to: appointment.email,
            subject: 'Appointment Cancelled',
            html: `
                <div style="color: #000000; font-family: Arial, sans-serif;">
                    <h2 style="color: #000000;">Dear ${appointment.name},</h2>
                    <p style="color: #000000;">Your appointment on <strong>${date}</strong> at <strong>${appointment.time_slot}</strong> has been cancelled.</p>
                    <p style="color: #000000;">If you'd like to reschedule, please visit our booking page.</p>
                    <br>
                    <p style="color: #000000;">Thank you!</p>
                    <p style="color: #000000;">Jaclyn's Threading Salon</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        // Send admin notification email
        let adminMailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL || 'alexterry179@gmail.com',
            subject: 'Customer Cancelled Appointment',
            html: `
                <div style="color: #000000; font-family: Arial, sans-serif;">
                    <h2 style="color: #000000;">Appointment Cancellation Notice</h2>
                    <p style="color: #000000;">A customer has cancelled their appointment:</p>
                    <p style="color: #000000;"><strong>Customer Name:</strong> ${appointment.name}</p>
                    <p style="color: #000000;"><strong>Email:</strong> ${appointment.email}</p>
                    <p style="color: #000000;"><strong>Date:</strong> ${date}</p>
                    <p style="color: #000000;"><strong>Time:</strong> ${appointment.time_slot}</p>
                    <p style="color: #000000;"><strong>Confirmation ID:</strong> ${confirmationId}</p>
                    <br>
                    <p style="color: #000000;">The time slot has been freed up and is now available for booking.</p>
                </div>
            `
        };

        await transporter.sendMail(adminMailOptions);

        res.json({ success: true, message: 'Appointment cancelled successfully' });

    } catch (error) {
        await connection.query('ROLLBACK');
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ error: 'Error cancelling appointment' });
    } finally {
        connection.release();
    }
});

// Endpoint to edit/reschedule an appointment
app.post('/edit-appointment', async (req, res) => {
    const { confirmationId, currentDate, newDate, newSlot, newService } = req.body;

    if (!confirmationId || !currentDate || !newDate || !newSlot || !newService) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const connection = await pool.connect();

    try {
        await connection.query('BEGIN');

        // Get current appointment
        const currentAppointment = await connection.query(
            'SELECT id, name, email, phone, appointment_date, time_slot FROM appointments WHERE confirmation_id = $1 AND status = $2',
            [confirmationId, 'booked']
        );

        if (currentAppointment.rows.length === 0) {
            await connection.query('ROLLBACK');
            return res.status(404).json({ error: 'Appointment not found' });
        }

        const appointment = currentAppointment.rows[0];

        // Check if new slot is available (if date or time changed)
        if (newDate !== currentDate || newSlot !== appointment.time_slot) {
            const newSlotCheck = await connection.query(
                'SELECT is_available FROM time_slots WHERE slot_date = $1 AND time_slot = $2 FOR UPDATE',
                [newDate, newSlot]
            );

            if (newSlotCheck.rows.length === 0 || !newSlotCheck.rows[0].is_available) {
                await connection.query('ROLLBACK');
                return res.status(400).json({ error: 'New time slot is not available' });
            }

            // Free up old time slot
            await connection.query(
                'UPDATE time_slots SET is_available = true, appointment_id = NULL WHERE appointment_id = $1',
                [appointment.id]
            );

            // Book new time slot
            await connection.query(
                'UPDATE time_slots SET is_available = false, appointment_id = $1 WHERE slot_date = $2 AND time_slot = $3',
                [appointment.id, newDate, newSlot]
            );
        }

        // Update appointment details
        await connection.query(
            'UPDATE appointments SET appointment_date = $1, time_slot = $2, service = $3 WHERE id = $4',
            [newDate, newSlot, newService, appointment.id]
        );

        await connection.query('COMMIT');

        // Send update confirmation email
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        let mailOptions = {
            from: process.env.EMAIL_USER,
            to: appointment.email,
            subject: 'Appointment Updated',
            html: `
                <div style="color: #000000; font-family: Arial, sans-serif;">
                    <h2 style="color: #000000;">Dear ${appointment.name},</h2>
                    <p style="color: #000000;">Your appointment has been updated:</p>
                    <p style="color: #000000;"><strong>Service:</strong> ${newService}</p>
                    <p style="color: #000000;"><strong>Date:</strong> ${newDate}</p>
                    <p style="color: #000000;"><strong>Time:</strong> ${newSlot}</p>
                    <p style="color: #000000;">Confirmation ID: <strong>${confirmationId}</strong></p>
                    <br>
                    <p style="color: #000000;">Thank you!</p>
                    <p style="color: #000000;">Jaclyn's Threading Salon</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: 'Appointment updated successfully' });

    } catch (error) {
        await connection.query('ROLLBACK');
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Error updating appointment' });
    } finally {
        connection.release();
    }
});

// Endpoint to get appointment details
app.get('/api/appointment/:confirmationId', async (req, res) => {
    const { confirmationId } = req.params;

    try {
        const result = await pool.query(
            'SELECT name, email, phone, service, appointment_date, time_slot, status, confirmation_id FROM appointments WHERE confirmation_id = $1 AND status != $2',
            [confirmationId, 'cancelled']
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found or has been cancelled' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching appointment:', error);
        res.status(500).json({ error: 'Error fetching appointment details' });
    }
});

// Endpoint to update appointment user information
app.put('/api/appointment/:confirmationId', async (req, res) => {
    const { confirmationId } = req.params;
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
        return res.status(400).json({ error: 'Name, email, and phone are required' });
    }

    try {
        // Update the appointment
        const result = await pool.query(
            'UPDATE appointments SET name = $1, email = $2, phone = $3 WHERE confirmation_id = $4 RETURNING *',
            [name, email, phone, confirmationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Send confirmation email
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const appointment = result.rows[0];

        let mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Appointment Information Updated',
            html: `
                <div style="color: #000000; font-family: Arial, sans-serif;">
                    <h2 style="color: #000000;">Dear ${name},</h2>
                    <p style="color: #000000;">Your appointment information has been updated successfully.</p>
                    <p style="color: #000000;"><strong>Service:</strong> ${appointment.service}</p>
                    <p style="color: #000000;"><strong>Date:</strong> ${appointment.appointment_date}</p>
                    <p style="color: #000000;"><strong>Time:</strong> ${appointment.time_slot}</p>
                    <p style="color: #000000;">Confirmation ID: <strong>${confirmationId}</strong></p>
                    <br>
                    <p style="color: #000000;">Thank you!</p>
                    <p style="color: #000000;">Jaclyn's Threading Salon</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: 'Appointment updated successfully', appointment: result.rows[0] });

    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Error updating appointment' });
    }
});

// Endpoint to get all appointments for a specific date (for admin/manage booking page)
app.get('/api/appointments/:date', async (req, res) => {
    const { date } = req.params;

    try {
        const result = await pool.query(
            `SELECT 
                a.id,
                a.confirmation_id,
                a.name,
                a.email,
                a.phone,
                a.service,
                a.time_slot,
                a.status
             FROM appointments a
             WHERE a.appointment_date = $1
             ORDER BY a.time_slot`,
            [date]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching appointments for date:', error);
        res.status(500).json({ error: 'Error fetching appointments' });
    }
});

// Endpoint to get all time slots for a date (including booked ones for admin)
app.get('/api/admin/slots/:date', async (req, res) => {
    const { date } = req.params;

    try {
        const result = await pool.query(
            `SELECT 
                ts.id,
                ts.time_slot,
                ts.is_available,
                ts.appointment_id,
                a.name,
                a.email,
                a.phone,
                a.service,
                a.status,
                a.confirmation_id
             FROM time_slots ts
             LEFT JOIN appointments a ON ts.appointment_id = a.id
             WHERE ts.slot_date = $1
             ORDER BY ts.time_slot`,
            [date]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching admin slots:', error);
        res.status(500).json({ error: 'Error fetching slots' });
    }
});

// Endpoint to add a new time slot
app.post('/api/admin/slots', async (req, res) => {
    const { date, timeSlot } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO time_slots (slot_date, time_slot, is_available) VALUES ($1, $2, true) RETURNING *',
            [date, timeSlot]
        );

        res.json({ success: true, slot: result.rows[0] });
    } catch (error) {
        console.error('Error adding slot:', error);
        res.status(500).json({ error: 'Error adding slot' });
    }
});

// Endpoint to delete a time slot
app.delete('/api/admin/slots/:date/:timeSlot', async (req, res) => {
    const { date, timeSlot } = req.params;

    const connection = await pool.connect();

    try {
        await connection.query('BEGIN');

        // Get the slot and associated appointment
        const slotResult = await connection.query(
            'SELECT * FROM time_slots WHERE slot_date = $1 AND time_slot = $2',
            [date, timeSlot]
        );

        if (slotResult.rows.length > 0 && slotResult.rows[0].appointment_id) {
            const appointmentId = slotResult.rows[0].appointment_id;
            
            // Get appointment details before deleting
            const appointmentResult = await connection.query(
                'SELECT name, email, service, appointment_date, time_slot FROM appointments WHERE id = $1',
                [appointmentId]
            );

            if (appointmentResult.rows.length > 0) {
                const appointment = appointmentResult.rows[0];

                // Cancel the appointment
                await connection.query(
                    'UPDATE appointments SET status = $1 WHERE id = $2',
                    ['cancelled', appointmentId]
                );

                // Send cancellation email
                let transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                });

                let mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: appointment.email,
                    subject: 'Appointment Cancelled - Please Contact Jaclyn',
                    html: `
                        <div style="color: #000000; font-family: Arial, sans-serif;">
                            <h2 style="color: #000000;">Dear ${appointment.name},</h2>
                            <p style="color: #000000;">We regret to inform you that your appointment has been cancelled.</p>
                            <p style="color: #000000;"><strong>Service:</strong> ${appointment.service}</p>
                            <p style="color: #000000;"><strong>Date:</strong> ${date}</p>
                            <p style="color: #000000;"><strong>Time:</strong> ${timeSlot}</p>
                            <br>
                            <p style="color: #000000;"><strong>Please contact Jaclyn for assistance with rescheduling or for more information.</strong></p>
                            <br>
                            <p style="color: #000000;">We apologize for any inconvenience.</p>
                            <p style="color: #000000;">Jaclyn's Threading Salon</p>
                        </div>
                    `
                };

                await transporter.sendMail(mailOptions);
            }
        }

        // Delete the slot
        await connection.query(
            'DELETE FROM time_slots WHERE slot_date = $1 AND time_slot = $2',
            [date, timeSlot]
        );

        await connection.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await connection.query('ROLLBACK');
        console.error('Error deleting slot:', error);
        res.status(500).json({ error: 'Error deleting slot' });
    } finally {
        connection.release();
    }
});

// Endpoint to update appointment details
app.put('/api/admin/appointments/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, service } = req.body;

    try {
        await pool.query(
            'UPDATE appointments SET name = $1, email = $2, phone = $3, service = $4 WHERE id = $5',
            [name, email, phone, service, id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Error updating appointment' });
    }
});

// Endpoint to manually mark slot as available/unavailable
app.put('/api/admin/slots/:date/:timeSlot', async (req, res) => {
    const { date, timeSlot } = req.params;
    const { isAvailable } = req.body;

    const connection = await pool.connect();
    
    try {
        await connection.query('BEGIN');

        // Get the slot
        const slotResult = await connection.query(
            'SELECT * FROM time_slots WHERE slot_date = $1 AND time_slot = $2',
            [date, timeSlot]
        );

        if (slotResult.rows.length === 0) {
            await connection.query('ROLLBACK');
            return res.status(404).json({ error: 'Slot not found' });
        }

        const slot = slotResult.rows[0];

        // If marking as available and there's an appointment, cancel it and send email
        if (isAvailable && slot.appointment_id) {
            // Get appointment details before cancelling
            const appointmentResult = await connection.query(
                'SELECT name, email, service FROM appointments WHERE id = $1',
                [slot.appointment_id]
            );

            if (appointmentResult.rows.length > 0) {
                const appointment = appointmentResult.rows[0];

                // Cancel the appointment
                await connection.query(
                    'UPDATE appointments SET status = $1 WHERE id = $2',
                    ['cancelled', slot.appointment_id]
                );

                // Send cancellation email
                let transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                });

                let mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: appointment.email,
                    subject: 'Appointment Cancelled - Please Contact Jaclyn',
                    html: `
                        <div style="color: #000000; font-family: Arial, sans-serif;">
                            <h2 style="color: #000000;">Dear ${appointment.name},</h2>
                            <p style="color: #000000;">We regret to inform you that your appointment has been cancelled.</p>
                            <p style="color: #000000;"><strong>Service:</strong> ${appointment.service}</p>
                            <p style="color: #000000;"><strong>Date:</strong> ${date}</p>
                            <p style="color: #000000;"><strong>Time:</strong> ${timeSlot}</p>
                            <br>
                            <p style="color: #000000;"><strong>Please contact Jaclyn for assistance with rescheduling or for more information.</strong></p>
                            <br>
                            <p style="color: #000000;">We apologize for any inconvenience.</p>
                            <p style="color: #000000;">Jaclyn's Threading Salon</p>
                        </div>
                    `
                };

                await transporter.sendMail(mailOptions);
            }
        }

        // Update the slot
        await connection.query(
            'UPDATE time_slots SET is_available = $1, appointment_id = $2 WHERE slot_date = $3 AND time_slot = $4',
            [isAvailable, isAvailable ? null : slot.appointment_id, date, timeSlot]
        );

        await connection.query('COMMIT');

        res.json({ success: true });
    } catch (error) {
        await connection.query('ROLLBACK');
        console.error('Error updating slot availability:', error);
        res.status(500).json({ error: 'Error updating slot' });
    } finally {
        connection.release();
    }
});

// Google Reviews API endpoint
app.get('/api/reviews', async (req, res) => {
    const PLACE_ID = 'ChIJFTDty1sL04kR8m9QnBmHYKY'; // Jaclyn's Threading Salon
    
    if (!process.env.GOOGLE_API_KEY) {
        return res.status(500).json({ 
            error: 'Google API key not configured',
            message: 'Please add GOOGLE_API_KEY to your .env file' 
        });
    }

    try {
        const fetch = require('node-fetch');
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=name,rating,user_ratings_total,reviews&key=${process.env.GOOGLE_API_KEY}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'OK' && data.result) {
            res.json(data.result);
        } else {
            console.error('Google API Error:', data.status, data.error_message);
            res.status(400).json({ 
                error: data.status,
                message: data.error_message || 'Failed to fetch reviews'
            });
        }
    } catch (error) {
        console.error('Error fetching Google reviews:', error);
        res.status(500).json({ error: 'Error fetching reviews from Google' });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'healthy', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    pool.end(() => {
        console.log('Database pool has ended');
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
