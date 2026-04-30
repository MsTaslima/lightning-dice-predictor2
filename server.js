// ============================================================
// FIXED server.js (v7.0 - Working 3-Step Pattern AI)
// ============================================================

require('events').EventEmitter.defaultMaxListeners = 20;
process.setMaxListeners(20);
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const WebSocket = require('ws');
const fs = require('fs');

// ============ IMPORT NEW AI ============
const { NewPatternAI } = require('./new-ai-logic');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ TELEGRAM ============
let aiMissCount = 0;
let alertTriggered = false;

async function sendTelegramNotification(missCount, actualGroup, predictedGroup, nextPrediction) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!botToken || !chatId) return;
    
    const message = `⚡ LIGHTNING DICE ALERT ⚡

🎯 AI has been WRONG for ${missCount} consecutive rounds!

📊 Current Round:
• Predicted: ${predictedGroup}
• Actual: ${actualGroup}

🔮 NEXT ROUND PREDICTION:
🎲 ${nextPrediction}

📎 Live: https://web-production-ebac2.up.railway.app`;

    try {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });
        console.log(`✅ Telegram notification sent`);
    } catch (error) {
        console.error('❌ Telegram error:', error.message);
    }
}

// ============ DATABASE SETUP ============
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, 'lightning_dice.db');
const db = new sqlite3.Database(dbPath);

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
        result_id TEXT UNIQUE,
        pattern_3step TEXT,
        protection_type TEXT,
        predicted_group TEXT,
        prediction_timestamp DATETIME,
        actual_group TEXT,
        actual_timestamp DATETIME,
        is_correct INTEGER DEFAULT -1
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS ai_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_predictions INTEGER DEFAULT 0,
        correct_predictions INTEGER DEFAULT 0,
        accuracy REAL DEFAULT 0,
        last_updated DATETIME
    )`);
    
    console.log('✅ Database tables ready (v7.0)');
});

// ============ INITIALIZE AI ============
let serverAI = new NewPatternAI();

// ============ MIDDLEWARE ============
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('public'));

// ============ WEB SOCKET ============
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n⚡ Lightning Dice Predictor v7.0 - ACTIVE`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🤖 3-Step Pattern AI Ready\n`);
});

const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`🔌 Client connected: ${clients.size}`);
    ws.on('close', () => clients.delete(ws));
});

function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(message);
    });
}

// ============ HELPER FUNCTIONS ============
function getGroup(number) {
    if (number >= 3 && number <= 9) return 'LOW';
    if (number >= 10 && number <= 11) return 'MEDIUM';
    if (number >= 12 && number <= 18) return 'HIGH';
    return 'UNKNOWN';
}

function getLast3Results() {
    return new Promise((resolve) => {
        db.all(`SELECT group_name FROM results ORDER BY timestamp DESC LIMIT 3`, (err, rows) => {
            if (err || !rows || rows.length < 3) {
                resolve(null);
            } else {
                resolve([rows[2].group_name, rows[1].group_name, rows[0].group_name]);
            }
        });
    });
}

function getPreviousResults(limit = 10) {
    return new Promise((resolve) => {
        db.all(`SELECT group_name, id, timestamp FROM results ORDER BY timestamp DESC LIMIT ?`, [limit], (err, rows) => {
            if (err) resolve([]);
            else resolve(rows.map(r => ({ group: r.group_name, id: r.id, timestamp: r.timestamp })));
        });
    });
}

// ============ PREDICTION FUNCTIONS ============
async function savePredictionOnly(resultId, last3Results) {
    if (!last3Results || last3Results.length !== 3) {
        console.log(`⚠️ Cannot save prediction: need 3 results`);
        return null;
    }
    
    const prediction = serverAI.predict(last3Results);
    
    console.log(`\n📝 PREDICTION for ${resultId}:`);
    console.log(`   Last 3: ${last3Results.join(' → ')}`);
    console.log(`   Status: ${prediction.status}`);
    
    if (prediction.status === 'PREDICTION_READY') {
        console.log(`   Pattern: ${prediction.pattern}`);
        console.log(`   Protection: ${prediction.protectionType}`);
        console.log(`   Prediction: ${prediction.predictedGroup} (${prediction.confidence}%)`);
    } else {
        console.log(`   WAIT MODE - no prediction until pattern matches`);
    }
    
    return new Promise((resolve) => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO predictions (
            result_id, pattern_3step, protection_type, predicted_group, prediction_timestamp, is_correct
        ) VALUES (?, ?, ?, ?, ?, -1)`);
        
        stmt.run([resultId, prediction.pattern || '--', prediction.protectionType || 'WAITING', 
                  prediction.predictedGroup || 'WAITING', new Date().toISOString()], (err) => {
            if (err) console.error('Error saving prediction:', err);
            else console.log(`✅ Prediction saved for ${resultId}`);
            resolve(prediction);
        });
        stmt.finalize();
    });
}

