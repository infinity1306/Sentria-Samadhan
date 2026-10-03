const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('sentira.db');

db.run("ALTER TABLE complaints ADD COLUMN image_hash TEXT;", (err) => {
    if (err) console.log("image_hash already exists or error:", err.message);
    else console.log("Added image_hash column");
});

db.run("ALTER TABLE complaints ADD COLUMN reports_count INTEGER DEFAULT 1;", (err) => {
    if (err) console.log("reports_count already exists or error:", err.message);
    else console.log("Added reports_count column");
});
