// ============================================================================
// SIGN LANGUAGE TRANSLATOR - BACKEND SERVICE & STATIC SERVER
// Layered Architecture (CO1) with ACID File-Backed Persistence & REST API
// ============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'translations_db.json');

// Ensure data persistence directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================================================
// LAYER 5: PERSISTENCE & STORAGE ENGINE (ACID Atomic Write & Crash Recovery)
// ============================================================================
class StorageEngine {
    static initDatabase() {
        if (!fs.existsSync(DB_FILE)) {
            const initialSchema = {
                metadata: {
                    schema_version: "1.0.0",
                    created_at: new Date().toISOString(),
                    system: "Sign Language Translator DBS Persistence"
                },
                users: [
                    { user_id: 1, username: "shreyas_dbs", role: "admin" },
                    { user_id: 2, username: "student_evaluator", role: "evaluator" }
                ],
                gestures_count: 31,
                translation_history: [
                    {
                        history_id: 1,
                        user_id: 1,
                        sign_name: "HI / HELLO",
                        confidence_score: 98.5,
                        output_mode: "both",
                        translated_at: new Date(Date.now() - 3600000).toISOString()
                    },
                    {
                        history_id: 2,
                        user_id: 1,
                        sign_name: "THANK YOU",
                        confidence_score: 96.2,
                        output_mode: "both",
                        translated_at: new Date(Date.now() - 1800000).toISOString()
                    }
                ],
                feedback: []
            };
            this.writeAtomic(initialSchema);
        }
    }

    static readDatabase() {
        try {
            this.initDatabase();
            const rawData = fs.readFileSync(DB_FILE, 'utf-8');
            return JSON.parse(rawData);
        } catch (err) {
            console.error("[StorageEngine] Error reading database file:", err);
            return { translation_history: [], feedback: [], users: [] };
        }
    }

    // Atomic write (Write to temporary file then rename) guarantees ACID Durability
    static writeAtomic(data) {
        const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
        fs.renameSync(tmpFile, DB_FILE);
    }
}

// Initialize on boot
StorageEngine.initDatabase();

// ============================================================================
// LAYER 4: DATA ACCESS LAYER (Repository Pattern for CRUD Operations)
// ============================================================================
class TranslationRepository {
    static getAll(limit = 50) {
        const db = StorageEngine.readDatabase();
        return (db.translation_history || []).slice(-limit).reverse();
    }

    static insert(record) {
        const db = StorageEngine.readDatabase();
        const nextId = (db.translation_history.length > 0)
            ? Math.max(...db.translation_history.map(r => r.history_id || 0)) + 1
            : 1;

        const newRecord = {
            history_id: nextId,
            user_id: record.user_id || 1,
            sign_name: record.sign_name,
            confidence_score: parseFloat(record.confidence_score) || 0.0,
            output_mode: record.output_mode || "both",
            translated_at: new Date().toISOString()
        };

        db.translation_history.push(newRecord);
        StorageEngine.writeAtomic(db);
        return newRecord;
    }

    static clearAll() {
        const db = StorageEngine.readDatabase();
        const count = db.translation_history.length;
        db.translation_history = [];
        StorageEngine.writeAtomic(db);
        return count;
    }

    static deleteById(id) {
        const db = StorageEngine.readDatabase();
        const initialLen = db.translation_history.length;
        db.translation_history = db.translation_history.filter(r => r.history_id !== id);
        StorageEngine.writeAtomic(db);
        return db.translation_history.length < initialLen;
    }

