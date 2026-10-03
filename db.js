const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'sentria.db');
const dbDir = path.dirname(dbPath);

// Only try to create directory if it's a custom path (like /data/)
if (dbDir !== __dirname && !fs.existsSync(dbDir)) {
    try {
        fs.mkdirSync(dbDir, { recursive: true });
    } catch (e) {
        console.warn('Could not create DB directory, falling back to local:', e.message);
    }
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ DATABASE ERROR:', err.message);
        process.exit(1); // Exit with error so Render shows it in logs
    } else {
        console.log(`✅ Connected to SQLite at: ${dbPath}`);
        
        // Initialize tables
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT,
                phone TEXT,
                email TEXT,
                role TEXT,
                aadhaar_verified INTEGER,
                trust_score INTEGER DEFAULT 100,
                is_banned INTEGER DEFAULT 0,
                ban_reason TEXT,
                profile_image TEXT,
                district TEXT,
                department TEXT,
                fcm_token TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS complaints (
                id TEXT PRIMARY KEY,
                citizen_id TEXT,
                title TEXT,
                description TEXT,
                category TEXT,
                status TEXT,
                progress_percentage INTEGER DEFAULT 0,
                priority_score INTEGER,
                urgency_level TEXT,
                latitude REAL,
                longitude REAL,
                upload_latitude REAL,
                upload_longitude REAL,
                address TEXT,
                ward_number TEXT,
                district TEXT,
                assigned_officer_id TEXT,
                assigned_officer_name TEXT,
                department_id TEXT,
                media_urls TEXT, -- Stored as JSON string
                work_updates TEXT, -- Stored as JSON string
                image_hash TEXT,
                reports_count INTEGER DEFAULT 1,
                is_fake INTEGER DEFAULT 0,
                fake_reason TEXT,
                expected_completion_date DATETIME,
                due_date_updated INTEGER DEFAULT 0,
                actual_completion_date DATETIME,
                delay_reason TEXT,
                escalation_level TEXT DEFAULT 'None',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (citizen_id) REFERENCES users(id),
                FOREIGN KEY (assigned_officer_id) REFERENCES users(id)
            )`);

            // Migration: add due_date_updated column if not exists
            db.run(`ALTER TABLE complaints ADD COLUMN due_date_updated INTEGER DEFAULT 0`, (err) => {
                // Ignore error if column already exists
            });

            db.run(`ALTER TABLE users ADD COLUMN fcm_token TEXT`, (err) => {
                // Ignore error if column already exists
            });

            db.run(`CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY,
                citizen_id TEXT,
                complaint_id TEXT,
                rating INTEGER,
                comment TEXT,
                language TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (citizen_id) REFERENCES users(id),
                FOREIGN KEY (complaint_id) REFERENCES complaints(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS escalations (
                id TEXT PRIMARY KEY,
                complaint_id TEXT,
                action_taken TEXT,
                notes TEXT,
                escalation_level TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (complaint_id) REFERENCES complaints(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS district_admins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                district TEXT NOT NULL,
                state TEXT DEFAULT 'Madhya Pradesh',
                status TEXT DEFAULT 'Active',
                added_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Seed a default admin and officer if they don't exist
            db.run(`INSERT OR IGNORE INTO users (id, name, phone, email, role, department, district, aadhaar_verified) VALUES 
                ('admin-1', 'Admin Municipal Corp', '9999999999', 'admin@sentria.gov.in', 'Admin', 'MUNICIPAL_CORP', '', 1),
                ('officer-1', 'Rajesh Kumar', '8888888888', 'rajesh@pwd.gov.in', 'Officer', 'PWD', '', 1),
                ('citizen-1', 'Aarav Sharma', '7777777777', 'aarav@citizen.com', 'Citizen', '', '', 1)
            `);

            // Migration: fix existing officer-1 if it was seeded without department
            db.run(`UPDATE users SET department = 'PWD', name = 'Rajesh Kumar' WHERE id = 'officer-1' AND (department IS NULL OR department = '')`);
            
        });
    }
});

module.exports = db;
