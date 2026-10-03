require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'sentria.samadhan@gmail.com',
    pass: process.env.EMAIL_PASS || 'dummy_password'
  }
});

async function sendEmailNotification(to, subject, html) {
  if (!to) {
    console.log(`[Mock Email] No 'to' address | Subject: ${subject}`);
    return;
  }
  if (!process.env.EMAIL_USER) {
    console.log(`[Mock Email] process.env.EMAIL_USER not set | To: ${to} | Subject: ${subject}`);
    // We will still try to send it, but it might fail authentication if no user is set.
  }
  try {
    await transporter.sendMail({
      from: `"Sentria Samadhan" <${process.env.EMAIL_USER || 'sentria.samadhan@gmail.com'}>`,
      to,
      subject,
      html
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

async function sendPushNotification(token, title, body, data = {}) {
  if (!token || !firebaseAdmin) {
    console.log(`[Mock Push] No token or Firebase Admin not init | Title: ${title}`);
    return;
  }

  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // Common for mobile apps
      },
      token: token,
    };

    const response = await firebaseAdmin.messaging().send(message);
    console.log('Successfully sent push notification:', response);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}
const db = require('./db');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const crypto = require('crypto');

// ── Firebase Admin Init ────────────────────────────────────────
let firebaseAdmin;
try {
  const admin = require('firebase-admin');
  const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
  
    if (fs.existsSync(serviceAccountPath)) {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(require(serviceAccountPath)),
        });
      }
      firebaseAdmin = admin;
      console.log('✅ Firebase Admin initialized via JSON file');
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      if (!admin.apps.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
      firebaseAdmin = admin;
      console.log('✅ Firebase Admin initialized via Environment Variable');
    } else {
      console.warn('⚠️  Firebase credentials not found (JSON or ENV). Push notifications and Auth verification disabled.');
    }
  } catch (e) {
    console.warn('⚠️  firebase-admin initialization failed:', e.message);
  }

const app = express();
const port = process.env.PORT || 3001;

// ── Super Admin Email Whitelist ─────────────────────────────────
const SUPER_ADMIN_EMAILS = [
  'siddhant.giri2622@gmail.com',
  'siddhantgiri677@gmail.com',
];

function isSuperAdmin(email) {
  return SUPER_ADMIN_EMAILS.includes((email || '').toLowerCase().trim());
}

const uploadsDir = process.env.DB_PATH
  ? path.join(path.dirname(process.env.DB_PATH), 'uploads')
  : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve uploaded files statically with CORS enabled
app.use('/uploads', cors(), express.static(uploadsDir, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// Request logging for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

const CIVIC_CATEGORIES = {
  Roads: {
    department_id: 'PWD',
    authority_name: 'Public Works Department',
    examples: ['pothole', 'broken road', 'damaged footpath', 'road obstruction']
  },
  Sanitation: {
    department_id: 'SANITATION',
    authority_name: 'Municipal Sanitation Department',
    examples: ['garbage pile', 'overflowing bin', 'dirty public area']
  },
  Electricity: {
    department_id: 'ELECTRICITY_BOARD',
    authority_name: 'Electricity Board',
    examples: ['broken streetlight', 'exposed wire', 'fallen electric pole']
  },
  Water: {
    department_id: 'WATER_WORKS',
    authority_name: 'Water Works Department',
    examples: ['water leakage', 'broken pipeline', 'sewage overflow', 'flooding']
  },
  Traffic: {
    department_id: 'TRAFFIC_POLICE',
    authority_name: 'Traffic Police',
    examples: ['signal failure', 'traffic obstruction', 'unsafe junction']
  },
  Environment: {
    department_id: 'ENVIRONMENT',
    authority_name: 'Environment Department',
    examples: ['fallen tree', 'pollution', 'public hazard']
  },
  Fire: {
    department_id: 'FIRE_DEPT',
    authority_name: 'Fire & Emergency Services',
    examples: ['fire breakout', 'short circuit fire', 'gas leak', 'trapped in building']
  },
  Other: {
    department_id: 'MUNICIPAL_CORP',
    authority_name: 'Municipal Corporation',
    examples: ['other verified civic issue']
  }
};

// Initialize Gemini Client (Will fail gracefully if key is missing)
let ai;
if(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_api_key_here') {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// Model fallback chain — if one model is rate-limited, try the next
const MODEL_CHAIN = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function generateWithRetry(contents, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const model of MODEL_CHAIN) {
      try {
        console.log(`🤖 Trying ${model} (attempt ${attempt + 1})...`);
        const response = await ai.models.generateContent({ model, contents });
        console.log(`✅ ${model} succeeded!`);
        return response;
      } catch (e) {
        lastError = e;
        const errMsg = e.message || '';
        if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
          console.log(`⚠️  ${model} rate-limited`);
          continue; // Try next model
        }
        if (errMsg.includes('404')) {
          console.log(`⚠️  ${model} not found, skipping`);
          continue; // Model doesn't exist, try next
        }
        // Other errors (auth, bad request) — throw immediately
        throw e;
      }
    }
    // All models failed this attempt — wait before retrying
    if (attempt < maxRetries - 1) {
      const waitSec = (attempt + 1) * 15; // 15s, 30s
      console.log(`⏳ All models rate-limited, waiting ${waitSec}s before retry...`);
      await sleep(waitSec * 1000);
    }
  }
  // All retries exhausted
  throw lastError;
}

// Set up storage for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP, HEIC or HEIF images are allowed.'));
    }
    cb(null, true);
  }
});

// Directory creation moved up to uploadsDir definition

// ── Rate Limiting (per-citizen, in-memory) ──────────────────────
const rateLimitMap = new Map(); // key: IP → { count, resetAt }
const RATE_LIMIT_MAX = 10;      // max uploads per window
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ── Image Hash Store (duplicate detection) ──────────────────────
const imageHashSet = new Set();

function computeImageHash(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ── EXIF Metadata Extractor (lightweight, no deps) ─────────────
function extractBasicExif(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const meta = {};
    
    // Check for JFIF/EXIF markers in JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      meta.format = 'JPEG';
      meta.fileSize = buffer.length;
      meta.hasExif = buffer.includes(Buffer.from('Exif'));
    } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
      meta.format = 'PNG';
      meta.fileSize = buffer.length;
      meta.hasExif = false;
    } else {
      meta.format = 'OTHER';
      meta.fileSize = buffer.length;
      meta.hasExif = false;
    }
    
    // Timestamp from file stats
    const stats = fs.statSync(filePath);
    meta.fileCreated = stats.birthtime.toISOString();
    meta.fileModified = stats.mtime.toISOString();
    
    // Very small files are suspicious (< 10KB often means placeholder)
    meta.suspiciousSize = buffer.length < 10240;
    
    return meta;
  } catch {
    return { format: 'UNKNOWN', fileSize: 0, hasExif: false };
  }
}

// ── AI-Generated Image Detection Engine ─────────────────────────
// Checks multiple technical signals that indicate an image was created
// by DALL-E, Midjourney, Stable Diffusion, or similar AI generators.

const AI_TOOL_SIGNATURES = [
  'stable diffusion', 'stablediffusion', 'sd model',
  'dall-e', 'dall·e', 'dalle',
  'midjourney', 'mj',
  'comfyui', 'comfy ui', 'automatic1111', 'a1111',
  'invoke ai', 'invokeai',
  'leonardo ai', 'leonardo.ai',
  'dreamstudio', 'dream studio',
  'nightcafe', 'playground ai',
  'adobe firefly', 'firefly',
  'bing image creator', 'copilot',
  'flux', 'sdxl', 'sd 1.5', 'sd 2.1', 'sd3',
  'cfg scale', 'sampler:', 'steps:', 'seed:',
  'negative prompt', 'checkpoint', 'lora',
  'txt2img', 'img2img',
  'made with ai', 'ai generated', 'ai-generated',
  'aitag', 'dream', 'generated by',
];