    static getAnalytics() {
        const db = StorageEngine.readDatabase();
        const logs = db.translation_history || [];

        const totalTranslations = logs.length;
        const avgConfidence = totalTranslations > 0
            ? (logs.reduce((acc, curr) => acc + (curr.confidence_score || 0), 0) / totalTranslations).toFixed(2)
            : 0;

        // Group by sign frequency
        const frequencyMap = {};
        for (const log of logs) {
            frequencyMap[log.sign_name] = (frequencyMap[log.sign_name] || 0) + 1;
        }

        const topSigns = Object.entries(frequencyMap)
            .map(([sign, count]) => ({ sign, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            totalTranslations,
            avgConfidence: parseFloat(avgConfidence),
            uniqueSignsCount: Object.keys(frequencyMap).length,
            topSigns,
            databaseType: "ACID Persistent JSON / Hybrid Relational & NoSQL Schema"
        };
    }
}

// ============================================================================
// LAYER 3: SERVICE LOGIC (Business Rules & Domain Transformations)
// ============================================================================
class TranslationService {
    static getHistory(limit) {
        return TranslationRepository.getAll(limit);
    }

    static recordTranslation(payload) {
        return TranslationRepository.insert(payload);
    }

    static deleteById(id) {
        return TranslationRepository.deleteById(id);
    }

    static clearHistory() {
        return TranslationRepository.clearAll();
    }

    static getAnalytics() {
        return TranslationRepository.getAnalytics();
    }
}

// ============================================================================
// LAYER 2: VALIDATION LAYER (Pydantic / Joi equivalent Schema Validation)
// ============================================================================
class RequestValidator {
    static validateTranslationPayload(data) {
        const errors = [];
        if (!data || typeof data !== 'object') {
            errors.push("Payload must be a valid JSON object.");
            return { isValid: false, errors };
        }

        if (!data.sign_name || typeof data.sign_name !== 'string' || data.sign_name.trim() === '') {
            errors.push("Field 'sign_name' is required and must be a non-empty string.");
        }

        const conf = parseFloat(data.confidence_score);
        if (isNaN(conf) || conf < 0 || conf > 100) {
            errors.push("Field 'confidence_score' must be a numeric value between 0.0 and 100.0.");
        }

        if (data.output_mode && !['text', 'speech', 'both'].includes(data.output_mode)) {
            errors.push("Field 'output_mode' must be one of: 'text', 'speech', or 'both'.");
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// ============================================================================
// LAYER 1 & 6: REQUEST HANDLING, ROUTING & JSON RESPONSE SERIALIZATION
// ============================================================================
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json'
};

function sendJSON(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify(payload, null, 2), 'utf-8');
}

function parseJSONBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            // Prevent DoS payload overflow (> 1MB)
            if (body.length > 1e6) {
                req.destroy();
                reject(new Error("Payload too large"));
            }
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                reject(new Error("Malformed JSON"));
            }
        });
        req.on('error', err => reject(err));
    });
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // CORS pre-flight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        return res.end();
    }

    // ========================================================================
    // REST API ENDPOINTS
    // ========================================================================
    if (pathname.startsWith('/api/')) {
        try {
            // GET /api/health
            if (pathname === '/api/health' && method === 'GET') {
                return sendJSON(res, 200, {
                    status: "online",
                    system: "Sign Language Translator Layered Backend",
                    timestamp: new Date().toISOString()
                });
            }

            // GET /api/translations (Read History)
            if (pathname === '/api/translations' && method === 'GET') {
                const limit = parseInt(parsedUrl.searchParams.get('limit')) || 50;
                const records = TranslationService.getHistory(limit);
                return sendJSON(res, 200, {
                    status: "success",
                    count: records.length,
                    data: records
                });
            }

            // POST /api/translations (Create/Log Translation Record)
            if (pathname === '/api/translations' && method === 'POST') {
                const body = await parseJSONBody(req);
                const validation = RequestValidator.validateTranslationPayload(body);
                if (!validation.isValid) {
                    return sendJSON(res, 400, {
                        status: "validation_error",
                        errors: validation.errors
                    });
                }

                const savedRecord = TranslationService.recordTranslation(body);
                return sendJSON(res, 201, {
                    status: "created",
                    record: savedRecord
                });
            }

            // DELETE /api/translations (Clear History or Delete specific record by ID)
            if (pathname === '/api/translations' && method === 'DELETE') {
                const targetId = parsedUrl.searchParams.get('id');
                if (targetId) {
                    const success = TranslationService.deleteById(parseInt(targetId));
                    return sendJSON(res, 200, {
                        status: "success",
                        message: `Record ${targetId} ${success ? 'deleted successfully' : 'not found'}.`,
                        deleted: success
                    });
                } else {
                    const deletedCount = TranslationService.clearHistory();
                    return sendJSON(res, 200, {
                        status: "success",
                        message: `Cleared ${deletedCount} history records from database.`,
                        deletedCount
                    });
                }
            }

            // GET /api/analytics (Database Analytics & Metrics)
            if (pathname === '/api/analytics' && method === 'GET') {
                const stats = TranslationService.getAnalytics();
                return sendJSON(res, 200, {
                    status: "success",
                    analytics: stats
                });
            }

            // Unmatched API endpoint
            return sendJSON(res, 404, {
                status: "error",
                message: `Endpoint ${method} ${pathname} not found.`
            });

        } catch (apiError) {
            console.error("[API Error]", apiError);
            return sendJSON(res, 500, {
                status: "internal_server_error",
                message: apiError.message
            });
        }
    }

    // ========================================================================
    // STATIC FILE SERVER
    // ========================================================================
    const cleanUrl = (pathname === '/' ? 'index.html' : pathname.slice(1));
    const filePath = path.join(PUBLIC_DIR, cleanUrl);
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.warn(`[Port Conflict] Port ${currentPort} is already in use. Retrying on port ${currentPort + 1}...`);
        currentPort++;
        setTimeout(() => startListening(currentPort), 250);
    } else {
        console.error('[Server Error]', err);
    }
});

server.on('clientError', (err, socket) => {
    if (err.code === 'ECONNRESET' || !socket.writable) {
        return;
    }
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

process.on('uncaughtException', (err) => {
    console.error('[Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Rejection]', reason);
});

let currentPort = parseInt(process.env.PORT, 10) || 8080;

function startListening(port) {
    server.removeAllListeners('listening');
    server.listen(port, () => {
        console.log(`[Backend & Frontend Server] running at http://localhost:${port}/`);
        console.log(`[REST API] Endpoints available at /api/translations, /api/analytics, /api/health`);
    });
}

startListening(currentPort);


