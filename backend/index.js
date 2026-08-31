const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 1. Initialize SQLite Database
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('✅ Connected to the SQLite database.');
        createTables();
    }
});

// 2. Define the Schema (Added title & author to claims)
function createTables() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS papers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            user_email TEXT,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paper_id INTEGER,
            title TEXT,
            authors TEXT,
            url_or_doi TEXT,
            raw_text TEXT,
            FOREIGN KEY(paper_id) REFERENCES papers(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS claims (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paper_id INTEGER,
            source_id INTEGER,
            claim_text TEXT,
            source_context TEXT,
            title TEXT,
            author TEXT,
            verification_status TEXT,
            confidence_score REAL,
            FOREIGN KEY(paper_id) REFERENCES papers(id),
            FOREIGN KEY(source_id) REFERENCES sources(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            google_id TEXT UNIQUE,
            name TEXT,
            email TEXT,
            avatar TEXT,
            login_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        console.log('✅ Database tables verified/created.');
    });
}

// 3. Health Route
app.get('/api/health', (req, res) => {
    res.json({ message: 'Backend and Database are running!' });
});

// 4. File Upload Configuration
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDFs are allowed'));
    }
});

// 5. The Upload Route
app.post('/api/upload', upload.single('paper'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const title = req.file.originalname;
    const status = 'processing';

    const query = `INSERT INTO papers (title, status) VALUES (?, ?)`;
    
    db.run(query, [title, status], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to save to database' });
        }
        
        const newPaperId = this.lastID;
        const uploadedFilePath = req.file.path;

        res.json({
            message: 'Paper uploaded successfully. Processing started.',
            paperId: newPaperId
        });

        const pythonExecutable = path.join(__dirname, '../nlp_engine/venv/Scripts/python.exe');
        const scriptPath = path.join(__dirname, '../nlp_engine/extract.py');
        
        const pythonProcess = spawn(pythonExecutable, [scriptPath, uploadedFilePath]);

        let pythonData = '';

        pythonProcess.stdout.on('data', (data) => {
            pythonData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python Log: ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
            if (code === 0 && pythonData) {
                try {
                    const jsonStart = pythonData.indexOf('[');
                    const jsonEnd = pythonData.lastIndexOf(']');
                    
                    if (jsonStart === -1 || jsonEnd === -1) {
                        throw new Error("No valid JSON array found in Python output.");
                    }
                    
                    const cleanJson = pythonData.substring(jsonStart, jsonEnd + 1);
                    const claims = JSON.parse(cleanJson);
                    
                    // Include title and author in the insert query
                    const insertStmt = db.prepare(`INSERT INTO claims (paper_id, claim_text, source_context, title, author, verification_status, confidence_score) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                    
                    claims.forEach(c => {
                        insertStmt.run([newPaperId, c.claim, c.source_context, c.title, c.author, c.status, c.confidence]);
                    });
                    insertStmt.finalize();

                    db.run(`UPDATE papers SET status = 'completed' WHERE id = ?`, [newPaperId]);
                    console.log(`✅ Paper ${newPaperId} processed and claims saved.`);
                } catch (err) {
                    console.error('Failed to parse Python JSON output:', err.message);
                    db.run(`UPDATE papers SET status = 'failed' WHERE id = ?`, [newPaperId]);
                }
            } else {
                console.error(`Python script exited with code ${code}`);
                db.run(`UPDATE papers SET status = 'failed' WHERE id = ?`, [newPaperId]);
            }
        });
    });
});

// 6. SerpAPI Route
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    const apiKey = process.env.SERPAPI_KEY;
    
    try {
        const response = await axios.get(`https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(query)}&api_key=${apiKey}`);
        res.json(response.data);
    } catch (error) {
        console.error('SerpAPI error:', error.message);
        res.status(500).json({ error: 'Failed to fetch from Google Scholar' });
    }
});

// 7. Fetch Results for a Specific Paper
app.get('/api/results/:paperId', (req, res) => {
    const paperId = req.params.paperId;
    
    db.get(`SELECT status FROM papers WHERE id = ?`, [paperId], (err, paper) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!paper) return res.status(404).json({ error: 'Paper not found' });
        if (paper.status !== 'completed') return res.json({ status: paper.status });

        db.all(`SELECT * FROM claims WHERE paper_id = ?`, [paperId], (err, claims) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ status: 'completed', claims: claims });
        });
    });
});

app.get('/api/history', (req, res) => {
    const userEmail = req.query.email;

    // Safe query that works whether or not user_email is present
    let query = `
        SELECT 
            p.id, 
            p.title, 
            p.upload_date as date, 
            p.status, 
            COUNT(c.id) as claims 
        FROM papers p 
        LEFT JOIN claims c ON p.id = c.paper_id 
    `;
    
    let params = [];
    // Only filter if your database table actually has a user_email column, 
    // otherwise omit the WHERE clause to return all history safely for now:
    if (userEmail) {
        query += ` WHERE p.user_email = ? `;
        params.push(userEmail);
    }

    query += ` GROUP BY p.id ORDER BY p.upload_date DESC `;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error("Database error fetching history:", err.message);
            // Fallback: if user_email column is missing, return unfiltered history instead of 500 error
            db.all(`SELECT p.id, p.title, p.upload_date as date, p.status, COUNT(c.id) as claims FROM papers p LEFT JOIN claims c ON p.id = c.paper_id GROUP BY p.id ORDER BY p.upload_date DESC`, [], (fallbackErr, fallbackRows) => {
                if (fallbackErr) {
                    return res.status(500).json({ error: 'Failed to fetch history' });
                }
                return res.json(fallbackRows);
            });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/auth/google', (req, res) => {
    const { googleId, name, email, avatar } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Invalid user data' });
    }

    const query = `
        INSERT INTO users (google_id, name, email, avatar) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(google_id) DO UPDATE SET 
        name=excluded.name, 
        avatar=excluded.avatar,
        login_date=CURRENT_TIMESTAMP
    `;

    db.run(query, [googleId, name, email, avatar], function(err) {
        if (err) {
            console.error('Database error saving user:', err.message);
            return res.status(500).json({ error: 'Failed to save user session' });
        }
        res.json({ success: true, message: 'User stored successfully', user: { name, email, avatar } });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});