// Common AI-generated image resolutions
const AI_RESOLUTIONS = new Set([
  '256x256', '512x512', '768x768', '1024x1024', '1536x1536', '2048x2048',
  '512x768', '768x512', '512x896', '896x512',
  '768x1024', '1024x768', '768x1344', '1344x768',
  '1024x1792', '1792x1024',  // DALL-E 3
  '1024x1536', '1536x1024',  // SDXL
  '896x1152', '1152x896',
]);

function detectAIGenerated(filePath, exifMeta) {
  const signals = {
    is_ai_generated: false,
    ai_confidence: 0,      // 0.0 to 1.0
    signals_detected: [],
    tool_detected: '',
  };

  try {
    const buffer = fs.readFileSync(filePath);
    const bufferStr = buffer.toString('latin1'); // for text scanning
    let score = 0;

    // ── Signal 1: Scan for AI tool name signatures in metadata ──
    const lowerStr = bufferStr.toLowerCase();
    for (const sig of AI_TOOL_SIGNATURES) {
      if (lowerStr.includes(sig)) {
        score += 40;
        signals.signals_detected.push(`AI tool signature found: "${sig}"`);
        signals.tool_detected = sig;
        break; // one match is enough
      }
    }

    // ── Signal 2: PNG tEXt / iTXt chunk analysis ──
    if (exifMeta.format === 'PNG') {
      // PNG stores metadata in tEXt chunks — AI tools write parameters here
      const textChunkKeywords = ['parameters', 'prompt', 'comment', 'description', 'software', 'source'];
      for (const keyword of textChunkKeywords) {
        const idx = lowerStr.indexOf(keyword);
        if (idx !== -1) {
          // Check if nearby text contains AI-related content
          const nearby = lowerStr.slice(Math.max(0, idx - 20), idx + 200);
          const hasAIContent = AI_TOOL_SIGNATURES.some(s => nearby.includes(s)) ||
                              /\bsteps\b.*\bcfg\b/i.test(nearby) ||
                              /\bsampler\b/i.test(nearby) ||
                              /\bnegative.?prompt\b/i.test(nearby);
          if (hasAIContent) {
            score += 35;
            signals.signals_detected.push(`PNG metadata chunk "${keyword}" contains AI generation parameters`);
            break;
          }
        }
      }

      // PNG without any camera metadata but very large = likely AI
      if (!exifMeta.hasExif && exifMeta.fileSize > 500000) {
        score += 10;
        signals.signals_detected.push('Large PNG without any EXIF/camera data');
      }
    }

    // ── Signal 3: Detect AI-typical resolutions ──
    // Read image dimensions from header
    const dims = getImageDimensions(buffer, exifMeta.format);
    if (dims) {
      const dimStr = `${dims.width}x${dims.height}`;
      if (AI_RESOLUTIONS.has(dimStr)) {
        score += 20;
        signals.signals_detected.push(`Resolution ${dimStr} matches common AI generator output`);
      }
      // Perfect square images are more suspicious
      if (dims.width === dims.height && dims.width >= 512) {
        score += 10;
        signals.signals_detected.push(`Perfect square ${dims.width}x${dims.height} — uncommon for real photos`);
      }
      // AI images rarely have odd dimensions like 4032x3024 (real camera sensors)
      if (dims.width % 64 === 0 && dims.height % 64 === 0 && dims.width >= 512) {
        score += 5;
        signals.signals_detected.push('Dimensions are exact multiples of 64 (common in AI diffusion models)');
      }
    }

    // ── Signal 4: JPEG without EXIF on large high-quality image ──
    if (exifMeta.format === 'JPEG' && !exifMeta.hasExif && exifMeta.fileSize > 300000) {
      score += 10;
      signals.signals_detected.push('High-quality JPEG with no camera EXIF data');
    }

    // ── Signal 5: Check for C2PA / Content Credentials ──
    // Many AI tools now embed C2PA provenance markers
    if (bufferStr.includes('c2pa') || bufferStr.includes('contentcredentials') || 
        bufferStr.includes('Content Credentials') || bufferStr.includes('cr:ai')) {
      score += 30;
      signals.signals_detected.push('C2PA/Content Credentials AI marker detected');
    }

    // ── Signal 6: IPTC / XMP "AI Generated" markers ──
    if (bufferStr.includes('DigitalSourceType') || bufferStr.includes('trainedAlgorithmicMedia') ||
        bufferStr.includes('compositeWithTrainedAlgorithmicMedia')) {
      score += 35;
      signals.signals_detected.push('IPTC DigitalSourceType indicates AI-generated content');
    }

    // Clamp to 0-100 and compute
    score = Math.min(100, score);
    signals.ai_confidence = score / 100;
    signals.is_ai_generated = score >= 30; // 30+ means likely AI

  } catch (e) {
    console.error('AI detection heuristic error:', e.message);
  }

  return signals;
}

// Extract width/height from image headers without external deps
function getImageDimensions(buffer, format) {
  try {
    if (format === 'PNG' && buffer.length > 24) {
      // PNG: width at offset 16, height at offset 20 (big-endian uint32)
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }
    if (format === 'JPEG') {
      // JPEG: scan for SOF0/SOF2 markers (0xFF 0xC0 or 0xFF 0xC2)
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xFF) { offset++; continue; }
        const marker = buffer[offset + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7),
          };
        }
        // Skip to next marker
        const segLen = buffer.readUInt16BE(offset + 2);
        offset += 2 + segLen;
      }
    }
  } catch {}
  return null;
}


// -------------------------
// API ROUTES
// -------------------------

app.get('/', (req, res) => {
    res.json({
      name: 'Sentira AI Backend',
      status: 'running',
      version: '1.2.0',
      endpoints: {
        health: '/api/health',
        textReport: '/api/text-report',
        feedbackCheck: '/api/feedback/check'
      }
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// 3. Text-only Analysis Route
app.post('/api/text-report', async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim().length < 10) {
        return res.status(400).json({ success: false, error: 'Please provide a detailed description (min 10 chars).' });
    }

    if(!ai) {
        return res.status(503).json({ success: false, error: 'System not configured.' });
    }

    try {
        const prompt = `
You are Sentira AI, a strict civic grievance analyst.
Task: Analyze the following text description of a civic issue.
1. Decide if it's a valid reportable public civic issue.
2. If valid, classify and route it.

Allowed categories and routing:
${JSON.stringify(CIVIC_CATEGORIES, null, 2)}

User Text: "${text}"

Respond ONLY with a JSON object:
{
  "is_civic_issue": boolean,
  "title": "Short title",
  "description": "Cleaned up description",
  "category": "One of the keys above",
  "urgency_level": "Low|Medium|High|Emergency",
  "priority_score": 1-10,
  "confidence": 0.0-1.0,
  "address": "Extracted address or location description from text",
  "citizen_question": "Follow up question"
}
        `;

        const response = await generateWithRetry(prompt);

        const raw = extractJson(response.text);
        const analysis = normalizeAnalysis(raw);
        
        res.json({ success: true, analysis });
    } catch (error) {
        console.error("Text Analysis Error:", error.message?.substring(0, 200));
        const isQuota = (error.message || '').includes('429') || (error.message || '').includes('quota');
        res.status(isQuota ? 429 : 500).json({ 
          success: false, 
          error: isQuota ? 'System is temporarily busy. Please try again in 60 seconds.' : 'System Analysis failed' 
        });
    }
});

// 9.5 Check Feedback Status
app.get('/api/feedback/check', (req, res) => {
    const { citizen_id, complaint_id } = req.query;
    if (!citizen_id || !complaint_id) return res.status(400).json({ error: 'Missing parameters' });
    
    db.get('SELECT id FROM feedback WHERE citizen_id = ? AND complaint_id = ?', [citizen_id, complaint_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ hasSubmitted: Boolean(row) });
    });
});