async function updatePredictionWithResult(resultId, actualGroup) {
    const prediction = await new Promise((resolve) => {
        db.get(`SELECT predicted_group, pattern_3step, protection_type FROM predictions WHERE result_id = ?`, [resultId], (err, row) => {
            resolve(row);
        });
    });
    
    if (!prediction) {
        console.log(`⚠️ No prediction found for ${resultId}`);
        return null;
    }
    
    const isCorrect = (prediction.predicted_group === actualGroup) ? 1 : 0;
    console.log(`📊 Update ${resultId}: Predicted ${prediction.predicted_group} → Actual ${actualGroup} → ${isCorrect ? '✓' : '✗'}`);
    
    // Update AI learning
    if (prediction.predicted_group !== 'WAITING') {
        serverAI.updateWithResult(actualGroup);
    }
    
    // Telegram check
    if (isCorrect === 0 && prediction.predicted_group !== 'WAITING') {
        aiMissCount++;
        if (aiMissCount >= 4 && !alertTriggered) {
            const nextPred = serverAI.predict(await getLast3Results());
            await sendTelegramNotification(aiMissCount, actualGroup, prediction.predicted_group, nextPred.predictedGroup || '?');
            alertTriggered = true;
        }
    } else if (isCorrect === 1) {
        aiMissCount = 0;
        alertTriggered = false;
    }
    
    // Update stats
    const stats = await new Promise((resolve) => {
        db.get(`SELECT total_predictions, correct_predictions FROM ai_stats ORDER BY id DESC LIMIT 1`, (err, row) => {
            resolve(row || { total_predictions: 0, correct_predictions: 0 });
        });
    });
    
    const newTotal = stats.total_predictions + 1;
    const newCorrect = stats.correct_predictions + (isCorrect === 1 ? 1 : 0);
    const newAccuracy = (newCorrect / newTotal) * 100;
    
    db.run(`INSERT INTO ai_stats (total_predictions, correct_predictions, accuracy, last_updated) VALUES (?, ?, ?, ?)`,
        [newTotal, newCorrect, newAccuracy, new Date().toISOString()]);
    
    return new Promise((resolve) => {
        db.run(`UPDATE predictions SET actual_group = ?, actual_timestamp = ?, is_correct = ? WHERE result_id = ?`,
            [actualGroup, new Date().toISOString(), isCorrect, resultId], () => resolve({ isCorrect }));
    });
}

async function getCurrentPredictionData() {
    const last3 = await getLast3Results();
    if (!last3) {
        return { status: 'WAITING', waitingForData: true, message: 'Need 3 results', last3Results: null };
    }
    
    const prediction = serverAI.predict(last3);
    
    return {
        status: prediction.status,
        pattern3step: prediction.pattern,
        protectionType: prediction.protectionType,
        predictedGroup: prediction.predictedGroup,
        confidence: prediction.confidence,
        description: prediction.description,
        waitingForData: (prediction.status === 'WAITING'),
        last3Results: last3,
        continueGroup: prediction.continueGroup,
        switchGroup: prediction.switchGroup
    };
}

function getResultsData(limit = 100) {
    return new Promise((resolve) => {
        db.all(`SELECT id, total, group_name as group, multiplier, dice_values as diceValues, timestamp 
                FROM results ORDER BY timestamp DESC LIMIT ?`, [limit], (err, rows) => {
            if (err) resolve([]);
            else resolve(rows || []);
        });
    });
}

function getPredictionsData(limit = 500) {
    return new Promise((resolve) => {
        db.all(`SELECT p.*, r.total, r.dice_values, r.timestamp as result_time
                FROM predictions p LEFT JOIN results r ON p.result_id = r.id
                ORDER BY p.prediction_timestamp DESC LIMIT ?`, [limit], (err, rows) => {
            if (err) resolve([]);
            else {
                resolve(rows.map(p => ({
                    id: p.result_id,
                    time: p.prediction_timestamp ? new Date(p.prediction_timestamp).toLocaleTimeString() : '--',
                    dice: p.dice_values || '--',
                    total: p.total || '--',
                    actualGroup: p.actual_group || '?',
                    pattern3step: p.pattern_3step || '--',
                    protectionType: p.protection_type || '--',
                    predictedGroup: p.predicted_group || '--',
                    isCorrect: p.is_correct === 1,
                    isPending: p.actual_group === null
                })));
            }
        });
    });
}

