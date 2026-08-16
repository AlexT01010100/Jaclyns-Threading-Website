const express = require('express');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

// Initialize Twilio - optional, SMS notifications are a non-critical feature
// and a missing/invalid credential here must not prevent the server from
// starting (it previously did, taking down the whole site).
let client = null;
if (process.env.TWILIO_ACCOUNT_SID?.startsWith('AC') && process.env.TWILIO_AUTH_TOKEN) {
    client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✓ Twilio initialized');
} else {
    console.warn('⚠ TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not set or invalid - SMS notifications will be skipped');
}

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('✓ SendGrid initialized');
} else {
    console.warn('⚠ SENDGRID_API_KEY not set - emails will fail');
}

// Helper function to send emails via SendGrid
async function sendEmail(to, subject, html) {
    try {
        if (process.env.SENDGRID_API_KEY) {
            // Use SendGrid
            const msg = {
                to,
                from: process.env.EMAIL_USER,
                subject,
                html
            };
            await sgMail.send(msg);
            console.log(`✓ SendGrid email sent to: ${to}`);
            return true;
        } else {
            // Fallback to nodemailer (for local development)
            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to,
                subject,
                html
            });
            console.log(`✓ Nodemailer email sent to: ${to}`);
            return true;
        }
    } catch (error) {
        console.error('✗ Error sending email:', error.message);
        return false;
    }
}

// time_slot is stored as a Postgres TIME column and comes back as a 24-hour
// "HH:MM:SS" string - format it for customer-facing emails/SMS/messages
function formatTimeTo12Hour(timeString) {
    const [hour, minute] = timeString.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

const app = express();
const port = process.env.PORT || 3000;

// Apply helmet for security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for now to avoid breaking existing functionality
    crossOriginEmbedderPolicy: false
}));

// Global rate limiter - prevents DoS attacks
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limiter for sensitive endpoints
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Even stricter rate limiter for booking endpoints
const bookingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 booking attempts per windowMs
    message: 'Too many booking attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Trust proxy - required when behind nginx/load balancer
app.set('trust proxy', 1);

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

// Session configuration with PostgreSQL store
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Apply global rate limiter to all requests - AFTER SESSION
app.use(globalLimiter);

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
    } else {
        console.log('Successfully connected to PostgreSQL database');
        release();
    }
});

// Keep the booking calendar rolling 90 days out. The initial seed only ever
// runs once (docker-entrypoint-initdb.d only executes against an empty
// volume), so without this the calendar would quietly run dry 90 days after
// deployment. Runs once at startup, then once a day.
const DAY_MS = 24 * 60 * 60 * 1000;
async function topUpTimeSlots() {
    try {
        await pool.query(`SELECT ensure_time_slots(CURRENT_DATE, (CURRENT_DATE + INTERVAL '90 days')::date)`);
        console.log('✓ Time slots topped up through +90 days');
    } catch (error) {
        console.error('✗ Error topping up time slots:', error.message);
    }
}
topUpTimeSlots();
setInterval(topUpTimeSlots, DAY_MS);

// One-time bootstrap: seed the admin_users table from ADMIN_USERNAME /
// ADMIN_PASSWORD_HASH in .env, but only if the table is still empty. This
// runs on every startup but only ever inserts once - after that, admin_users
// is the source of truth and .env's copy is ignored, so changing the
// password via /admin/change-password sticks across restarts/redeploys
// instead of reverting to whatever's in .env.
async function seedAdminUserIfEmpty() {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM admin_users');
        if (parseInt(result.rows[0].count, 10) > 0) {
            return;
        }
        if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH) {
            console.warn('⚠ admin_users is empty and ADMIN_USERNAME/ADMIN_PASSWORD_HASH not set - admin login will not work until a user is seeded');
            return;
        }
        await pool.query(
            'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)',
            [process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD_HASH]
        );
        console.log(`✓ Seeded initial admin user "${process.env.ADMIN_USERNAME}" from .env (one-time bootstrap)`);
    } catch (error) {
        console.error('✗ Error seeding admin user:', error.message);
    }
}
seedAdminUserIfEmpty();