// ── Middleware: Verify Firebase ID Token ──────────────────────
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.replace('Bearer ', '').trim();

  if (!idToken) return res.status(401).json({ error: 'No auth token provided.' });

  if (idToken === 'mock-id-token') {
    req.firebaseUid = req.body.uid || 'demo-user-' + Date.now();
    return next();
  }

  if (!firebaseAdmin) {
    // Firebase Admin not configured – allow dev mode through
    req.firebaseUid = req.body.uid || 'dev-uid';
    return next();
  }

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    req.firebaseUid = decoded.uid;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// 1. Firebase-verified Login / Auto-register
app.post('/api/auth/firebase-login', verifyFirebaseToken, (req, res) => {
  const { uid, name, email, phone, profileImage } = req.body;
  const firebaseUid = req.firebaseUid;

  // Determine role based on super admin whitelist
  const isSuper = isSuperAdmin(email);

  // Check if user is a district admin
  db.get('SELECT * FROM district_admins WHERE email = ?', [email || ''], (errAdmin, adminRow) => {
    const assignedRole = isSuper ? 'SuperAdmin' : (adminRow ? 'Admin' : null);
    const assignedDistrict = adminRow ? adminRow.district : null;

    // Find by Firebase UID first, then by email or phone (ignoring empty strings)
    db.get('SELECT * FROM users WHERE id = ? OR (email != "" AND email = ?) OR (phone != "" AND phone = ?) ORDER BY (CASE WHEN role="SuperAdmin" THEN 1 WHEN role="Admin" THEN 2 WHEN role="Officer" THEN 3 ELSE 4 END) ASC',
      [firebaseUid, email || '', phone || ''],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
          // If this email is a super admin or district admin, ensure role is updated
          const newRole = assignedRole || row.role;
          // Also update district if they became an admin
          const newDistrict = assignedDistrict || row.district;

          db.run('UPDATE users SET profile_image = ?, name = ?, role = ?, district = ? WHERE id = ?',
            [profileImage || row.profile_image, name || row.name, newRole, newDistrict, row.id]);

          if (row.is_banned) {
            return res.status(403).json({ error: 'Account banned', reason: row.ban_reason });
          }
          return res.json({ user: { ...row, role: newRole, district: newDistrict, profile_image: profileImage || row.profile_image } });
        } else {
          // New user – create record using Firebase UID as primary key
          const role = assignedRole || 'Citizen';
          db.run(
            'INSERT OR IGNORE INTO users (id, name, phone, email, role, aadhaar_verified, profile_image, trust_score, district) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [firebaseUid, name || 'Citizen', phone || '', email || '', role, 0, profileImage || '', 100, assignedDistrict || ''],
            function(insertErr) {
              if (insertErr) return res.status(500).json({ error: insertErr.message });
              db.get('SELECT * FROM users WHERE id = ?', [firebaseUid], (err2, newUser) => {
                res.json({ user: newUser });
              });
            }
          );
        }
      }
    );
  });
});


// Update FCM Token
app.post('/api/auth/update-fcm-token', verifyFirebaseToken, (req, res) => {
  const { fcm_token } = req.body;
  const firebaseUid = req.firebaseUid;

  if (!fcm_token) return res.status(400).json({ error: 'FCM token is required.' });

  db.run('UPDATE users SET fcm_token = ? WHERE id = ?', [fcm_token, firebaseUid], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'FCM token updated successfully.' });
  });
});

// 2. Demo Login (Bypass Firebase for testing/hackathon presentations)
app.post('/api/auth/demo-login', (req, res) => {
  const { name } = req.body;
  const displayName = (name && name.trim()) || 'Demo Citizen';
  const demoUid = 'demo-user-' + Date.now();
  db.run(
    'INSERT INTO users (id, name, phone, email, role, aadhaar_verified, profile_image, trust_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [demoUid, displayName, '9999999999', 'demo@sentira.ai', 'Citizen', 1, '', 100],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM users WHERE id = ?', [demoUid], (err2, newUser) => {
        res.json({ user: newUser, token: 'demo-token-' + demoUid });
      });
    }
  );
});

app.get('/api/ai/status', async (req, res) => {
    if (!ai) {
      return res.json({ configured: false, error: 'GEMINI_API_KEY not set' });
    }
    // Live test — actually call the API to check if the key works
    try {
      const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'Reply with just OK' });
      res.json({
        configured: true,
        working: true,
        model: 'gemini-2.5-flash',
        testResponse: r.text?.substring(0, 50),
        keyPrefix: process.env.GEMINI_API_KEY?.substring(0, 8) + '...'
      });
    } catch (e) {
      const errMsg = e.message || '';
      const isQuota = errMsg.includes('429') || errMsg.includes('quota');
      res.json({
        configured: true,
        working: false,
        error: isQuota ? 'API quota exceeded - rate limited' : errMsg.substring(0, 200),
        keyPrefix: process.env.GEMINI_API_KEY?.substring(0, 8) + '...',
        hint: isQuota ? 'Wait 60s or use a new API key from a DIFFERENT Google account' : 'Check if your API key is valid'
      });
    }
});

// Helper function to read file as inline data for Gemini
function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    },
  };
}

function extractJson(text = '') {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1) {
    throw new Error('AI response did not contain JSON.');
  }
  return JSON.parse(cleaned.slice(first, last + 1));
}

function normalizeAnalysis(raw) {
  const allowedCategories = Object.keys(CIVIC_CATEGORIES);
  const category = allowedCategories.includes(raw.category) ? raw.category : 'Other';
  const route = CIVIC_CATEGORIES[category];
  const priority = Math.min(10, Math.max(1, Number(raw.priority_score) || 5));
  const urgency = ['Low', 'Medium', 'High', 'Emergency'].includes(raw.urgency_level)
    ? raw.urgency_level
    : priority >= 9 ? 'Emergency' : priority >= 7 ? 'High' : priority >= 4 ? 'Medium' : 'Low';

  return {
    is_civic_issue: Boolean(raw.is_civic_issue),
    is_fake: Boolean(raw.is_fake),
    is_ai_generated: Boolean(raw.is_ai_generated),
    fake_reason: raw.fake_reason || '',
    rejection_reason: raw.rejection_reason || '',
    title: raw.title || 'Civic Issue Detected',
    description: raw.description || 'The uploaded image appears to show a civic issue that needs review.',
    extracted_text: raw.extracted_text || '',
    category,
    urgency_level: urgency,
    priority_score: priority,
    confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0.7)),
    address: raw.address || raw.location_hint || '',
    department_id: raw.department_id || route.department_id,
    authority_name: raw.authority_name || route.authority_name,
    authority_level: raw.authority_level || 'Municipal',
    evidence_quality: raw.evidence_quality || 'Medium',
    location_hint: raw.location_hint || '',
    recommended_action: raw.recommended_action || 'Inspect and assign a field team.',
    citizen_question: raw.citizen_question || 'Please confirm the exact location and how long this issue has been present.'
  };
}

