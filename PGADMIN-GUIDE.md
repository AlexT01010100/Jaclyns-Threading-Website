# 📊 PostgreSQL GUI Setup Guide - pgAdmin

This guide will help you set up pgAdmin to view and manage your PostgreSQL database visually.

## 🎯 Option 1: Quick Command Line Check (No GUI Needed)

Before setting up a GUI, let's verify your data exists:

```bash
# Connect to your database
docker-compose exec db psql -U postgres -d jaclyns_threading

# Once connected, run these commands:

# Check tables
\dt

# Count time slots (should show 810+ slots for 90 days)
SELECT COUNT(*) FROM time_slots;

# View first 10 time slots
SELECT * FROM time_slots LIMIT 10;

# Check appointments
SELECT * FROM appointments;

# Exit
\q
```

## 🖥️ Option 2: pgAdmin (Visual GUI) - Recommended

### Step 1: Download & Install pgAdmin

1. Go to: https://www.pgadmin.org/download/
2. Choose your operating system:
   - **Windows**: Download `.exe` installer
   - **Mac**: Download `.dmg` file
3. Install pgAdmin (default settings are fine)
4. Launch pgAdmin

### Step 2: Connect to Your Database

Once pgAdmin opens:

1. **Register a New Server**
   - Right-click **Servers** in the left panel
   - Click **Register** → **Server**

2. **General Tab**
   - **Name**: `Jaclyn's Threading Local`
   - (This is just a display name, use whatever you like)

3. **Connection Tab** - Fill in these details:
   ```
   Host name/address: localhost
   Port: 5432
   Maintenance database: postgres
   Username: postgres
   Password: JaclynIsTheBest123  (from your .env file)
   ```

4. **Advanced Tab** (Optional)
   - **DB restriction**: `jaclyns_threading`
   - (This limits the view to just your database)

5. Click **Save**

### Step 3: Navigate to Your Data

After connecting:

1. In the left panel, expand:
   ```
   Servers
   └── Jaclyn's Threading Local
       └── Databases
           └── jaclyns_threading
               └── Schemas
                   └── public
                       └── Tables
   ```

2. You should see 4 tables:
   - `appointments`
   - `contact_messages`
   - `reviews`
   - `time_slots`

### Step 4: View Your Data

**To see the data:**

1. **Right-click** on a table (e.g., `time_slots`)
2. Select **View/Edit Data** → **First 100 Rows**
3. Data will appear in the right panel

**Expected data:**
- `time_slots`: Should have ~810 rows (90 days × 9 time slots per day)
- `appointments`: Will be empty until someone books
- `contact_messages`: Will be empty until someone contacts
- `reviews`: Will be empty until reviews are added

### Step 5: Run Custom Queries

To run your own SQL queries:

1. **Right-click** on `jaclyns_threading` database
2. Select **Query Tool**
3. Type your SQL, for example:
   ```sql
   -- See all available slots for today
   SELECT * FROM time_slots 
   WHERE slot_date = CURRENT_DATE 
   AND is_available = true;
   
   -- See all appointments
   SELECT * FROM appointments 
   ORDER BY created_at DESC;
   
   -- Count slots by date
   SELECT slot_date, COUNT(*) as total_slots
   FROM time_slots
   GROUP BY slot_date
   ORDER BY slot_date;
   ```
4. Click the **Execute** button (▶️ or F5)

## 🐛 Troubleshooting

### "No data" or Tables Are Empty

**Check 1: Are containers running?**
```bash
docker-compose ps
```
Should show both containers as "Up"

**Check 2: Did the seed script run?**
```bash
# Connect to database
docker-compose exec db psql -U postgres -d jaclyns_threading

# Count time slots
SELECT COUNT(*) FROM time_slots;
```

If count is 0, the seed script didn't run. Fix it:

```bash
# Stop containers
docker-compose down -v

# Start fresh (this will recreate the database)
docker-compose up -d

# Wait 30 seconds for initialization
# Then check again
```

**Check 3: Wrong database selected?**
- Make sure you're connected to `jaclyns_threading` database, not `postgres`
- In pgAdmin, look at the top of the query tool - it should say `jaclyns_threading`

### Can't Connect to Database

**Error: "Could not connect to server"**

1. **Check Docker is running:**
   ```bash
   docker-compose ps
   ```

2. **Check database is healthy:**
   ```bash
   docker-compose logs db
   ```

3. **Verify port 5432 is open:**
   ```bash
   # On Windows PowerShell
   Test-NetConnection -ComputerName localhost -Port 5432
   ```

4. **Try restarting:**
   ```bash
   docker-compose restart db
   # Wait 10 seconds
   ```

**Error: "password authentication failed"**
- Double-check your password in `.env` file
- Make sure you're using: `JaclynIsTheBest123`
- Password is case-sensitive

### pgAdmin Shows "No tables found"

1. **Refresh the schema:**
   - Right-click on **Tables**
   - Select **Refresh**

2. **Make sure you're in the right place:**
   - Navigate to: Servers → Jaclyn's Threading Local → Databases → `jaclyns_threading` → Schemas → `public` → Tables

3. **Check if tables were created:**
   ```bash
   docker-compose exec db psql -U postgres -d jaclyns_threading -c "\dt"
   ```

## 🔄 Alternative: Use TablePlus (Easier GUI)

TablePlus is simpler and more modern than pgAdmin:

1. Download: https://tableplus.com/
2. Install and open
3. Click **Create a new connection**
4. Choose **PostgreSQL**
5. Fill in:
   ```
   Name: Jaclyn's Threading
   Host: localhost
   Port: 5432
   User: postgres
   Password: JaclynIsTheBest123
   Database: jaclyns_threading
   ```
6. Click **Connect**

Your tables will appear in the left sidebar immediately!

## 📝 Useful SQL Queries for Testing

### View Today's Available Slots
```sql
SELECT time_slot, is_available 
FROM time_slots 
WHERE slot_date = CURRENT_DATE
ORDER BY time_slot;
```

### View All Appointments
```sql
SELECT 
    name,
    service,
    appointment_date,
    time_slot,
    status,
    created_at
FROM appointments
ORDER BY appointment_date DESC, time_slot;
```

### Check Next 7 Days Availability
```sql
SELECT 
    slot_date,
    COUNT(*) as total_slots,
    SUM(CASE WHEN is_available THEN 1 ELSE 0 END) as available_slots
FROM time_slots
WHERE slot_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
GROUP BY slot_date
ORDER BY slot_date;
```

### View Contact Messages
```sql
SELECT * FROM contact_messages 
ORDER BY created_at DESC;
```

## 💡 Pro Tips

1. **Keep pgAdmin Open**: Once connected, pgAdmin stays connected
2. **Refresh Data**: Right-click table → **View/Edit Data** → **First 100 Rows** to refresh
3. **Backup Database**: 
   ```bash
   docker-compose exec db pg_dump -U postgres jaclyns_threading > backup.sql
   ```
4. **Restore Backup**:
   ```bash
   cat backup.sql | docker-compose exec -T db psql -U postgres jaclyns_threading
   ```

## 🎓 What Each Table Means

- **time_slots**: All available time slots (9am-5pm, 90 days ahead)
- **appointments**: Booked appointments (created when someone books)
- **contact_messages**: Messages from contact form
- **reviews**: Customer reviews (for future use)

---

Need help? Check the logs:
```bash
docker-compose logs db
docker-compose logs app