function getStatsData() {
    return new Promise((resolve) => {
        db.get(`SELECT COUNT(*) as totalRounds, COALESCE(AVG(total), 0) as avgResult,
                (SELECT group_name FROM results GROUP BY group_name ORDER BY COUNT(*) DESC LIMIT 1) as mostActiveGroup
                FROM results`, (err, stats) => {
            if (err) resolve({ totalRounds: 0, avgResult: 0, mostActiveGroup: 'LOW', lightningBoost: 0 });
            else {
                db.get(`SELECT COUNT(*) as lightningCount FROM results WHERE multiplier > 10`, (err, lightning) => {
                    db.get(`SELECT COUNT(*) as total FROM results`, (err, total) => {
                        const lightningPercent = total?.total > 0 ? ((lightning?.lightningCount || 0) / total.total) * 100 : 0;
                        resolve({
                            totalRounds: stats?.totalRounds || 0,
                            avgResult: stats?.avgResult?.toFixed(2) || 0,
                            mostActiveGroup: stats?.mostActiveGroup || 'LOW',
                            lightningBoost: Math.round(lightningPercent)
                        });
                    });
                });
            }
        });
    });
}

// ============ DATA COLLECTION ============
let lastGameId = null;
let isCollecting = false;

async function saveGameResult(game) {
    const total = game.result.total;
    const group = getGroup(total);
    const diceValues = game.result.value || '⚀ ⚀ ⚀';
    
    const result = {
        id: game.id,
        total: total,
        group_name: group,
        multiplier: 1,
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
                else resolve(result);
            }
        );
    });
}

async function collectData() {
    if (isCollecting) return;
    isCollecting = true;
    
    try {
        const response = await axios.get('https://api-cs.casino.org/svc-evolution-game-events/api/lightningdice/latest', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
            timeout: 10000
        });
        
        if (response.data?.data) {
            const game = response.data.data;
            const gameId = game.id;
            
            if (lastGameId !== gameId) {
                lastGameId = gameId;
                
                const exists = await new Promise((resolve) => {
                    db.get(`SELECT id FROM results WHERE id = ?`, [gameId], (err, row) => resolve(!!row));
                });
                
                if (!exists) {
                    console.log(`🆕 New game: ${gameId}`);
                    const last3 = await getLast3Results();
                    await savePredictionOnly(gameId, last3);
                    const savedResult = await saveGameResult(game);
                    await updatePredictionWithResult(gameId, getGroup(game.result.total));
                    
                    const [results, predictions, stats] = await Promise.all([
                        getResultsData(100),
                        getPredictionsData(500),
                        getStatsData()
                    ]);
                    
                    broadcast({
                        type: 'new_result',
                        result: savedResult,
                        prediction: await getCurrentPredictionData(),
                        history: predictions,
                        stats: stats,
                        allResults: results
                    });
                }
            }
        }
    } catch (error) {
        console.error('❌ Data collection error:', error.message);
    }
    
    isCollecting = false;
}

// ============ API ENDPOINTS ============
app.get('/api/all-data', async (req, res) => {
    const [results, predictions, stats, currentPrediction] = await Promise.all([
        getResultsData(100),
        getPredictionsData(500),
        getStatsData(),
        getCurrentPredictionData()
    ]);
    res.json({ success: true, results, predictions, stats, currentPrediction });
});

app.get('/api/current-prediction', async (req, res) => {
    res.json({ success: true, prediction: await getCurrentPredictionData() });
});

app.get('/api/predictions', async (req, res) => {
    res.json(await getPredictionsData(parseInt(req.query.limit) || 500));
});

app.get('/api/results', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    db.all(`SELECT * FROM results ORDER BY timestamp DESC LIMIT ? OFFSET ?`, [limit, offset], (err, data) => {
        db.get(`SELECT COUNT(*) as total FROM results`, (err, count) => {
            res.json({ data, pagination: { page, limit, total: count?.total || 0, pages: Math.ceil((count?.total || 0) / limit) } });
        });
    });
});

app.get('/api/stats', async (req, res) => { res.json(await getStatsData()); });
app.get('/api/ai-stats', async (req, res) => {
    db.get(`SELECT total_predictions, correct_predictions, accuracy FROM ai_stats ORDER BY id DESC LIMIT 1`, (err, row) => {
        res.json(row || { total_predictions: 0, correct_predictions: 0, accuracy: 0 });
    });
});
app.get('/api/health', (req, res) => { res.json({ status: 'OK', version: '7.0', clients: clients.size }); });

// ============ START ============
setInterval(collectData, 3000);
collectData();

console.log('🤖 3-Step Pattern AI v7.0 ACTIVE');
console.log('📊 6 Patterns: LOW→HIGH→MEDIUM, HIGH→LOW→MEDIUM, MEDIUM→LOW→HIGH, MEDIUM→HIGH→LOW, LOW→MEDIUM→HIGH, HIGH→MEDIUM→LOW');
console.log('🛡️ CONTINUE/SWITCH Protection | ⏳ WAIT Mode');

process.on('SIGTERM', () => { server.close(() => { db.close(() => process.exit(0)); }); });
process.on('SIGINT', () => { server.close(() => { db.close(() => process.exit(0)); }); });