function handleUploadError(err, req, res, next) {
  if (!err) return next();
  return res.status(400).json({
    success: false,
    code: 'INVALID_IMAGE',
    error: err.message || 'Invalid image upload.'
  });
}

// 2. Upload & AI Analysis Route
app.post('/api/complaints/analyze', upload.single('image'), handleUploadError, async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, code: 'NO_IMAGE', error: 'No image uploaded' });
    }

    // ── Rate limiting ──────────────────────────────────────────
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      fs.unlink(path.join(__dirname, 'uploads', req.file.filename), () => {});
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        error: 'Too many uploads. Please try again later (max 10 per hour).'
      });
    }

    const filePath = path.join(__dirname, 'uploads', req.file.filename);
    const mimeType = req.file.mimetype;

    // ── Duplicate image detection ──────────────────────────────
    const imageHash = computeImageHash(filePath);
    try {
      const existingComplaint = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM complaints WHERE image_hash = ?', [imageHash], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (existingComplaint) {
        fs.unlink(filePath, () => {});
        db.run('UPDATE complaints SET reports_count = reports_count + 1 WHERE id = ?', [existingComplaint.id]);
        return res.status(200).json({
          success: true,
          is_duplicate: true,
          complaint_id: existingComplaint.id,
          message: 'Issue already reported! We added your report to the existing complaint.'
        });
      }
    } catch (e) {
      console.error('DB error during deduplication:', e);
    }

    // ── Extract metadata for fraud context ─────────────────────
    const exifMeta = extractBasicExif(filePath);

    // ── AI-Generated Image Detection (runs BEFORE Gemini) ─────
    const aiDetection = detectAIGenerated(filePath, exifMeta);
    
    // If heuristic is very confident (>=60%), auto-reject without API call
    if (aiDetection.is_ai_generated && aiDetection.ai_confidence >= 0.6) {
      fs.unlink(filePath, () => {});
      const toolName = aiDetection.tool_detected ? ` (${aiDetection.tool_detected})` : '';
      return res.status(422).json({
        success: false,
        code: 'AI_GENERATED_IMAGE',
        error: `This image appears to be computer-generated${toolName}. Only real photographs of civic issues are accepted.`,
        detection: {
          confidence: Math.round(aiDetection.ai_confidence * 100),
          signals: aiDetection.signals_detected,
        }
      });
    }

    if(!ai) {
      return res.status(503).json({
        success: false,
        code: 'AI_NOT_CONFIGURED',
        error: 'Gemini API key is not configured. Add GEMINI_API_KEY in backend/.env and restart the backend.'
      });
    }

    try {
      const imagePart = fileToGenerativePart(filePath, mimeType);
      
      // Build AI detection context for the prompt
      const aiDetectionContext = aiDetection.signals_detected.length > 0
        ? `\nPRE-SCAN RESULTS (from our heuristic engine): ${JSON.stringify(aiDetection.signals_detected)}. Heuristic AI-generated confidence: ${Math.round(aiDetection.ai_confidence * 100)}%. Factor this into your fraud analysis.`
        : '\nPRE-SCAN RESULTS: No AI-generation signals detected by heuristic engine.';

      const prompt = `
You are Sentira AI, a strict civic grievance image analyst for an Indian city authority.

Task:
1. Decide whether the uploaded image clearly shows a reportable public civic issue.
2. Reject unrelated/private/scenic/selfie/food/document images. Do not invent issues.
3. If valid, classify and route it to the correct authority.
4. Assess how confident you are in the classification (0.0 to 1.0).

Allowed categories and routing:
${JSON.stringify(CIVIC_CATEGORIES, null, 2)}

Urgency guidance:
- Emergency: immediate public danger such as open manhole, exposed live wire, major flooding, fallen pole/tree blocking road.
- High: severe issue affecting safety or mobility, large pothole, sewage overflow, dangerous garbage/fire risk.
- Medium: visible issue needing repair but not immediate danger.
- Low: minor maintenance.

DATA EXTRACTION & CLASSIFICATION (CRITICAL):
1. OCR & Context: Extract any visible text from the image (e.g., street signs, shop names, license plates, warning boards) and put it in "extracted_text". This is vital for geolocation.
2. Authority Assignment: Determine the exact "authority_level" needed based on the scale of the issue:
   - "Municipal": Local city corp (e.g., street garbage, local broken pipe, streetlight).
   - "State": State department (e.g., state highway damage, major public works).
   - "National": National authority (e.g., National Highway, federal property).
3. Assign the specific "department_id" and "authority_name" based on the issue type and scale.

═══════════════════════════════════════════════════════
DEPARTMENT ROUTING RULES (CRITICAL):
═══════════════════════════════════════════════════════
You must follow these priority rules for routing:
- ROADS (PWD): Primary category for potholes, broken asphalt, damaged footpaths, road-side dividers, or road cave-ins.
- SANITATION (SANITATION): Primary category for garbage piles, littering, dead animals, overflowing bins, or general public filth on streets.
- WATER (WATER_WORKS): Use for pipe leaks, water wastage, flooding, or sewage/drainage overflows.
- ELECTRICITY (ELECTRICITY_BOARD): Use for broken streetlights, hanging live wires, or tilted electric poles.
- IF MULTIPLE ISSUES (e.g. Garbage + Potholes): Choose the category that is most severe or hazardous. Do NOT default to "Other" if a specific category like Roads or Sanitation applies.

═══════════════════════════════════════════════════════
AI-GENERATED IMAGE DETECTION (CRITICAL — you must check ALL of these):
═══════════════════════════════════════════════════════

You MUST carefully examine whether this image was created by an AI image generator
(DALL-E, Midjourney, Stable Diffusion, Firefly, Flux, Leonardo AI, etc.).

Check these visual forensic signals:

1. UNNATURAL PERFECTION: AI images often look "too clean" — perfect lighting, 
   no motion blur, no lens distortion, no sensor noise, no dust spots.

2. TEXTURE ARTIFACTS: Look for:
   - Skin/surfaces that look waxy, plastic, or unnaturally smooth
   - Repeating micro-patterns in backgrounds or surfaces
   - "Melted" or blended textures where objects meet (especially at edges)
   - Textures that look painted rather than photographed

3. STRUCTURAL IMPOSSIBILITIES:
   - Objects with impossible geometry (roads that curve wrong, buildings with wrong perspective)
   - Signs/text that is garbled, nonsensical, or uses fake characters
   - Hands/fingers with wrong number of digits
   - Vehicles with wrong proportions or merged body panels
   - Trees/foliage that looks fractal or repetitive

4. LIGHTING INCONSISTENCIES:
   - Shadows going in different directions
   - Reflections that don't match the scene
   - Light sources that don't exist in the scene
   - HDR-like over-processing that looks artificial

5. BACKGROUND ANOMALIES:
   - Backgrounds that blur/dissolve into abstract shapes
   - "Dream-like" atmosphere with unrealistic depth of field
   - People or objects partially merging into backgrounds

6. COMPOSITION TELLS:
   - Unnaturally centered or "too perfect" framing
   - Scenes that look like stock photography or concept art
   - Unrealistic color grading (oversaturated, too cinematic)

7. RESOLUTION/QUALITY MISMATCH:
   - Extremely sharp image but with no real-world lens characteristics
   - No chromatic aberration, no barrel distortion — too optically perfect
   - Uniform noise pattern (real cameras have sensor-specific noise)

8. CONTEXT IMPLAUSIBILITY:
   - Scene that looks too staged or theatrical to be a real civic complaint
   - Dramatic compositions that look like they were prompted rather than captured

${aiDetectionContext}

Image metadata context: format=${exifMeta.format}, size=${exifMeta.fileSize}bytes, hasExifData=${exifMeta.hasExif}, suspiciouslySmall=${exifMeta.suspiciousSize}.

If you determine the image IS AI-generated:
- Set is_fake=true
- Set fake_reason to explain which specific visual forensic signals you detected
- Set is_ai_generated=true
- You MAY still classify the civic issue IF the scene depicted is plausible, 
  but the fake flag MUST be set.

═══════════════════════════════════════════════════════
STRICT SPAM & FRAUD FILTER (MUST BE A REAL PHOTOGRAPH):
═══════════════════════════════════════════════════════
You must act as an aggressive spam filter. If the image is NOT a real photograph taken by a person of a physical civic issue, you MUST set "is_civic_issue" to FALSE and provide a rejection reason.

REJECT the image immediately (is_civic_issue: false) if it is:
1. SPAM / IRRELEVANT: Selfies, portraits, pet photos, food, random objects, or indoor home environments.
2. NON-PHOTOGRAPHIC: Cartoons, illustrations, memes, graphic design, text-only images, or infographics.
3. SCREEN CAPTURES: Photos taken of another screen (moiré patterns visible), screenshots of Google Maps, news articles, or social media feeds.
4. STOCK / WATERMARKED: Images containing stock photo watermarks, digital overlays, or obvious digital manipulation.

If any of these conditions are met, set "is_civic_issue" to FALSE and clearly state the reason in "rejection_reason" (e.g., "This appears to be a selfie, not a civic issue.", "This is a screenshot/meme, please upload a real photograph.").

Return ONLY valid JSON with these exact keys:
{
  "is_civic_issue": boolean,
  "is_fake": boolean,
  "is_ai_generated": boolean,
  "fake_reason": "explain detected fraud/AI signals, or empty string if genuine",
  "rejection_reason": "short reason when not civic, otherwise empty string",
  "title": "short 3-6 word title",
  "description": "specific 1-2 sentence visual evidence description",
  "extracted_text": "all visible text extracted from the image via OCR, or empty string",
  "category": "Roads|Sanitation|Electricity|Water|Traffic|Environment|Other",
  "urgency_level": "Low|Medium|High|Emergency",
  "priority_score": number from 1 to 10,
  "confidence": number from 0.0 to 1.0,
  "authority_level": "Municipal|State|National",
  "department_id": "matching department id (e.g. PWD, SANITATION, FIRE_DEPT)",
  "authority_name": "matching authority name",
  "evidence_quality": "Low|Medium|High",
  "location_hint": "visible landmark or empty string",
  "address": "Descriptive address or location hint extracted from image context",
  "recommended_action": "action for authority",
  "ai_analysis": "Introductory message for the AI Chatbot to start the conversation with the citizen",
  "citizen_question": "one short follow-up question for the citizen"
}
`;

      const response = await generateWithRetry([
          imagePart,
          { text: prompt }
        ]);

      const analysisData = normalizeAnalysis(extractJson(response.text));

      if (!analysisData.is_civic_issue) {
        fs.unlink(filePath, () => {});
        return res.status(422).json({
          success: false,
          code: 'NOT_CIVIC_ISSUE',
          error: analysisData.rejection_reason || 'This image does not clearly show a reportable civic issue.'
        });
      }

      // Store hash to prevent future duplicates
      imageHashSet.add(imageHash);

      res.json({
          success: true,
          media_url: `/uploads/${req.file.filename}`,
          analysis: analysisData,
          metadata: {
            imageHash: imageHash,
            format: exifMeta.format,
            hasExif: exifMeta.hasExif,
          }
      });
    } catch (error) {
      console.error("Gemini API Error:", error.message?.substring(0, 200));
      const isQuota = (error.message || '').includes('429') || (error.message || '').includes('quota');
      if (isQuota) {
        res.status(429).json({ success: false, code: 'SYSTEM_RATE_LIMITED', error: 'System is temporarily busy. Please wait 60 seconds and try again.' });
      } else {
        res.status(500).json({ success: false, code: 'SYSTEM_ANALYSIS_FAILED', error: 'Failed to analyze image with System', details: error.message });
      }
    }
});

