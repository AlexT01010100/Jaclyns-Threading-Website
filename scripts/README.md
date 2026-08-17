# Database backups

`backup-db.sh` dumps the Postgres database to a gzipped file and deletes
backups older than 30 days. `restore-db.sh` restores from one of those files.

## One-time setup on the droplet

```bash
cd /path/to/Jaclyns-Threading-Website
chmod +x scripts/backup-db.sh scripts/restore-db.sh
sudo mkdir -p /var/backups/jaclyns-threading
```

Run it once by hand to confirm it works:

```bash
./scripts/backup-db.sh
```

Then add it to cron to run daily at 3am:

```bash
crontab -e
```

Add this line (adjust the path to match where the repo actually lives on
the droplet):

```
0 3 * * * /path/to/Jaclyns-Threading-Website/scripts/backup-db.sh >> /var/log/jaclyns-backup.log 2>&1
```

## Restoring

```bash
./scripts/restore-db.sh /var/backups/jaclyns-threading/backup_20260101_030000.sql.gz
```

This overwrites the current database, so it asks for confirmation first.

## Important: these backups still live on the same droplet

`backup-db.sh` protects against accidental data corruption or a bad
`DELETE`/migration - it does **not** protect against losing the droplet
itself (disk failure, account compromise, accidentally destroying the
droplet). For real disaster recovery, periodically copy the backup
directory somewhere else. Two easy options:

**From your own machine**, pull backups down on a schedule:
```bash
scp your-user@your-droplet-ip:/var/backups/jaclyns-threading/backup_*.sql.gz ./local-backups/
```

**Or sync to cloud storage from the droplet** with `rclone` (supports S3,
Backblaze B2, Google Drive, etc.) - install it, run `rclone config` once to
add your storage provider, then add a second cron line after the backup job:
```
5 3 * * * rclone copy /var/backups/jaclyns-threading remote:jaclyns-backups
```

Either is fine - the point is having a copy that survives losing the
droplet entirely, not just losing a table.
