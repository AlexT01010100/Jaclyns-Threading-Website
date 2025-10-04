# Jaclyn's Threading Salon - Docker & PostgreSQL Setup

This guide explains how to run the application using Docker with PostgreSQL instead of Firebase.

## 📋 Prerequisites

- Docker Desktop installed ([Download here](https://www.docker.com/products/docker-desktop))
- Docker Compose (included with Docker Desktop)
- Basic understanding of command line

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd Jaclyns-Threading-Website
```

### 2. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit the `.env` file and add your credentials:

```env
# Required - Database password
DB_PASSWORD=your_secure_password

# Required - Email credentials
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
ADMIN_EMAIL=admin@example.com

# Optional - Twilio SMS (leave empty if not using)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
ADMIN_PHONE_NUMBER=
```

### 3. Build and Run with Docker

```bash
# Build and start all containers
docker-compose up -d

# View logs
docker-compose logs -f

# Check container status
docker-compose ps
```

The application will be available at: **http://localhost:3000**

### 4. Stop the Application

```bash
# Stop containers
docker-compose down

# Stop and remove volumes (deletes database data)
docker-compose down -v
```

## 📦 What's Included

### Docker Services

1. **PostgreSQL Database** (`db`)
   - Port: 5432
   - Persistent storage with Docker volumes
   - Auto-initializes with schema and seed data

2. **Node.js Application** (`app`)
   - Port: 3000
   - Connects to PostgreSQL
   - Handles appointments, emails, and SMS

### Database Structure

- **appointments** - Stores booking information
- **time_slots** - Manages availability
- **contact_messages** - Stores contact form submissions
- **reviews** - Stores customer reviews

## 🔧 Common Commands

### View Application Logs

```bash
docker-compose logs app -f
```

### View Database Logs

```bash
docker-compose logs db -f
```

### Access PostgreSQL Database

```bash
# Connect to database container
docker-compose exec db psql -U postgres -d jaclyns_threading

# Example queries
SELECT * FROM appointments;
SELECT * FROM time_slots WHERE slot_date = CURRENT_DATE;
SELECT * FROM contact_messages ORDER BY created_at DESC;
```

### Restart Services

```bash
# Restart just the app
docker-compose restart app

# Restart everything
docker-compose restart
```

### Rebuild Containers

```bash
# Rebuild after code changes
docker-compose up -d --build
```

## 🔄 Migrating from Firebase to PostgreSQL

### Data Migration Steps

1. **Export Firebase Data**
   - Go to Firebase Console → Firestore Database
   - Export your collections (appointments, availability, etc.)

2. **Transform Data**
   - Convert Firebase documents to SQL format
   - Map Firebase fields to PostgreSQL columns

3. **Import to PostgreSQL**
   ```bash
   # Connect to database
   docker-compose exec db psql -U postgres -d jaclyns_threading
   
   # Insert appointments
   INSERT INTO appointments (confirmation_id, name, email, phone, service, appointment_date, time_slot, status)
   VALUES ('CONF123', 'John Doe', 'john@example.com', '+1234567890', 'Threading', '2025-01-15', '10:00 AM', 'booked');
   ```

### Update Frontend

The frontend JavaScript files may need updates to work with the new API endpoints:

- `/api/available-slots/:date` - Get available time slots
- `/api/appointment/:confirmationId` - Get appointment details
- `/book_appointment` - Book new appointment
- `/cancel-appointment` - Cancel appointment
- `/edit-appointment` - Modify appointment

## 🛠️ Development Mode

For development with hot-reload:

1. Uncomment the volume mounts in `docker-compose.yml`:

```yaml
volumes:
  - ./public:/app/public
  - ./server-sql.js:/app/server-sql.js
```

2. Install nodemon in the container:

```dockerfile
# In Dockerfile, change:
CMD ["node", "server-sql.js"]
# To:
CMD ["npx", "nodemon", "server-sql.js"]
```

3. Rebuild and start:

```bash
docker-compose up -d --build
```

## 🔐 Security Notes

### Production Deployment

1. **Environment Variables**
   - Never commit `.env` file to Git
   - Use secrets management in production (AWS Secrets Manager, etc.)

2. **Database Security**
   - Use strong passwords
   - Don't expose database port in production
   - Enable SSL connections

3. **Application Security**
   - Keep dependencies updated: `npm audit fix`
   - Use HTTPS in production
   - Implement rate limiting

### Gmail App Passwords

To get an app password for Gmail:
1. Enable 2-factor authentication on your Google account
2. Go to Google Account → Security → App Passwords
3. Generate a new app password for "Mail"
4. Use this password in `EMAIL_PASS`

## 📊 Monitoring & Health Checks

### Health Check Endpoint

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### Database Health

```bash
docker-compose exec db pg_isready -U postgres
```

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs

# Check container status
docker ps -a

# Remove and recreate
docker-compose down
docker-compose up -d
```

### Database Connection Issues

```bash
# Verify database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Test connection
docker-compose exec db psql -U postgres -d jaclyns_threading -c "SELECT 1"
```

### Port Already in Use

If port 3000 or 5432 is already in use:

1. Edit `docker-compose.yml`
2. Change port mapping:
   ```yaml
   ports:
     - "3001:3000"  # Use different external port
   ```
3. Restart: `docker-compose up -d`

### Reset Everything

```bash
# Stop all containers and remove volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Start fresh
docker-compose up -d --build
```

## 📝 Backup & Restore

### Backup Database

```bash
# Create backup
docker-compose exec db pg_dump -U postgres jaclyns_threading > backup.sql

# Or with timestamp
docker-compose exec db pg_dump -U postgres jaclyns_threading > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database

```bash
# Restore from backup
cat backup.sql | docker-compose exec -T db psql -U postgres jaclyns_threading
```

## 🌐 Production Deployment

### Deploy to Cloud

1. **AWS ECS/Fargate**
   - Push Docker image to ECR
   - Use RDS for PostgreSQL
   - Set environment variables in ECS

2. **Google Cloud Run**
   - Build and push to Google Container Registry
   - Use Cloud SQL for PostgreSQL
   - Configure secrets in Secret Manager

3. **DigitalOcean App Platform**
   - Connect GitHub repository
   - Use managed PostgreSQL database
   - Set environment variables in dashboard

### Environment Variables for Production

Update `.env` for production:

```env
NODE_ENV=production
PORT=3000
BASE_URL=https://yourdomain.com
DB_HOST=your-production-db-host
DB_PASSWORD=strong-production-password
```

## 📞 Support

If you encounter issues:
1. Check the logs: `docker-compose logs`
2. Verify environment variables
3. Ensure Docker is running
4. Check firewall/port settings

## 📄 Additional Files

- `server-sql.js` - Main application with PostgreSQL
- `server.js` - Original Firebase version (legacy)
- `database/schema.sql` - Database structure
- `database/seed.sql` - Initial data seeding
- `Dockerfile` - Container configuration
- `docker-compose.yml` - Multi-container orchestration

## 🔄 Switching Between Firebase and PostgreSQL

### Use PostgreSQL (Default)

```bash
npm start
# or
docker-compose up -d
```

### Use Firebase (Legacy)

```bash
npm run start:firebase
```

---

**Note**: The original Firebase implementation is still available in `server.js` for reference, but the PostgreSQL version (`server-sql.js`) is now the default and recommended approach.
