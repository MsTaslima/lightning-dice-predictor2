// server.js (Updated Full File)
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const WebSocket = require('ws');
const fs = require('fs');

// Import Server AI Logic
const {
    ServerAI_Stick,
    ServerAI_ExtremeSwitch,
    ServerAI_LowMidSwitch,
    ServerAI_MidHighSwitch,
    ServerEnsembleVoter
} = require('./server-ai-logic');

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
    
    // New table for server AI state persistence
    db.run(`CREATE TABLE IF NOT EXISTS server_ai_state (
        ai_name TEXT PRIMARY KEY,
        state_data TEXT,
        updated_at DATETIME
    )`);
});

// Initialize Server AI Models
const serverAI = {
    stick: new ServerAI_Stick(),
    extreme: new ServerAI_ExtremeSwitch(),
    lowMid: new ServerAI_LowMidSwitch(),
    midHigh: new ServerAI_MidHighSwitch(),
    ensemble: new ServerEnsembleVoter()
};

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
    loadServerAIState();
    trainAllServerAIs();
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

// Load Server AI State from Database
async function loadServerAIState() {
    return new Promise((resolve) => {
        db.all(`SELECT ai_name, state_data FROM server_ai_state`, (err, rows) => {
            if (err) {
                console.error('Error loading AI state:', err);
                resolve();
                return;
            }
            
            for (const row of rows) {
                try {
                    const data = JSON.parse(row.state_data);
                    switch(row.ai_name) {
                        case 'AI_Stick':
                            serverAI.stick.loadFromData(data);
                            break;
                        case 'AI_ExtremeSwitch':
                            serverAI.extreme.loadFromData(data);
                            break;
                        case 'AI_LowMidSwitch':
                            serverAI.lowMid.loadFromData(data);
                            break;
                        case 'AI_MidHighSwitch':
                            serverAI.midHigh.loadFromData(data);
                            break;
                        case 'EnsembleVoter':
                            serverAI.ensemble.loadFromData(data);
                            break;
                    }
                } catch(e) {
                    console.error(`Error parsing state for ${row.ai_name}:`, e);
                }
            }
            
            console.log('✅ Server AI state loaded from database');
            resolve();
        });
    });
}

// Save Server AI State to Database
async function saveServerAIState(aiName) {
    let stateData = null;
    switch(aiName) {
        case 'AI_Stick':
            stateData = serverAI.stick.exportForServer();
            break;
        case 'AI_ExtremeSwitch':
            stateData = serverAI.extreme.exportForServer();
            break;
        case 'AI_LowMidSwitch':
            stateData = serverAI.lowMid.exportForServer();
            break;
        case 'AI_MidHighSwitch':
            stateData = serverAI.midHigh.exportForServer();
            break;
        case 'EnsembleVoter':
            stateData = serverAI.ensemble.exportForServer();
            break;
        default:
            return;
    }
    
    return new Promise((resolve) => {
        db.run(`INSERT OR REPLACE INTO server_ai_state (ai_name, state_data, updated_at)
                VALUES (?, ?, ?)`,
            [aiName, JSON.stringify(stateData), new Date().toISOString()],
            (err) => {
                if (err) console.error(`Error saving ${aiName} state:`, err);
                resolve();
            }
        );
    });
}