// 3. AI Chat Assistant Route
app.post('/api/chat/assistant', async (req, res) => {
    const { history, complaintContext } = req.body;
    
    if(!ai) {
        return res.status(503).json({ success: false, error: 'System not configured.' });
    }

    try {
        // Build conversation history
        const historyText = (history || []).map(h => `${h.sender === 'user' ? 'Citizen' : 'AI'}: ${h.text}`).join('\n');
        
        const prompt = `You are Sentria AI Civic Assistant helping a citizen file a government complaint.
Complaint Context: ${JSON.stringify(complaintContext)}
Conversation so far:
${historyText}
Citizen just said: "${complaintContext.description}"

Respond helpfully and concisely (max 2 sentences). Ask for specific details that will help authorities (exact location, duration of issue, severity). Be empathetic and professional.`;

        const response = await generateWithRetry(prompt);
        res.json({ success: true, reply: response.text });
    } catch (error) {
        console.error("Chat Error:", error.message?.substring(0, 200));
        const isQuota = (error.message || '').includes('429') || (error.message || '').includes('quota');
        res.status(isQuota ? 429 : 500).json({ 
          success: false, 
          reply: isQuota ? 'I am temporarily busy. Please try again in a minute.' : 'Sorry, I could not process your message. Please try again.',
          error: 'Chat Assistant failed'
        });
    }
});

