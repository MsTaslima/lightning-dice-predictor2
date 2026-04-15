const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const WebSocket = require('ws');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure database directory exists
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Database setup
const db = new sqlite3.Database(path.join(dbDir, 'lightning_dice.db'));

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS results (
        id TEXT PRIMARY KEY,
        total INTEGER,
        group_name TEXT,
        multiplier INTEGER,
        dice_values TEXT,
        timestamp DATETIME,
        winners INTEGER,
        payout INTEGER
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        result_id TEXT,
        ai_stick_group TEXT,
        ai_extreme_group TEXT,
        ai_low_mid_group TEXT,
        ai_mid_high_group TEXT,
        ensemble_group TEXT,
        correct_stick INTEGER,
        correct_extreme INTEGER,
        correct_low_mid INTEGER,
        correct_mid_high INTEGER,
        correct_ensemble INTEGER,
        timestamp DATETIME,
        FOREIGN KEY(result_id) REFERENCES results(id)
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS ai_stats (
        ai_name TEXT PRIMARY KEY,
        total_predictions INTEGER DEFAULT 0,
        correct_predictions INTEGER DEFAULT 0,
        accuracy REAL DEFAULT 0,
        last_updated DATETIME
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS pattern_data (
        ai_name TEXT,
        pattern_key TEXT,
        streak_value INTEGER,
        max_streak INTEGER,
        break_data TEXT,
        updated_at DATETIME,
        PRIMARY KEY(ai_name, pattern_key)
    )`);
});

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('public'));

// WebSocket Server for real-time updates
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n⚡ Lightning Dice Predictor - Four AI Pattern System`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🚀 Server running on port ${PORT}\n`);
});

const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`🔌 Client connected. Total clients: ${clients.size}`);
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log(`🔌 Client disconnected. Total clients: ${clients.size}`);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Broadcast to all connected clients
function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Background data collection service
let lastGameId = null;
let isCollecting = false;

async function collectData() {
    if (isCollecting) return;
    isCollecting = true;
    
    try {
        const response = await axios.get('https://api-cs.casino.org/svc-evolution-game-events/api/lightningdice/latest', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 10000
        });
        
        if (response.data && response.data.data) {
            const game = response.data.data;
            const gameId = game.id;
            
            if (lastGameId !== gameId) {
                lastGameId = gameId;
                await saveGameResult(game);
                console.log(`✅ New game saved: ${gameId}`);
            }
        }
    } catch (error) {
        console.error('❌ Data collection error:', error.message);
    }
    
    isCollecting = false;
}

async function saveGameResult(game) {
    const total = game.result.total;
    const group = getGroup(total);
    const multipliers = game.result.luckyNumbersList || [];
    const multiplierItem = multipliers.find(m => m.outcome === `LightningDice_Total${total}`);
    const diceValues = game.result.value || '⚀ ⚀ ⚀';
    
    const result = {
        id: game.id,
        total: total,
        group_name: group,
        multiplier: multiplierItem ? multiplierItem.multiplier : 1,
        dice_values: diceValues,
        timestamp: new Date(game.settledAt).toISOString(),
        winners: game.totalWinners || 0,
        payout: game.totalAmount || 0
    };
    
    return new Promise((resolve, reject) => {
        db.run(`INSERT OR REPLACE INTO results (id, total, group_name, multiplier, dice_values, timestamp, winners, payout)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [result.id, result.total, result.group_name, result.multiplier, result.dice_values, result.timestamp, result.winners, result.payout],
            (err) => {
                if (err) reject(err);
                else {
                    broadcast({ type: 'new_result', data: result });
                    resolve();
                }
            }
        );
    });
}

function getGroup(number) {
    if (number >= 3 && number <= 9) return 'LOW';
    if (number >= 10 && number <= 11) return 'MEDIUM';
    if (number >= 12 && number <= 18) return 'HIGH';
    return 'UNKNOWN';
}

// API: Get all results with pagination
app.get('/api/results', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    db.all(`SELECT * FROM results ORDER BY timestamp DESC LIMIT ? OFFSET ?`, [limit, offset], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        db.get(`SELECT COUNT(*) as total FROM results`, (err, count) => {
            res.json({
                data: results,
                pagination: {
                    page: page,
                    limit: limit,
                    total: count ? count.total : 0,
                    pages: Math.ceil((count ? count.total : 0) / limit)
                }
            });
        });
    });
});

// API: Get predictions history
app.get('/api/predictions', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    
    db.all(`SELECT p.*, r.total, r.group_name as actual_group, r.dice_values, r.timestamp as result_time
            FROM predictions p
            JOIN results r ON p.result_id = r.id
            ORDER BY p.timestamp DESC LIMIT ?`, [limit], (err, predictions) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(predictions);
    });
});