// Train all Server AI models with historical data
async function trainAllServerAIs() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id, group_name, timestamp FROM results ORDER BY timestamp ASC`, async (err, results) => {
            if (err || !results || results.length < 3) {
                console.log('⚠️ Not enough data to train server AI models');
                resolve();
                return;
            }
            
            const history = results.map(r => ({ group: r.group_name, id: r.id }));
            console.log(`📚 Training server AI models with ${history.length} historical results...`);
            
            serverAI.stick.train(history);
            serverAI.extreme.train(history);
            serverAI.lowMid.train(history);
            serverAI.midHigh.train(history);
            
            // Update ensemble weights
            serverAI.ensemble.updateWeights(
                serverAI.stick.getAccuracy(),
                serverAI.extreme.getAccuracy(),
                serverAI.lowMid.getAccuracy(),
                serverAI.midHigh.getAccuracy()
            );
            
            // Save states
            await saveServerAIState('AI_Stick');
            await saveServerAIState('AI_ExtremeSwitch');
            await saveServerAIState('AI_LowMidSwitch');
            await saveServerAIState('AI_MidHighSwitch');
            await saveServerAIState('EnsembleVoter');
            
            console.log('✅ All server AI models trained successfully!');
            resolve();
        });
    });
}

// Make prediction for a result (before knowing the actual result)
function makePrediction(previousResults) {
    if (!previousResults || previousResults.length < 2) {
        return {
            stick: 'MEDIUM',
            extreme: 'MEDIUM',
            lowMid: 'MEDIUM',
            midHigh: 'MEDIUM',
            ensemble: 'MEDIUM'
        };
    }
    
    const currentGroup = previousResults[0]?.group || 'MEDIUM';
    const previousGroup = previousResults[1]?.group || 'MEDIUM';
    
    // Get predictions from each AI
    const predStick = serverAI.stick.predict(currentGroup, previousGroup);
    const predExtreme = serverAI.extreme.predict(currentGroup, previousGroup);
    const predLowMid = serverAI.lowMid.predict(currentGroup, previousGroup);
    const predMidHigh = serverAI.midHigh.predict(currentGroup, previousGroup);
    
    // Extract predicted groups
    const stickGroup = predStick.prediction === "STICK" ? predStick.nextGroup : 
                      (predStick.prediction === "SWITCH" ? predStick.nextGroup : currentGroup);
    
    let extremeGroup = predExtreme.nextGroup;
    if (predExtreme.prediction === "CONTINUE" && predExtreme.pattern) {
        extremeGroup = predExtreme.pattern.split("→")[1] || 'MEDIUM';
    }
    
    let lowMidGroup = predLowMid.nextGroup;
    if (predLowMid.prediction === "CONTINUE" && predLowMid.pattern) {
        lowMidGroup = predLowMid.pattern.split("→")[1] || 'MEDIUM';
    }
    
    let midHighGroup = predMidHigh.nextGroup;
    if (predMidHigh.prediction === "CONTINUE" && predMidHigh.pattern) {
        midHighGroup = predMidHigh.pattern.split("→")[1] || 'MEDIUM';
    }
    
    // Ensemble prediction
    const ensembleResult = serverAI.ensemble.combine(predStick, predExtreme, predLowMid, predMidHigh);
    const ensembleGroup = ensembleResult.final.group;
    
    return {
        stick: stickGroup,
        extreme: extremeGroup,
        lowMid: lowMidGroup,
        midHigh: midHighGroup,
        ensemble: ensembleGroup,
        predictions: {
            predStick,
            predExtreme,
            predLowMid,
            predMidHigh,
            ensembleResult
        }
    };
}

// Save prediction for a result and update AI stats
async function savePredictionForResult(resultId, actualGroup, previousResults) {
    if (!previousResults || previousResults.length < 2) return null;
    
    const prediction = makePrediction(previousResults);
    
    // Check correctness
    const correct = {
        stick: prediction.stick === actualGroup,
        extreme: prediction.extreme === actualGroup,
        low_mid: prediction.lowMid === actualGroup,
        mid_high: prediction.midHigh === actualGroup,
        ensemble: prediction.ensemble === actualGroup
    };
    
    // Update AI models with actual result
    const currentGroup = previousResults[0]?.group || 'MEDIUM';
    const previousGroup = previousResults[1]?.group || 'MEDIUM';
    
    serverAI.stick.updateWithResult(actualGroup, previousGroup);
    serverAI.extreme.updateWithResult(actualGroup, previousGroup);
    serverAI.lowMid.updateWithResult(actualGroup, previousGroup);
    serverAI.midHigh.updateWithResult(actualGroup, previousGroup);
    
    // Record prediction results
    serverAI.stick.recordPredictionResult(correct.stick);
    serverAI.extreme.recordPredictionResult(correct.extreme);
    serverAI.lowMid.recordPredictionResult(correct.low_mid);
    serverAI.midHigh.recordPredictionResult(correct.mid_high);
    serverAI.ensemble.recordPredictionResult(correct.ensemble);
    
    // Update ensemble weights based on new accuracies
    serverAI.ensemble.updateWeights(
        serverAI.stick.getAccuracy(),
        serverAI.extreme.getAccuracy(),
        serverAI.lowMid.getAccuracy(),
        serverAI.midHigh.getAccuracy()
    );
    
    // Save to database
    return new Promise((resolve) => {
        db.run(`INSERT INTO predictions (result_id, ai_stick_group, ai_extreme_group, ai_low_mid_group, ai_mid_high_group, ensemble_group,
                correct_stick, correct_extreme, correct_low_mid, correct_mid_high, correct_ensemble, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [resultId, prediction.stick, prediction.extreme, prediction.lowMid, prediction.midHigh, prediction.ensemble,
             correct.stick ? 1 : 0, correct.extreme ? 1 : 0, correct.low_mid ? 1 : 0, correct.mid_high ? 1 : 0, correct.ensemble ? 1 : 0, new Date().toISOString()],
            async (err) => {
                if (err) {
                    console.error('Error saving prediction:', err);
                } else {
                    // Update AI stats table
                    await updateAIStatsTable('AI_Stick', correct.stick);
                    await updateAIStatsTable('AI_ExtremeSwitch', correct.extreme);
                    await updateAIStatsTable('AI_LowMidSwitch', correct.low_mid);
                    await updateAIStatsTable('AI_MidHighSwitch', correct.mid_high);
                    await updateAIStatsTable('EnsembleVoter', correct.ensemble);
                    
                    // Save server AI states
                    await saveServerAIState('AI_Stick');
                    await saveServerAIState('AI_ExtremeSwitch');
                    await saveServerAIState('AI_LowMidSwitch');
                    await saveServerAIState('AI_MidHighSwitch');
                    await saveServerAIState('EnsembleVoter');
                }
                resolve(prediction);
            }
        );
    });
}