// 4. Submit Complaint Route
app.post('/api/complaints', (req, res) => {
    const { 
        citizen_id, title, description, category, priority_score, 
        urgency_level, latitude, longitude, upload_latitude, upload_longitude, address, ward_number, district,
        department_id, media_urls, is_fake, fake_reason, image_hash
    } = req.body;

    const id = uuidv4();
    const media_urls_json = JSON.stringify(media_urls || []);
    
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 3);

    // Auto-Assignment: Find an officer in the same district AND department
    // Strictly match department — officer must have a matching department set.
    // If multiple exist, pick the one with fewest active tasks (load balancing)
    const findOfficerQuery = `
      SELECT u.id, u.name, u.email, u.fcm_token, COUNT(c.id) as task_count 
      FROM users u
      LEFT JOIN complaints c ON u.id = c.assigned_officer_id AND c.status NOT IN ('Resolved', 'Completed')
      WHERE u.role = 'Officer' 
        AND u.department = ? 
        AND u.department != ''
        AND (u.district = ? OR u.district = '' OR u.district IS NULL OR u.district = 'All Districts')
      GROUP BY u.id
      ORDER BY task_count ASC
      LIMIT 1
    `;

    db.get(findOfficerQuery, [department_id || '', district || ''], (err, officer) => {
        const assigned_id = officer ? officer.id : null;
        const assigned_name = officer ? officer.name : null;
        const initial_status = officer ? 'Assigned' : 'Pending';

        db.run(`INSERT INTO complaints (
            id, citizen_id, title, description, category, status, priority_score, 
            urgency_level, latitude, longitude, upload_latitude, upload_longitude, address, ward_number, district, department_id, 
            media_urls, is_fake, fake_reason, expected_completion_date, image_hash,
            assigned_officer_id, assigned_officer_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id, citizen_id || 'citizen-1', title, description, category, initial_status, priority_score || 5,
            urgency_level || 'Medium', latitude || 0, longitude || 0, upload_latitude || 0, upload_longitude || 0, address || '', ward_number || '', district || '', department_id || '',
            media_urls_json, is_fake ? 1 : 0, fake_reason || '', expectedDate.toISOString(), image_hash || '',
            assigned_id, assigned_name
        ], function(err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: err.message });
            }
            
            db.get('SELECT email, name, fcm_token FROM users WHERE id = ?', [citizen_id], (err, citizen) => {
                const citizenEmail = citizen?.email;
                const citizenName = citizen?.name || 'Citizen';
                const officerEmail = officer?.email;
                
                if (citizenEmail) {
                    sendEmailNotification(
                        citizenEmail,
                        'Complaint Registered Successfully - Sentria Samadhan',
                        `<h3>Dear ${citizenName},</h3>
                         <p>Your complaint regarding <b>${title}</b> has been successfully registered.</p>
                         <p><strong>Complaint ID:</strong> ${id}</p>
                         <p><strong>Category:</strong> ${category}</p>
                         <p>We will keep you updated on its progress.</p>
                         <br/><p>Regards,<br/>Sentria Samadhan Team</p>`
                    );
                }

                if (citizen?.fcm_token) {
                    sendPushNotification(
                        citizen.fcm_token,
                        'Complaint Registered',
                        `${category} issue: ${title}\nWe are routing this to the ${department_id || 'appropriate'} department.`,
                        { complaint_id: id, type: 'complaint_registered' }
                    );
                }

                if (officerEmail) {
                    sendEmailNotification(
                        officerEmail,
                        'New Complaint Assigned: ' + title,
                        `<h3>Hello Officer ${assigned_name},</h3>
                         <p>A new complaint has been assigned to you.</p>
                         <p><strong>Nature of Complaint:</strong> ${title} - ${description}</p>
                         <p><strong>Geographical Location:</strong> ${address || 'Coordinates: ' + latitude + ', ' + longitude}</p>
                         <p><strong>Urgency:</strong> ${urgency_level || 'Medium'}</p>
                         <br/><p>Please log in to the Sentria Samadhan portal to take action.</p>`
                    );
                }

                if (officer?.fcm_token) {
                    sendPushNotification(
                        officer.fcm_token,
                        `New Task: ${category} - ${urgency_level} Urgency`,
                        `${title}\nLocation: ${address || 'Pending'}\n${description}`,
                        { complaint_id: id, type: 'task_assigned' }
                    );
                } else if (!officer) {
                    // Alert Admins if no officer is found
                    db.all('SELECT email, fcm_token FROM users WHERE role IN ("Admin", "SuperAdmin") AND (district = ? OR district = "All Districts" OR district = "")', [district || ''], (err, admins) => {
                        admins?.forEach(admin => {
                            if (admin.email) {
                                sendEmailNotification(
                                    admin.email,
                                    'New Unassigned Complaint: ' + title,
                                    `<h3>Hello Admin,</h3>
                                     <p>A new complaint was raised but no officer was available to auto-assign.</p>
                                     <p><strong>Department:</strong> ${department_id || 'Unknown'}</p>
                                     <p><strong>Title:</strong> ${title}</p>
                                     <p><strong>Location:</strong> ${address || 'Coordinates: ' + latitude + ', ' + longitude}</p>
                                     <br/><p>Please assign it manually.</p>`
                                );
                            }
                            if (admin.fcm_token) {
                                sendPushNotification(
                                    admin.fcm_token,
                                    `Unassigned ${category} Complaint`,
                                    `${title}\nNeeds manual assignment for ${department_id || 'department'}.`,
                                    { complaint_id: id, type: 'needs_assignment' }
                                );
                            }
                        });
                    });
                }
            });

            res.json({ success: true, complaint_id: id, message: 'Complaint registered successfully.', is_fake, assigned_to: assigned_name });
        });
    });
});

// 4. Get all complaints (with optional district/officer filtering)
app.get('/api/complaints', (req, res) => {
    const districtFilter = req.query.district;
    const officerFilter = req.query.assigned_officer_id;
    
    let query = `SELECT * FROM complaints`;
    let params = [];
    let conditions = [];

    if (districtFilter) {
      conditions.push(`district = ?`);
      params.push(districtFilter);
    }
    if (officerFilter) {
      conditions.push(`assigned_officer_id = ?`);
      params.push(officerFilter);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    
    query += ` ORDER BY created_at DESC`;
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const complaints = rows.map(r => {
            let created_at = r.created_at;
            let expected_completion_date = r.expected_completion_date;
            let actual_completion_date = r.actual_completion_date;
            
            if (created_at && !created_at.includes('T')) created_at = created_at.replace(' ', 'T') + 'Z';
            if (expected_completion_date && !expected_completion_date.includes('T')) expected_completion_date = expected_completion_date.replace(' ', 'T') + 'Z';
            if (actual_completion_date && !actual_completion_date.includes('T')) actual_completion_date = actual_completion_date.replace(' ', 'T') + 'Z';

            return {
                ...r,
                created_at,
                expected_completion_date,
                actual_completion_date,
                media_urls: JSON.parse(r.media_urls || '[]')
            };
        });
        res.json(complaints);
    });
});

// Route to assign an officer to a complaint
app.put('/api/complaints/:id/assign', (req, res) => {
    const { officer_id, officer_name } = req.body;
    db.run(
        'UPDATE complaints SET assigned_officer_id = ?, assigned_officer_name = ?, status = ? WHERE id = ?',
        [officer_id, officer_name, 'Assigned', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });

            // Send email notification to the assigned officer
            db.get('SELECT email, fcm_token FROM users WHERE id = ?', [officer_id], (err2, officer) => {
                if (officer) {
                    db.get('SELECT title, description, address, latitude, longitude, urgency_level, category FROM complaints WHERE id = ?', [req.params.id], (err3, complaint) => {
                        if (complaint) {
                            if (officer.email) {
                                sendEmailNotification(
                                    officer.email,
                                    'New Complaint Assigned: ' + (complaint.title || 'Civic Issue'),
                                    `<h3>Hello ${officer_name},</h3>
                                     <p>A complaint has been assigned to you by the District Admin.</p>
                                     <p><strong>Title:</strong> ${complaint.title}</p>
                                     <p><strong>Description:</strong> ${complaint.description || 'N/A'}</p>
                                     <p><strong>Category:</strong> ${complaint.category || 'General'}</p>
                                     <p><strong>Location:</strong> ${complaint.address || 'Coordinates: ' + complaint.latitude + ', ' + complaint.longitude}</p>
                                     <p><strong>Urgency:</strong> ${complaint.urgency_level || 'Medium'}</p>
                                     <br/><p>Please log in to the Sentria Samadhan Field Officer Portal to take action.</p>
                                     <p>Regards,<br/>Sentria Samadhan System</p>`
                                );
                            }

                            if (officer.fcm_token) {
                                sendPushNotification(
                                    officer.fcm_token,
                                    'New Task Assigned!',
                                    `A new complaint "${complaint.title}" has been assigned to you by the Admin.`,
                                    { complaint_id: req.params.id, type: 'task_assigned' }
                                );
                            }
                        }
                    });
                }
            });

            res.json({ success: true, message: 'Officer assigned successfully' });
        }
    );
});

// 5. Get a specific complaint
app.get('/api/complaints/:id', (req, res) => {
    db.get(`
        SELECT c.*, u.phone as assigned_officer_phone 
        FROM complaints c 
        LEFT JOIN users u ON c.assigned_officer_id = u.id 
        WHERE c.id = ?
    `, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Complaint not found' });
        
        if (row.created_at && !row.created_at.includes('T')) row.created_at = row.created_at.replace(' ', 'T') + 'Z';
        if (row.expected_completion_date && !row.expected_completion_date.includes('T')) row.expected_completion_date = row.expected_completion_date.replace(' ', 'T') + 'Z';
        if (row.actual_completion_date && !row.actual_completion_date.includes('T')) row.actual_completion_date = row.actual_completion_date.replace(' ', 'T') + 'Z';
        
        row.media_urls = JSON.parse(row.media_urls || '[]');
        res.json(row);
    });
});

// Super Admin Stats Route
app.get('/api/superadmin/stats', (req, res) => {
    const stats = {};
    
    db.serialize(() => {
        // Total Reports
        db.get('SELECT COUNT(*) as total FROM complaints', (err, row) => {
            stats.totalReports = row.total;
        });

        // Resolution Rate
        db.get("SELECT COUNT(*) as resolved FROM complaints WHERE status IN ('Resolved', 'Completed')", (err, row) => {
            stats.resolvedReports = row.resolved;
        });

        // District Distribution
        db.all('SELECT district, COUNT(*) as count FROM complaints GROUP BY district', (err, rows) => {
            stats.districtStats = rows;
            
            // Calculate percentage
            const rate = stats.totalReports > 0 ? (stats.resolvedReports / stats.totalReports) * 100 : 0;
            stats.resolutionRate = Math.round(rate);
            
            res.json(stats);
        });
    });
});

// Super Admin Ratings Analytics
app.get('/api/superadmin/ratings', (req, res) => {
    const results = {
        departments: {},
        officers: [],
        recentComments: []
    };

    db.serialize(() => {
        // 1. Department Ratings
        // Initialize all departments with 5.0
        const DEPT_IDS = ['PWD', 'SANITATION', 'ELECTRICITY_BOARD', 'WATER_WORKS', 'TRAFFIC_POLICE', 'ENVIRONMENT', 'FIRE_DEPT', 'MUNICIPAL_CORP'];
        DEPT_IDS.forEach(id => results.departments[id] = { avg: 5.0, count: 0 });

        db.all(`
            SELECT c.department_id, AVG(f.rating) as avg_rating, COUNT(f.id) as feedback_count
            FROM feedback f
            JOIN complaints c ON f.complaint_id = c.id
            WHERE c.department_id IS NOT NULL
            GROUP BY c.department_id
        `, (err, rows) => {
            if (rows) {
                rows.forEach(row => {
                    results.departments[row.department_id] = {
                        avg: parseFloat(row.avg_rating.toFixed(1)),
                        count: row.feedback_count
                    };
                });
            }
        });

        // 2. Officer Ratings within Districts
        db.all(`
            SELECT u.id, u.name, u.district, u.department, AVG(f.rating) as avg_rating, COUNT(f.id) as feedback_count
            FROM users u
            LEFT JOIN complaints c ON u.id = c.assigned_officer_id
            LEFT JOIN feedback f ON c.id = f.complaint_id
            WHERE u.role = 'Officer'
            GROUP BY u.id
        `, (err, rows) => {
            if (rows) {
                results.officers = rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    district: row.district,
                    department: row.department,
                    rating: row.avg_rating ? parseFloat(row.avg_rating.toFixed(1)) : 5.0,
                    count: row.feedback_count || 0
                }));
            }
        });

        // 3. Recent Comments
        db.all(`
            SELECT f.comment, f.rating, f.created_at, u.name as citizen_name, c.title as complaint_title
            FROM feedback f
            JOIN users u ON f.citizen_id = u.id
            JOIN complaints c ON f.complaint_id = c.id
            WHERE f.comment IS NOT NULL AND f.comment != ''
            ORDER BY f.created_at DESC
            LIMIT 5
        `, (err, rows) => {
            results.recentComments = rows || [];
            res.json(results);
        });
    });
});

// 6. Smart Assistant Chat
app.post('/api/chat/assistant', async (req, res) => {
    const { history, complaintContext } = req.body;
    
    if(!ai) {
      return res.json({ reply: "I am the mock assistant. I cannot see your image because my API key is missing!" });
    }

    try {
      const prompt = `
        You are Sentira AI, a helpful civic grievance assistant. The user is reporting a civic issue.
        Issue Context: ${JSON.stringify(complaintContext)}
        Chat History: ${JSON.stringify(history)}
        
        Respond to the user's last message. If you need more info (e.g. exact location, duration of the issue, severity), ask ONE short follow-up question.
        Keep your response under 2 sentences.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      res.json({ reply: response.text });
    } catch (error) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: 'Chat System failed' });
    }
});