// API: Get stats
app.get('/api/stats', (req, res) => {
    db.get(`SELECT 
                COUNT(*) as total_rounds,
                AVG(total) as avg_result,
                (SELECT group_name FROM results GROUP BY group_name ORDER BY COUNT(*) DESC LIMIT 1) as most_active_group
            FROM results`, (err, stats) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        db.get(`SELECT COUNT(*) as lightning_count FROM results WHERE multiplier > 10`, (err, lightning) => {
            db.get(`SELECT COUNT(*) as total FROM results`, (err, total) => {
                const lightningPercent = total && total.total > 0 ? (lightning.lightning_count / total.total) * 100 : 0;
                res.json({
                    totalRounds: stats ? stats.total_rounds : 0,
                    avgResult: stats ? stats.avg_result.toFixed(2) : 0,
                    mostActiveGroup: stats ? stats.most_active_group : 'LOW',
                    lightningBoost: Math.round(lightningPercent)
                });
            });
        });
    });
});

// API: Get group distribution
app.get('/api/group-distribution', (req, res) => {
    db.all(`SELECT group_name, COUNT(*) as count FROM results GROUP BY group_name`, (err, groups) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const total = groups.reduce((sum, g) => sum + g.count, 0);
        const distribution = {};
        groups.forEach(g => {
            distribution[g.group_name] = {
                count: g.count,
                percentage: total > 0 ? (g.count / total) * 100 : 0
            };
        });
        
        res.json(distribution);
    });
});

// API: Save prediction
app.post('/api/save-prediction', (req, res) => {
    const { result_id, ai_stick_group, ai_extreme_group, ai_low_mid_group, ai_mid_high_group, ensemble_group, correct } = req.body;
    
    db.run(`INSERT INTO predictions (result_id, ai_stick_group, ai_extreme_group, ai_low_mid_group, ai_mid_high_group, ensemble_group,
            correct_stick, correct_extreme, correct_low_mid, correct_mid_high, correct_ensemble, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [result_id, ai_stick_group, ai_extreme_group, ai_low_mid_group, ai_mid_high_group, ensemble_group,
         correct.stick ? 1 : 0, correct.extreme ? 1 : 0, correct.low_mid ? 1 : 0, correct.mid_high ? 1 : 0, correct.ensemble ? 1 : 0, new Date().toISOString()],
        (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        });
});

// API: Get AI stats
app.get('/api/ai-stats', (req, res) => {
    db.all(`SELECT * FROM ai_stats`, (err, stats) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(stats);
    });
});

// API: Update AI stats
app.post('/api/update-ai-stats', (req, res) => {
    const { ai_name, correct } = req.body;
    
    db.get(`SELECT * FROM ai_stats WHERE ai_name = ?`, [ai_name], (err, stat) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const total = (stat ? stat.total_predictions : 0) + 1;
        const correct_total = (stat ? stat.correct_predictions : 0) + (correct ? 1 : 0);
        const accuracy = (correct_total / total) * 100;
        
        db.run(`INSERT OR REPLACE INTO ai_stats (ai_name, total_predictions, correct_predictions, accuracy, last_updated)
                VALUES (?, ?, ?, ?, ?)`,
            [ai_name, total, correct_total, accuracy, new Date().toISOString()],
            (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ success: true, accuracy: accuracy });
            });
    });
});

// API: Save pattern data
app.post('/api/save-pattern', (req, res) => {
    const { ai_name, pattern_key, streak_value, max_streak, break_data } = req.body;
    
    db.run(`INSERT OR REPLACE INTO pattern_data (ai_name, pattern_key, streak_value, max_streak, break_data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
        [ai_name, pattern_key, streak_value, max_streak, JSON.stringify(break_data), new Date().toISOString()],
        (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        });
});

// API: Load pattern data
app.get('/api/load-pattern/:ai_name', (req, res) => {
    db.all(`SELECT pattern_key, streak_value, max_streak, break_data FROM pattern_data WHERE ai_name = ?`, 
        [req.params.ai_name], (err, patterns) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const result = {};
        patterns.forEach(p => {
            result[p.pattern_key] = {
                streak_value: p.streak_value,
                max_streak: p.max_streak,
                break_data: JSON.parse(p.break_data)
            };
        });
        res.json(result);
    });
});

// API: Get latest result
app.get('/api/latest', (req, res) => {
    db.get(`SELECT * FROM results ORDER BY timestamp DESC LIMIT 1`, (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(result || {});
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        clients: clients.size,
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'production'
    });
});

// Start background data collection
setInterval(collectData, 3000);
collectData();

console.log('📊 Background data collection started (every 3 seconds)');
console.log(`🔌 WebSocket server ready for real-time updates`);

// Graceful shutdown handling for Railway
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server gracefully...');
    server.close(() => {
        console.log('Server closed');
        db.close(() => {
            console.log('Database connection closed');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing server gracefully...');
    server.close(() => {
        console.log('Server closed');
        db.close(() => {
            console.log('Database connection closed');
            process.exit(0);
        });
    });
});