// Security headers and cache control
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Cache control headers to fix browser back button issue
    // Prevent caching of HTML pages
    if (req.path.endsWith('.html') || req.path === '/') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// CORS configuration - must allow credentials for sessions to work
app.use(cors({
    origin: true, // In production, specify your domain
    credentials: true
}));

// Request size limits to prevent DoS attacks through large payloads
app.use(bodyParser.urlencoded({ 
    extended: false,
    limit: '1mb' // Limit request body size to 1MB
}));
app.use(bodyParser.json({ 
    limit: '1mb' // Limit JSON payload size to 1MB
}));

// Authentication middleware for HTML pages - redirects to login on failure
const requireAuth = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/admin-login.html');
};

// Authentication middleware for admin JSON APIs - returns 401 instead of
// redirecting, since a fetch() call can't follow a redirect to an HTML page
const requireApiAuth = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
};

// Protected route for manage-booking - must come BEFORE express.static
app.get('/manage-booking.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'manage-booking.html'));
});

// Serve static files with proper cache headers
app.use(express.static('public', {
    setHeaders: (res, path) => {
        // Cache static assets (CSS, JS, images) for 1 day
        if (path.endsWith('.css') || path.endsWith('.js') || path.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        }
    }
}));

// Admin login endpoint with rate limiting
app.post('/admin/login', strictLimiter, async (req, res) => {
    const { username, password } = req.body;

    try {
        if (typeof username !== 'string' || typeof password !== 'string') {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const result = await pool.query('SELECT username, password_hash FROM admin_users WHERE username = $1', [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const passwordMatches = await bcrypt.compare(password, result.rows[0].password_hash);

        if (passwordMatches) {
            // Regenerate session ID for security
            req.session.regenerate((err) => {
                if (err) {
                    console.error('Session regeneration error:', err);
                    return res.status(500).json({ error: 'Login failed - session error' });
                }

                req.session.isAuthenticated = true;
                req.session.username = username;

                // Save session before sending response
                req.session.save((err) => {
                    if (err) {
                        console.error('Session save error:', err);
                        return res.status(500).json({ error: 'Login failed - session error' });
                    }
                    res.json({ success: true, message: 'Login successful' });
                });
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Change the logged-in admin's own password - lets the password be rotated
// from the admin panel instead of requiring a hash regenerated by hand and a
// redeploy every time.
app.post('/admin/change-password', requireApiAuth, strictLimiter, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 10) {
        return res.status(400).json({ error: 'New password must be at least 10 characters.' });
    }

    try {
        const username = req.session.username;
        const result = await pool.query('SELECT password_hash FROM admin_users WHERE username = $1', [username]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Admin user not found.' });
        }

        const currentMatches = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!currentMatches) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const newHash = await bcrypt.hash(newPassword, 12);
        await pool.query(
            'UPDATE admin_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2',
            [newHash, username]
        );

        res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Error changing admin password:', error);
        res.status(500).json({ error: 'Error changing password.' });
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

// Endpoint to handle contact form submission with rate limiting
app.post('/send_email', strictLimiter, async (req, res) => {
    const { fullName, phoneNumber, email, message } = req.body;

    try {
        // Store contact message in database
        await pool.query(
            'INSERT INTO contact_messages (full_name, phone_number, email, message) VALUES ($1, $2, $3, $4)',
            [fullName, phoneNumber, email, message]
        );

        // Send success response immediately
        res.send('Email sent successfully.');

        // Send email asynchronously
        setImmediate(async () => {
            const emailHtml = `
                <div style="color: #000000; font-family: Arial, sans-serif;">
                    <h2 style="color: #000000;">Contact Form Submission</h2>
                    <p style="color: #000000;"><strong>Name:</strong> ${fullName}</p>
                    <p style="color: #000000;"><strong>Phone:</strong> ${phoneNumber}</p>
                    <p style="color: #000000;"><strong>Email:</strong> ${email}</p>
                    <br>
                    <p style="color: #000000;"><strong>Message:</strong></p>
                    <p style="color: #000000;">${message}</p>
                </div>
            `;
            
            await sendEmail(
                process.env.ADMIN_EMAIL || 'alexterry179@gmail.com',
                `Contact Form Submission from ${fullName}`,
                emailHtml
            );
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

// Endpoint to handle appointment booking with strict rate limiting
// Service durations, in 30-minute slots. Shared by both booking paths below.
const serviceDurationSlots = {
    // Threading services - 1 slot (30 minutes) each
    'threading - eyebrows ($14)': 1,
    'threading - upper lip ($7)': 1,
    'threading - lower lip ($6)': 1,
    'threading - chin ($8)': 1,
    'threading - neck ($8)': 1,
    'threading - forehead ($7)': 1,
    'threading - sideburns ($12)': 1,
    'threading - fullface special ($38)': 2, // 1 hour

    // Permanent Makeup - 5 slots (2.5 hours)
    'microblading ($380)': 5,
    'machine hair strokes ($395)': 5,

    // Lash services
    'lash lift + tint ($150)': 2, // 1 hour
    'lash tint ($25)': 1, // 30 minutes

    // Brow services
    'brow lamination + tint ($120)': 2, // 1 hour
    'brow tint ($18)': 1, // 30 minutes

    // Microneedling - 3 slots (1.5 hours)
    'microneedling ($250)': 3,
    'microneedling + nano brows ($390)': 4, // 2 hours
    'phibright microneedling ($270)': 3,

    // Bioneedling - 3 slots (1.5 hours)
    'bioneedling ($220)': 3
};

// Runs the actual booking transaction: locks the required consecutive slots,
// inserts the appointment, and marks the slots unavailable. Shared by the
// public booking form and the admin "book for a phone-in customer" flow so
// both go through the exact same consecutive-slot-locking logic. Throws an
// Error with .status set for expected failures (bad slot, no longer
// available) so callers can relay a proper 400 instead of a generic 500.
async function createAppointment({ name, email, phone, service, date, slot }) {
    const { v4: uuidv4 } = require('uuid');
    const confirmationId = uuidv4();
    const connection = await pool.connect();

    try {
        await connection.query('BEGIN');

        const slotsNeeded = serviceDurationSlots[service.toLowerCase()] || 2;
        const startTime = slot;

        // Get all slots for this date, ordered by time (TIME column sorts
        // chronologically at the DB level, unlike the old "9:00 AM" strings)
        const allSlotsResult = await connection.query(
            'SELECT time_slot FROM time_slots WHERE slot_date = $1 ORDER BY time_slot',
            [date]
        );

        const allSlots = allSlotsResult.rows.map(row => row.time_slot);
        const startIndex = allSlots.indexOf(startTime);

        if (startIndex === -1) {
            await connection.query('ROLLBACK');
            throw Object.assign(new Error('Invalid time slot'), { status: 400 });
        }

        // Get the consecutive slots needed
        const slotsToBook = allSlots.slice(startIndex, startIndex + slotsNeeded);

        if (slotsToBook.length < slotsNeeded) {
            await connection.query('ROLLBACK');
            throw Object.assign(new Error('Not enough consecutive time slots available for this service'), { status: 400 });
        }

        // Check if all required slots are available
        for (const timeSlot of slotsToBook) {
            const slotCheck = await connection.query(
                'SELECT is_available FROM time_slots WHERE slot_date = $1 AND time_slot = $2 FOR UPDATE',
                [date, timeSlot]
            );

            if (slotCheck.rows.length === 0 || !slotCheck.rows[0].is_available) {
                await connection.query('ROLLBACK');
                throw Object.assign(new Error(`Time slot ${formatTimeTo12Hour(timeSlot)} is no longer available. Please select a different time.`), { status: 400 });
            }
        }

        // Create appointment
        const appointmentResult = await connection.query(
            `INSERT INTO appointments (confirmation_id, name, email, phone, service, appointment_date, time_slot, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'booked') RETURNING id`,
            [confirmationId, name, email, phone, service, date, slot]
        );

        const appointmentId = appointmentResult.rows[0].id;

        // Update all required time slots
        for (const timeSlot of slotsToBook) {
            await connection.query(
                'UPDATE time_slots SET is_available = false, appointment_id = $1 WHERE slot_date = $2 AND time_slot = $3',
                [appointmentId, date, timeSlot]
            );
        }

        await connection.query('COMMIT');
        return { confirmationId, name, email, phone, service, date, slot };
    } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
    } finally {
        connection.release();
    }
}

// Sends the customer confirmation (always) and, unless notifyAdmin is false,
// the "new appointment" admin notification email/SMS. notifyAdmin is turned
// off for admin-initiated bookings (e.g. a phone-in customer) since the
// admin is the one who just created it and doesn't need to be told.
async function sendBookingNotifications({ confirmationId, name, email, phone, service, date, slot, notifyAdmin }) {
    try {
        const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
        const displayTime = formatTimeTo12Hour(slot);

        const userEmailHtml = `
            <div style="color: #000000; font-family: Arial, sans-serif;">
                <h2 style="color: #000000;">Dear ${name},</h2>
                <p style="color: #000000;">Your appointment for <strong>${service}</strong> has been successfully booked on <strong>${date}</strong> at <strong>${displayTime}</strong>.</p>
                <p style="color: #000000;">You can manage your appointment using the following link:</p>
                <p style="color: #000000;"><a href="${baseUrl}/modify-appointment.html?confirmationId=${confirmationId}&date=${date}" style="color: #0066cc;">Manage Appointment</a></p>
                <p style="color: #000000;">Confirmation ID: <strong>${confirmationId}</strong></p>
                <br>
                <p style="color: #000000;">Thank you!</p>
                <p style="color: #000000;">Jaclyn's Beauty</p>
            </div>
        `;

        await sendEmail(email, 'Appointment Confirmation', userEmailHtml);

        if (notifyAdmin) {
            const adminEmailHtml = `
                <div style="color: #000000; font-family: Arial, sans-serif;">
                    <h2 style="color: #000000;">New Appointment Booking</h2>
                    <p style="color: #000000;"><strong>Name:</strong> ${name}</p>
                    <p style="color: #000000;"><strong>Email:</strong> ${email}</p>
                    <p style="color: #000000;"><strong>Phone:</strong> ${phone}</p>
                    <p style="color: #000000;"><strong>Service:</strong> ${service}</p>
                    <p style="color: #000000;"><strong>Date:</strong> ${date}</p>
                    <p style="color: #000000;"><strong>Time:</strong> ${displayTime}</p>
                    <p style="color: #000000;"><strong>Confirmation ID:</strong> ${confirmationId}</p>
                </div>
            `;

            await sendEmail(process.env.ADMIN_EMAIL || 'alexterry179@gmail.com', 'New Appointment Booking', adminEmailHtml);
        }

        // Send SMS notifications if Twilio is configured
        if (client && process.env.TWILIO_PHONE_NUMBER) {
            try {
                await client.messages.create({
                    body: `Hi ${name}, your appointment for ${service} is confirmed on ${date} at ${displayTime}. Confirmation: ${confirmationId}`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: phone
                });

                if (notifyAdmin) {
                    await client.messages.create({
                        body: `New appointment: ${name}, ${service}, ${date} at ${displayTime}`,
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: process.env.ADMIN_PHONE_NUMBER
                    });
                }
                console.log('✓ SMS notifications sent');
            } catch (smsError) {
                console.error('✗ Error sending SMS:', smsError.message);
            }
        }
    } catch (error) {
        console.error('✗ Error in background email/SMS:', error.message);
    }
}

app.post('/book_appointment', bookingLimiter, async (req, res) => {
    const { name, email, phone, service, date, slot } = req.body;

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !service || !date || !slot) {
        return res.status(400).json({ error: 'Name, email, phone, service, date, and time slot are all required.' });
    }

    try {
        const appointment = await createAppointment({ name, email, phone, service, date, slot });
        res.json({ success: true, message: 'Appointment booked successfully', confirmationId: appointment.confirmationId });
        setImmediate(() => sendBookingNotifications({ ...appointment, notifyAdmin: true }));
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error('Error booking appointment:', error);
        res.status(500).json({ error: 'Error booking appointment' });
    }
});

// Admin endpoint to book an available slot on behalf of a customer who
// called in instead of using the website. Same booking logic/guarantees as
// the public form (no double-booking, same duration rules) - just skips the
// "new appointment" self-notification since the admin is the one booking it.
app.post('/api/admin/book-appointment', requireApiAuth, async (req, res) => {
    const { name, email, phone, service, date, slot } = req.body;

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !service || !date || !slot) {
        return res.status(400).json({ error: 'Name, email, phone, service, date, and time slot are all required.' });
    }

    try {
        const appointment = await createAppointment({ name, email, phone, service, date, slot });
        res.json({ success: true, message: 'Appointment booked successfully', confirmationId: appointment.confirmationId });
        setImmediate(() => sendBookingNotifications({ ...appointment, notifyAdmin: false }));
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error('Error booking appointment (admin):', error);
        res.status(500).json({ error: 'Error booking appointment' });
    }
});

// Endpoint to cancel an appointment with rate limiting
app.post('/cancel-appointment', strictLimiter, async (req, res) => {
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

        // Send success response immediately
        res.json({ success: true, message: 'Appointment cancelled successfully' });

        // Send emails asynchronously
        setImmediate(async () => {
            // Send cancellation email to customer
            const userEmailHtml = `
                <div style="color: #000000; font-family: Arial, sans-serif;">
                    <h2 style="color: #000000;">Dear ${appointment.name},</h2>
                    <p style="color: #000000;">Your appointment on <strong>${date}</strong> at <strong>${formatTimeTo12Hour(appointment.time_slot)}</strong> has been cancelled.</p>
                    <p style="color: #000000;">If you'd like to reschedule, please visit our booking page.</p>
                    <br>
                    <p style="color: #000000;">Thank you!</p>
                    <p style="color: #000000;">Jaclyn's Beauty</p>
                </div>
            `;
            
            await sendEmail(appointment.email, 'Appointment Cancelled', userEmailHtml);

            // Send admin notification email
            const adminEmailHtml = `
                <div style="color: #000000; font-family: Arial, sans-serif;">
                    <h2 style="color: #000000;">Appointment Cancellation Notice</h2>
                    <p style="color: #000000;">A customer has cancelled their appointment:</p>
                    <p style="color: #000000;"><strong>Customer Name:</strong> ${appointment.name}</p>
                    <p style="color: #000000;"><strong>Email:</strong> ${appointment.email}</p>
                    <p style="color: #000000;"><strong>Date:</strong> ${date}</p>
                    <p style="color: #000000;"><strong>Time:</strong> ${formatTimeTo12Hour(appointment.time_slot)}</p>
                    <p style="color: #000000;"><strong>Confirmation ID:</strong> ${confirmationId}</p>
                    <br>
                    <p style="color: #000000;">The time slot has been freed up and is now available for booking.</p>
                </div>
            `;
            
            await sendEmail(
                process.env.ADMIN_EMAIL || 'alexterry179@gmail.com',
                'Customer Cancelled Appointment',
                adminEmailHtml
            );
        });

    } catch (error) {
        await connection.query('ROLLBACK');
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ error: 'Error cancelling appointment' });
    } finally {
        connection.release();
    }
});

// Endpoint to edit/reschedule an appointment with rate limiting
app.post('/edit-appointment', strictLimiter, async (req, res) => {
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

        // Send success response immediately
        res.json({ success: true, message: 'Appointment updated successfully' });

        // Send email asynchronously
        setImmediate(async () => {
            const emailHtml = `
                <div style="color: #000000; font-family: Arial, sans-serif;">
                    <h2 style="color: #000000;">Dear ${appointment.name},</h2>
                    <p style="color: #000000;">Your appointment has been updated:</p>
                    <p style="color: #000000;"><strong>Service:</strong> ${newService}</p>
                    <p style="color: #000000;"><strong>Date:</strong> ${newDate}</p>
                    <p style="color: #000000;"><strong>Time:</strong> ${formatTimeTo12Hour(newSlot)}</p>
                    <p style="color: #000000;">Confirmation ID: <strong>${confirmationId}</strong></p>
                    <br>
                    <p style="color: #000000;">Thank you!</p>
                    <p style="color: #000000;">Jaclyn's Beauty</p>
                </div>
            `;
            
            await sendEmail(appointment.email, 'Appointment Updated', emailHtml);
        });

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
            'SELECT name, email, phone, service, appointment_date, time_slot, status, confirmation_id FROM appointments WHERE confirmation_id = $1',
            [confirmationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching appointment:', error);
        res.status(500).json({ error: 'Error fetching appointment details' });
    }
});

// Endpoint to update appointment user information with rate limiting
app.put('/api/appointment/:confirmationId', strictLimiter, async (req, res) => {
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

        const appointment = result.rows[0];

        // Send success response immediately
        res.json({ success: true, message: 'Appointment updated successfully', appointment: result.rows[0] });

        // Send confirmation email asynchronously
        setImmediate(async () => {
            const emailHtml = `
                <div style="color: #000000; font-family: Arial, sans-serif;">
                    <h2 style="color: #000000;">Dear ${name},</h2>
                    <p style="color: #000000;">Your appointment information has been updated successfully.</p>
                    <p style="color: #000000;"><strong>Service:</strong> ${appointment.service}</p>
                    <p style="color: #000000;"><strong>Date:</strong> ${appointment.appointment_date}</p>
                    <p style="color: #000000;"><strong>Time:</strong> ${formatTimeTo12Hour(appointment.time_slot)}</p>
                    <p style="color: #000000;">Confirmation ID: <strong>${confirmationId}</strong></p>
                    <br>
                    <p style="color: #000000;">Thank you!</p>
                    <p style="color: #000000;">Jaclyn's Beauty</p>
                </div>
            `;
            
            await sendEmail(email, 'Appointment Information Updated', emailHtml);
        });

    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Error updating appointment' });
    }
});

// Endpoint to get all appointments for a specific date (for admin/manage booking page)
app.get('/api/appointments/:date', requireApiAuth, async (req, res) => {
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
app.get('/api/admin/slots/:date', requireApiAuth, async (req, res) => {
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
app.post('/api/admin/slots', requireApiAuth, async (req, res) => {
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
app.delete('/api/admin/slots/:date/:timeSlot', requireApiAuth, async (req, res) => {
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

                // Send cancellation email asynchronously
                const emailHtml = `
                    <div style="color: #000000; font-family: Arial, sans-serif;">
                        <h2 style="color: #000000;">Dear ${appointment.name},</h2>
                        <p style="color: #000000;">We regret to inform you that your appointment has been cancelled.</p>
                        <p style="color: #000000;"><strong>Service:</strong> ${appointment.service}</p>
                        <p style="color: #000000;"><strong>Date:</strong> ${date}</p>
                        <p style="color: #000000;"><strong>Time:</strong> ${formatTimeTo12Hour(timeSlot)}</p>
                        <br>
                        <p style="color: #000000;"><strong>Please contact Jaclyn for assistance with rescheduling or for more information.</strong></p>
                        <br>
                        <p style="color: #000000;">We apologize for any inconvenience.</p>
                        <p style="color: #000000;">Jaclyn's Beauty</p>
                    </div>
                `;
                
                setImmediate(async () => {
                    await sendEmail(appointment.email, 'Appointment Cancelled - Please Contact Jaclyn', emailHtml);
                });
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
app.put('/api/admin/appointments/:id', requireApiAuth, async (req, res) => {
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
app.put('/api/admin/slots/:date/:timeSlot', requireApiAuth, async (req, res) => {
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

                // Send cancellation email asynchronously
                const emailHtml = `
                    <div style="color: #000000; font-family: Arial, sans-serif;">
                        <h2 style="color: #000000;">Dear ${appointment.name},</h2>
                        <p style="color: #000000;">We regret to inform you that your appointment has been cancelled.</p>
                        <p style="color: #000000;"><strong>Service:</strong> ${appointment.service}</p>
                        <p style="color: #000000;"><strong>Date:</strong> ${date}</p>
                        <p style="color: #000000;"><strong>Time:</strong> ${formatTimeTo12Hour(timeSlot)}</p>
                        <br>
                        <p style="color: #000000;"><strong>Please contact Jaclyn for assistance with rescheduling or for more information.</strong></p>
                        <br>
                        <p style="color: #000000;">We apologize for any inconvenience.</p>
                        <p style="color: #000000;">Jaclyn's Beauty</p>
                    </div>
                `;
                
                setImmediate(async () => {
                    await sendEmail(appointment.email, 'Appointment Cancelled - Please Contact Jaclyn', emailHtml);
                });
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

// Google Reviews API endpoint - serves from an in-memory cache refreshed
// periodically instead of calling Google on every page load. Place Details
// (with the reviews/rating fields) is a paid, billed API call, and reviews
// don't change minute to minute, so there's no reason to pay for a fresh
// call per visitor.
const PLACE_ID = 'ChIJFTDty1sL04kR8m9QnBmHYKY'; // Jaclyn's Beauty
const REVIEWS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
let reviewsCache = null; // { data } - last successful Google response

async function fetchGoogleReviews() {
    const fetch = require('node-fetch');
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=name,rating,user_ratings_total,reviews&key=${process.env.GOOGLE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.result) {
        return data.result;
    }
    const error = new Error(data.error_message || 'Failed to fetch reviews');
    error.status = 400;
    error.body = { error: data.status, message: data.error_message || 'Failed to fetch reviews' };
    throw error;
}

async function refreshReviewsCache() {
    if (!process.env.GOOGLE_API_KEY) {
        console.warn('⚠ GOOGLE_API_KEY not set - reviews cache will stay empty');
        return;
    }
    try {
        reviewsCache = { data: await fetchGoogleReviews() };
        console.log('✓ Google reviews cache refreshed');
    } catch (error) {
        console.error('✗ Error refreshing Google reviews cache:', error.message);
    }
}
refreshReviewsCache();
setInterval(refreshReviewsCache, REVIEWS_CACHE_TTL_MS);

app.get('/api/reviews', strictLimiter, async (req, res) => {
    if (reviewsCache) {
        return res.json(reviewsCache.data);
    }

    if (!process.env.GOOGLE_API_KEY) {
        return res.status(500).json({
            error: 'Google API key not configured',
            message: 'Please add GOOGLE_API_KEY to your .env file'
        });
    }

    // Cache hasn't been populated yet (cold start, or Google was unavailable
    // at boot) - fetch on demand this one time so the page isn't left empty.
    try {
        const data = await fetchGoogleReviews();
        reviewsCache = { data };
        res.json(data);
    } catch (error) {
        console.error('Error fetching Google reviews:', error.message);
        res.status(error.status || 500).json(error.body || { error: 'Error fetching reviews from Google' });
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
    console.log('DoS/DDoS protection enabled with rate limiting');
    console.log('Request size limits: 1MB');
});