// Static serving moved up to improve reliability and handle CORS

// 7. Update Progress (Admin/Officer)
app.put('/api/complaints/:id/progress', (req, res) => {
    const { progress_percentage, status, work_update_text, media_url, new_expected_date } = req.body;
    
    db.get('SELECT work_updates, due_date_updated FROM complaints WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Complaint not found' });
        
        let updates = [];
        try { updates = JSON.parse(row.work_updates || '[]'); } catch(e) {}
        
        updates.push({
            timestamp: new Date().toISOString(),
            progress: progress_percentage,
            text: work_update_text,
            media: media_url
        });
        
        if (new_expected_date && row.due_date_updated === 0) {
            db.run('UPDATE complaints SET progress_percentage = ?, status = ?, work_updates = ?, expected_completion_date = ?, due_date_updated = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [progress_percentage, status || 'In Progress', JSON.stringify(updates), new_expected_date, req.params.id], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, message: 'Progress and due date updated' });
            });
        } else {
            db.run('UPDATE complaints SET progress_percentage = ?, status = ?, work_updates = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [progress_percentage, status || 'In Progress', JSON.stringify(updates), req.params.id], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, message: 'Progress updated' });
            });
        }
    });
});

// 8. Escalate Complaint
app.post('/api/complaints/:id/escalate', (req, res) => {
    const { reason, target_level } = req.body;
    db.run('UPDATE complaints SET escalation_level = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [target_level || 'Senior Officer', 'Escalated', req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            db.run('INSERT INTO escalations (id, complaint_id, action_taken, notes, escalation_level) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), req.params.id, 'Citizen Escalated', reason, target_level || 'Senior Officer'], function(err) {
                    db.get('SELECT title, district FROM complaints WHERE id = ?', [req.params.id], (err, complaint) => {
                        if (complaint) {
                           db.get('SELECT email FROM users WHERE role IN ("Admin", "SuperAdmin") AND (district = ? OR district = "All Districts") LIMIT 1', [complaint.district], (err, supervisor) => {
                               if (supervisor && supervisor.email) {
                                   sendEmailNotification(
                                       supervisor.email,
                                       'Action Required: Complaint Escalated - ' + complaint.title,
                                       `<h3>Supervisor Notification</h3>
                                        <p>Complaint <b>${req.params.id}</b> has been escalated to <b>${target_level || 'Senior Officer'}</b>.</p>
                                        <p><strong>Reason for Escalation:</strong> ${reason}</p>
                                        <p>Please review immediately and take appropriate action.</p>`
                                   );
                               }
                           });
                        }
                    });
                    res.json({ success: true, message: 'Complaint escalated successfully.' });
                });
        });
});

