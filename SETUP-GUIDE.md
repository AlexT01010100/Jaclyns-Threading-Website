# 🚀 Quick Setup Guide - Jaclyn's Threading Salon

This is the **easiest way** to get your application running with PostgreSQL. Everything is automated!

## ✅ What You Need to Download

### 1. Docker Desktop (Required)
This is the ONLY thing you need to download. It includes everything (PostgreSQL database, Node.js environment, etc.)

**Download Docker Desktop:**
- **Windows**: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
- **Mac (Intel)**: https://desktop.docker.com/mac/main/amd64/Docker.dmg
- **Mac (Apple Silicon)**: https://desktop.docker.com/mac/main/arm64/Docker.dmg

**Installation:**
1. Download and run the installer
2. Follow the installation wizard
3. Restart your computer if prompted
4. Open Docker Desktop
5. Wait for Docker to start (you'll see a whale icon in your system tray/menu bar)

### 2. That's It!
You don't need to install PostgreSQL, Node.js, or anything else separately. Docker handles everything!

## 📝 Setup Steps

### Step 1: Prepare Your Environment File

1. Open your project folder in VS Code
2. Copy the example environment file:
   - On **Windows PowerShell**:
     ```powershell
     Copy-Item .env.example .env
     ```
   - On **Mac/Linux/Git Bash**:
     ```bash
     cp .env.example .env
     ```
   - **OR** manually: duplicate `.env.example` and rename it to `.env`

3. Open the new `.env` file and edit it with your real values:

```env
# Database Configuration (REQUIRED)
DB_HOST=db
DB_PORT=5432
DB_NAME=jaclyns_threading
DB_USER=postgres
DB_PASSWORD=MySecurePassword123!    # ← Change this to a strong password

# Application Configuration
PORT=3000
NODE_ENV=production
BASE_URL=http://localhost:3000

# Email Configuration (REQUIRED for booking confirmations)
EMAIL_USER=your_email@gmail.com           # ← Your Gmail address
EMAIL_PASS=your_app_password_here         # ← Your Gmail app password (see below)
ADMIN_EMAIL=alexterry179@gmail.com        # ← Where to receive notifications

# Twilio SMS (OPTIONAL - leave empty if you don't want SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
ADMIN_PHONE_NUMBER=
```

### Step 2: Get Gmail App Password (for email notifications)

Your regular Gmail password won't work. You need an "App Password":

1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** on the left
3. Under "Signing in to Google," enable **2-Step Verification** if not already enabled
4. Go back to Security → **App Passwords** (or https://myaccount.google.com/apppasswords)
5. Select **Mail** and **Other (Custom name)**
6. Name it "Jaclyn's Threading"
7. Click **Generate**
8. Copy the 16-character password (it will have spaces, that's normal)
9. Paste this password into your `.env` file as `EMAIL_PASS` (remove the spaces)

### Step 3: Start Everything with One Command

1. Open your terminal (Command Prompt, PowerShell, or Terminal)
2. Navigate to your project folder:
   ```bash
   cd path/to/Jaclyns-Threading-Website
   ```

3. Run this single command:
   ```bash
   docker-compose up -d
   ```

**What this does:**
- Downloads PostgreSQL database
- Creates the database structure
- Adds 90 days of available time slots
- Builds your Node.js application
- Starts everything automatically

4. Wait about 1-2 minutes for everything to download and start

### Step 4: Verify It's Working

1. **Check if containers are running:**
   ```bash
   docker-compose ps
   ```
   
   You should see:
   - `jaclyns-threading-db` - Status: Up
   - `jaclyns-threading-app` - Status: Up

2. **Check the health endpoint:**
   Open your browser and go to: http://localhost:3000/health
   
   You should see:
   ```json
   {
     "status": "healthy",
     "database": "connected"
   }
   ```

3. **Open the website:**
   http://localhost:3000

## 🎉 You're Done!

Your website is now running with a PostgreSQL database!

## 📊 Viewing Your Data

### Option 1: Command Line (Simple)

```bash
# Connect to database
docker-compose exec db psql -U postgres -d jaclyns_threading

# View all appointments
SELECT * FROM appointments;

# View available time slots for today
SELECT * FROM time_slots WHERE slot_date = CURRENT_DATE;

# Exit database
\q
```

### Option 2: pgAdmin (GUI Tool) - Optional

If you want a visual interface:

1. Download pgAdmin: https://www.pgadmin.org/download/
2. Install and open pgAdmin
3. Right-click **Servers** → **Register** → **Server**
4. Fill in:
   - **General Tab:**
     - Name: Jaclyn's Threading Local
   - **Connection Tab:**
     - Host: localhost
     - Port: 5432
     - Database: jaclyns_threading
     - Username: postgres
     - Password: (your DB_PASSWORD from .env)
5. Click **Save**

Now you can browse your data visually!

## 🛠️ Common Commands

### View Logs
```bash
# See what's happening
docker-compose logs -f

# See only app logs
docker-compose logs app -f

# See only database logs
docker-compose logs db -f
```

### Stop Everything
```bash
docker-compose down
```

### Restart Everything
```bash
docker-compose restart
```

### Rebuild After Code Changes
```bash
docker-compose up -d --build
```

### Complete Reset (Deletes all data!)
```bash
docker-compose down -v
docker-compose up -d
```

## 🐛 Troubleshooting

### "Docker is not recognized" or "docker-compose not found"

**Solution:** Docker Desktop is not running or not installed
1. Open Docker Desktop application
2. Wait for it to fully start
3. Try the command again

### "port is already allocated" or "port 3000 is already in use"

**Solution:** Something else is using port 3000
1. Stop your old server if it's running
2. Or change the port in `docker-compose.yml`:
   ```yaml
   app:
     ports:
       - "3001:3000"  # Change 3000 to 3001
   ```
3. Run `docker-compose up -d` again

### "Cannot connect to database"

**Solution:** Database might still be starting
1. Wait 30 seconds
2. Check status: `docker-compose ps`
3. Check logs: `docker-compose logs db`
4. If still not working: `docker-compose restart`

### "Permission denied" error

**Solution:** Run terminal as Administrator (Windows) or use `sudo` (Mac/Linux)

### Container keeps restarting

**Solution:** Check the logs
```bash
docker-compose logs app
```
Usually it's a configuration error in your `.env` file

## 📱 Testing the Application

### Test Contact Form
1. Go to http://localhost:3000/contact-me.html
2. Fill out the form
3. Submit
4. Check your admin email

### Test Booking
1. Go to http://localhost:3000/book-appointment.html
2. Fill in details
3. Select a date and time slot
4. Submit
5. Check confirmation email

### View Booking in Database
```bash
docker-compose exec db psql -U postgres -d jaclyns_threading

SELECT name, service, appointment_date, time_slot 
FROM appointments 
ORDER BY created_at DESC 
LIMIT 5;

\q
```

## 🔄 Migrating Old Firebase Data (Optional)

If you have existing Firebase data:

1. Export from Firebase Console (Firestore Database → Export)
2. Transform the data to SQL format
3. Import using:
   ```bash
   docker-compose exec db psql -U postgres -d jaclyns_threading
   
   INSERT INTO appointments (confirmation_id, name, email, phone, service, appointment_date, time_slot)
   VALUES ('ABC123', 'John Doe', 'john@example.com', '+1234567890', 'Threading', '2025-01-15', '10:00 AM');
   ```

## 💡 Tips

1. **Keep Docker Desktop running** - Your database needs it
2. **Back up regularly** - Use `docker-compose exec db pg_dump`
3. **Don't commit .env** - It contains passwords!
4. **Check logs if issues** - `docker-compose logs` is your friend

## 🆘 Still Need Help?

1. Check logs: `docker-compose logs`
2. Verify .env file has correct values
3. Make sure Docker Desktop is running
4. Try restarting: `docker-compose restart`

## 🎓 What's Actually Running?

When you run `docker-compose up -d`:

1. **PostgreSQL Container** (jaclyns-threading-db)
   - Runs on port 5432
   - Stores all your data
   - Automatically creates tables
   - Persistent storage (data survives restarts)

2. **Node.js App Container** (jaclyns-threading-app)
   - Runs on port 3000
   - Connects to PostgreSQL
   - Serves your website
   - Handles bookings and emails

Both containers talk to each other through Docker's network, completely isolated from your system!

---

**That's it! You're all set up.** 🎉

For more advanced topics, see `DOCKER-README.md`.