// Update AI stats table
async function updateAIStatsTable(aiName, correct) {
    return new Promise((resolve) => {
        db.get(`SELECT * FROM ai_stats WHERE ai_name = ?`, [aiName], (err, stat) => {
            const total = (stat ? stat.total_predictions : 0) + 1;
            const correctTotal = (stat ? stat.correct_predictions : 0) + (correct ? 1 : 0);
            const accuracy = (correctTotal / total) * 100;
            
            db.run(`INSERT OR REPLACE INTO ai_stats (ai_name, total_predictions, correct_predictions, accuracy, last_updated)
                    VALUES (?, ?, ?, ?, ?)`,
                [aiName, total, correctTotal, accuracy, new Date().toISOString()],
                () => resolve()
            );
        });
    });
}

// Get previous N results for prediction
async function getPreviousResults(limit = 5) {
    return new Promise((resolve) => {
        db.all(`SELECT group_name FROM results ORDER BY timestamp DESC LIMIT ?`, [limit], (err, results) => {
            if (err || !results) resolve([]);
            else resolve(results.map(r => ({ group: r.group_name })));
        });
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
                
                // Check if result already exists
                const exists = await new Promise((resolve) => {
                    db.get(`SELECT id FROM results WHERE id = ?`, [gameId], (err, row) => {
                        resolve(!!row);
                    });
                });
                
                if (!exists) {
                    await saveGameResult(game);
                    
                    // Get previous results for prediction
                    const previousResults = await getPreviousResults(5);
                    
                    // Make and save prediction for this result
                    if (previousResults.length >= 2) {
                        const totalResult = game.result.total;
                        const group = getGroup(totalResult);
                        await savePredictionForResult(gameId, group, previousResults);
                        console.log(`✅ Prediction saved for game: ${gameId}`);
                    }
                }
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

// API: Get current prediction (for next round)
app.get('/api/current-prediction', async (req, res) => {
    const previousResults = await getPreviousResults(5);
    if (previousResults.length < 2) {
        res.json({ error: 'Not enough data for prediction', prediction: null });
        return;
    }
    
    const prediction = makePrediction(previousResults);
    res.json({
        success: true,
        prediction: prediction,
        basedOnResults: previousResults.map(r => r.group)
    });
});

// API: Retrain all AI models
app.post('/api/retrain-all', async (req, res) => {
    await trainAllServerAIs();
    res.json({ success: true, message: 'All AI models retrained successfully' });
});

// API: Get server AI stats
app.get('/api/server-ai-stats', (req, res) => {
    res.json({
        stick: serverAI.stick.getStats ? serverAI.stick.getStats() : { accuracy: serverAI.stick.getAccuracy(), totalPredictions: serverAI.stick.totalPredictions },
        extreme: serverAI.extreme.getStats ? serverAI.extreme.getStats() : { accuracy: serverAI.extreme.getAccuracy(), totalPredictions: serverAI.extreme.totalPredictions },
        lowMid: serverAI.lowMid.getStats ? serverAI.lowMid.getStats() : { accuracy: serverAI.lowMid.getAccuracy(), totalPredictions: serverAI.lowMid.totalPredictions },
        midHigh: serverAI.midHigh.getStats ? serverAI.midHigh.getStats() : { accuracy: serverAI.midHigh.getAccuracy(), totalPredictions: serverAI.midHigh.totalPredictions },
        ensemble: { accuracy: serverAI.ensemble.getAccuracy(), totalPredictions: serverAI.ensemble.totalPredictions }
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
console.log('🤖 Server-side AI prediction engine active');
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