// 9. Admin Users Management (Ban/Suspend)
app.put('/api/admin/users/:id/ban', (req, res) => {
    const { is_banned, ban_reason } = req.body;
    db.run('UPDATE users SET is_banned = ?, ban_reason = ? WHERE id = ?', [is_banned ? 1 : 0, ban_reason || '', req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: is_banned ? 'User banned' : 'User unbanned' });
    });
});

// Update User District
app.put('/api/users/:id/district', (req, res) => {
    const { district } = req.body;
    db.run('UPDATE users SET district = ? WHERE id = ?', [district, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err2, row) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ success: true, user: row });
        });
    });
});

// Officers Management
app.get('/api/admin/officers', (req, res) => {
    const districtFilter = req.query.district;
    let query = "SELECT id, name, email, phone, department, role, district, created_at FROM users WHERE role = 'Officer'";
    const params = [];

    if (districtFilter) {
      query += " AND district = ?";
      params.push(districtFilter);
    }

    query += " ORDER BY created_at DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/officers', (req, res) => {
    const { name, email, phone, department, district } = req.body;
    if (!name || !department || !email) return res.status(400).json({ error: 'Name, email and department are required' });
    
    const officerEmail = email.toLowerCase().trim();

    // Check if user already exists with this email
    db.get('SELECT * FROM users WHERE email = ?', [officerEmail], (err, existing) => {
        if (existing) {
            // Upgrade existing user to Officer
            db.run(
                'UPDATE users SET role = ?, department = ?, name = ?, phone = ? WHERE id = ?',
                ['Officer', department, name, phone || '', existing.id],
                function(updErr) {
                    if (updErr) return res.status(500).json({ error: updErr.message });
                    db.get('SELECT * FROM users WHERE id = ?', [existing.id], (err2, row) => {
                        res.json({ success: true, officer: row });
                    });
                }
            );
        } else {
            // Create new officer record
            const officerId = 'AUTH-' + Date.now();
            db.run(
                'INSERT INTO users (id, name, email, phone, role, department, district) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [officerId, name, officerEmail, phone || '', 'Officer', department, district || ''],
                function(insErr) {
                    if (insErr) return res.status(500).json({ error: insErr.message });
                    db.get('SELECT * FROM users WHERE id = ?', [officerId], (err2, row) => {
                        res.json({ success: true, officer: row });
                    });
                }
            );
        }
    });
});

app.put('/api/admin/officers/:id', (req, res) => {
    const { name, email, phone, department } = req.body;
    db.run(
        'UPDATE users SET name = ?, email = ?, phone = ?, department = ? WHERE id = ? AND role = "Officer"',
        [name, email || '', phone || '', department, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });

            // Propagate name change to all complaints assigned to this officer
            db.run(
                'UPDATE complaints SET assigned_officer_name = ? WHERE assigned_officer_id = ?',
                [name, req.params.id],
                function(propErr) {
                    if (propErr) console.error('Failed to propagate officer name:', propErr);
                }
            );

            db.get('SELECT id, name, email, phone, department, role, district, created_at FROM users WHERE id = ?', [req.params.id], (err2, row) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ success: true, officer: row });
            });
        }
    );
});

app.delete('/api/admin/officers/:id', (req, res) => {
    db.run('DELETE FROM users WHERE id = ? AND role = "Officer"', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Officer removed' });
    });
});


// Feedback check route moved up

// 10. Submit Feedback
app.post('/api/feedback', (req, res) => {
    const { citizen_id, complaint_id, rating, comment, language } = req.body;
    
    // If complaint_id is provided, check if feedback already exists for this complaint by this citizen
    if (complaint_id) {
        db.get('SELECT id FROM feedback WHERE citizen_id = ? AND complaint_id = ?', [citizen_id, complaint_id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row) return res.status(400).json({ success: false, error: 'Feedback already submitted for this complaint.' });
            
            // Proceed to insert
            const id = uuidv4();
            db.run('INSERT INTO feedback (id, citizen_id, complaint_id, rating, comment, language) VALUES (?, ?, ?, ?, ?, ?)',
                [id, citizen_id, complaint_id, rating, comment || '', language || 'en'], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, message: 'Feedback submitted successfully.' });
                });
        });
    } else {
        // Generic feedback without specific complaint
        const id = uuidv4();
        db.run('INSERT INTO feedback (id, citizen_id, complaint_id, rating, comment, language) VALUES (?, ?, ?, ?, ?, ?)',
            [id, citizen_id, null, rating, comment || '', language || 'en'], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: 'Feedback submitted successfully.' });
            });
    }
});

// ── District Admin Management (Super Admin only) ──────────────

// List all district admins
app.get('/api/district-admins', (req, res) => {
  db.all('SELECT * FROM district_admins ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Add a new district admin
app.post('/api/district-admins', (req, res) => {
  const { name, email, district } = req.body;
  if (!name || !email || !district) {
    return res.status(400).json({ error: 'Name, email, and district are required.' });
  }
  const id = uuidv4();
  db.run(
    'INSERT INTO district_admins (id, name, email, district, added_by) VALUES (?, ?, ?, ?, ?)',
    [id, name, email.toLowerCase().trim(), district, req.body.added_by || 'SuperAdmin'],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'This email is already registered as a district admin.' });
        }
        return res.status(500).json({ error: err.message });
      }
      // Also ensure this email gets Admin role when they log in
      db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err2, existingUser) => {
        if (existingUser) {
          db.run('UPDATE users SET role = ?, district = ? WHERE email = ?', ['Admin', district, email.toLowerCase().trim()]);
        }
      });
      db.get('SELECT * FROM district_admins WHERE id = ?', [id], (err3, row) => {
        res.json(row);
      });
    }
  );
});

// Edit a district admin
app.put('/api/district-admins/:id', (req, res) => {
  const { name, email, district } = req.body;
  if (!name || !email || !district) {
    return res.status(400).json({ error: 'Name, email, and district are required.' });
  }
  db.run(
    'UPDATE district_admins SET name = ?, email = ?, district = ? WHERE id = ?',
    [name, email.toLowerCase().trim(), district, req.params.id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'This email is already registered as a district admin.' });
        }
        return res.status(500).json({ error: err.message });
      }
      // Update role/district in users table as well if they exist
      db.run('UPDATE users SET name = ?, role = ?, district = ? WHERE email = ?', 
        [name, 'Admin', district, email.toLowerCase().trim()]);
      
      db.get('SELECT * FROM district_admins WHERE id = ?', [req.params.id], (err2, row) => {
        res.json(row);
      });
    }
  );
});


// Remove a district admin
app.delete('/api/district-admins/:id', (req, res) => {
  db.get('SELECT * FROM district_admins WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'District admin not found.' });
    db.run('DELETE FROM district_admins WHERE id = ?', [req.params.id], function(delErr) {
      if (delErr) return res.status(500).json({ error: delErr.message });
      // Revert user role to Citizen if they exist
      db.run('UPDATE users SET role = ? WHERE email = ?', ['Citizen', row.email]);
      res.json({ success: true, message: 'District admin removed.' });
    });
  });
});

// Check if an email is a district admin
app.get('/api/district-admins/check', (req, res) => {
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  db.get('SELECT * FROM district_admins WHERE email = ?', [email], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ isDistrictAdmin: Boolean(row), admin: row || null });
  });
});

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Sentria Samadhan Backend running on port ${port}`);
});
server.timeout = 60000;
