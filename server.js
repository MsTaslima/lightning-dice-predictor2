// ============================================================
// COMPLETE server.js (FIXED - With all corrections)
// ============================================================

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
        result_id TEXT UNIQUE,
        ai_stick_group TEXT,
        ai_extreme_group TEXT,
        ai_low_mid_group TEXT,
        ai_mid_high_group TEXT,
        ensemble_group TEXT,
        prediction_timestamp DATETIME,
        actual_group TEXT,
        actual_timestamp DATETIME,
        correct_stick INTEGER DEFAULT -1,
        correct_extreme INTEGER DEFAULT -1,
        correct_low_mid INTEGER DEFAULT -1,
        correct_mid_high INTEGER DEFAULT -1,
        correct_ensemble INTEGER DEFAULT -1
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

// WebSocket Server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n⚡ Lightning Dice Predictor - WebSocket Optimized`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🚀 Server running on port ${PORT}\n`);
    loadServerAIState();
    trainAllServerAIs();
});

const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
    // FIX 2: Increase max listeners to prevent memory leak warning
    ws.setMaxListeners(20);
    
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

async function trainAllServerAIs() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id, group_name, timestamp FROM results ORDER BY timestamp ASC`, async (err, results) => {
            if (err || !results || results.length < 3) {
                console.log('⚠️ Not enough data to train server AI models (need at least 3 results)');
                resolve();
                return;
            }
            
            const history = results.map(r => ({ group: r.group_name, id: r.id }));
            console.log(`📚 Training server AI models with ${history.length} historical results...`);
            
            serverAI.stick.train(history);
            serverAI.extreme.train(history);
            serverAI.lowMid.train(history);
            serverAI.midHigh.train(history);
            
            serverAI.ensemble.updateWeights(
                serverAI.stick.getAccuracy(),
                serverAI.extreme.getAccuracy(),
                serverAI.lowMid.getAccuracy(),
                serverAI.midHigh.getAccuracy()
            );
            
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

// ============ DATA RETRIEVAL HELPER FUNCTIONS ============

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
                FROM predictions p
                LEFT JOIN results r ON p.result_id = r.id
                ORDER BY p.prediction_timestamp DESC LIMIT ?`, [limit], (err, rows) => {
            if (err) resolve([]);
            else {
                const transformed = (rows || []).map(p => ({
                    id: p.result_id,
                    time: p.prediction_timestamp ? new Date(p.prediction_timestamp).toLocaleTimeString() : '--',
                    dice: p.dice_values || '--',
                    total: p.total || '--',
                    actualGroup: p.actual_group || '?',
                    predStick: p.ai_stick_group || 'MEDIUM',
                    predExtreme: p.ai_extreme_group || 'MEDIUM',
                    predLowMid: p.ai_low_mid_group || 'MEDIUM',
                    predMidHigh: p.ai_mid_high_group || 'MEDIUM',
                    ensemble: p.ensemble_group || 'MEDIUM',
                    correctStick: p.correct_stick === 1,
                    correctExtreme: p.correct_extreme === 1,
                    correctLowMid: p.correct_low_mid === 1,
                    correctMidHigh: p.correct_mid_high === 1,
                    correctEnsemble: p.correct_ensemble === 1,
                    timestamp: new Date(p.prediction_timestamp),
                    isPending: p.actual_group === null
                }));
                resolve(transformed);
            }
        });
    });
}

function getStatsData() {
    return new Promise((resolve) => {
        db.get(`SELECT 
                    COUNT(*) as totalRounds,
                    COALESCE(AVG(total), 0) as avgResult,
                    (SELECT group_name FROM results GROUP BY group_name ORDER BY COUNT(*) DESC LIMIT 1) as mostActiveGroup
                FROM results`, (err, stats) => {
            if (err) resolve({ totalRounds: 0, avgResult: 0, mostActiveGroup: 'LOW', lightningBoost: 0 });
            else {
                db.get(`SELECT COUNT(*) as lightningCount FROM results WHERE multiplier > 10`, (err, lightning) => {
                    db.get(`SELECT COUNT(*) as total FROM results`, (err, total) => {
                        const lightningPercent = total && total.total > 0 ? (lightning?.lightningCount || 0) / total.total * 100 : 0;
                        resolve({
                            totalRounds: stats?.totalRounds || 0,
                            avgResult: stats?.avgResult ? stats.avgResult.toFixed(2) : 0,
                            mostActiveGroup: stats?.mostActiveGroup || 'LOW',
                            lightningBoost: Math.round(lightningPercent)
                        });
                    });
                });
            }
        });
    });
}

function getAIStatsData() {
    return new Promise((resolve) => {
        db.all(`SELECT ai_name, accuracy, total_predictions, correct_predictions FROM ai_stats`, (err, rows) => {
            if (err) resolve([]);
            else resolve(rows || []);
        });
    });
}

function getPreviousResultsForPrediction(limit = 5) {
    return new Promise((resolve) => {
        db.all(`SELECT group_name as group FROM results ORDER BY timestamp DESC LIMIT ?`, [limit], (err, results) => {
            if (err || !results) resolve([]);
            else resolve(results || []);
        });
    });
}

async function getCurrentPredictionData() {
    const previousResults = await getPreviousResultsForPrediction(5);
    if (previousResults.length < 2) {
        return {
            stick: 'MEDIUM',
            extreme: 'MEDIUM',
            lowMid: 'MEDIUM',
            midHigh: 'MEDIUM',
            ensemble: 'MEDIUM',
            stickConfidence: 50,
            extremeConfidence: 50,
            lowMidConfidence: 50,
            midHighConfidence: 50,
            ensembleConfidence: 50,
            agreement: 0
        };
    }
    
    const currentGroup = previousResults[0]?.group || 'MEDIUM';
    const previousGroup = previousResults[1]?.group || 'MEDIUM';
    
    const predStick = serverAI.stick.predict(currentGroup, previousGroup);
    const predExtreme = serverAI.extreme.predict(currentGroup, previousGroup);
    const predLowMid = serverAI.lowMid.predict(currentGroup, previousGroup);
    const predMidHigh = serverAI.midHigh.predict(currentGroup, previousGroup);
    
    let stickGroup = currentGroup;
    if (predStick.prediction === "STICK") {
        stickGroup = predStick.nextGroup || currentGroup;
    } else if (predStick.prediction === "SWITCH") {
        stickGroup = predStick.nextGroup || 'MEDIUM';
    }
    
    let extremeGroup = 'MEDIUM';
    if (predExtreme.prediction === "CONTINUE" && predExtreme.pattern) {
        const parts = predExtreme.pattern.split("→");
        extremeGroup = parts[1]?.trim() || 'MEDIUM';
    } else if (predExtreme.prediction === "BREAK") {
        extremeGroup = predExtreme.nextGroup || 'MEDIUM';
    }
    
    let lowMidGroup = 'MEDIUM';
    if (predLowMid.prediction === "CONTINUE" && predLowMid.pattern) {
        const parts = predLowMid.pattern.split("→");
        lowMidGroup = parts[1]?.trim() || 'MEDIUM';
    } else if (predLowMid.prediction === "BREAK") {
        lowMidGroup = predLowMid.nextGroup || 'MEDIUM';
    }
    
    let midHighGroup = 'MEDIUM';
    if (predMidHigh.prediction === "CONTINUE" && predMidHigh.pattern) {
        const parts = predMidHigh.pattern.split("→");
        midHighGroup = parts[1]?.trim() || 'MEDIUM';
    } else if (predMidHigh.prediction === "BREAK") {
        midHighGroup = predMidHigh.nextGroup || 'MEDIUM';
    }
    
    const ensembleResult = serverAI.ensemble.combine(predStick, predExtreme, predLowMid, predMidHigh);
    const ensembleGroup = ensembleResult.final.group;
    
    return {
        stick: stickGroup,
        extreme: extremeGroup,
        lowMid: lowMidGroup,
        midHigh: midHighGroup,
        ensemble: ensembleGroup,
        stickConfidence: predStick.confidence || 65,
        extremeConfidence: predExtreme.confidence || 65,
        lowMidConfidence: predLowMid.confidence || 65,
        midHighConfidence: predMidHigh.confidence || 65,
        ensembleConfidence: ensembleResult.final.confidence,
        agreement: ensembleResult.final.agreement
    };
}

// ============ PREDICTION FUNCTIONS ============

async function savePredictionOnly(resultId, previousResults) {
    if (!previousResults || previousResults.length < 2) {
        console.log(`⚠️ Cannot save prediction for ${resultId}: insufficient history`);
        return null;
    }
    
    const prediction = await getCurrentPredictionData();
    
    console.log(`\n📝 SAVING PREDICTION ONLY (before result) for ${resultId}:`);
    console.log(`   AI-A (Stick): ${prediction.stick}`);
    console.log(`   AI-B (Extreme): ${prediction.extreme}`);
    console.log(`   AI-C (LowMid): ${prediction.lowMid}`);
    console.log(`   AI-D (MidHigh): ${prediction.midHigh}`);
    console.log(`   ENSEMBLE: ${prediction.ensemble}`);
    
    const existing = await new Promise((resolve) => {
        db.get(`SELECT id FROM predictions WHERE result_id = ?`, [resultId], (err, row) => {
            resolve(row);
        });
    });
    
    if (existing) {
        return new Promise((resolve) => {
            db.run(`UPDATE predictions SET 
                    ai_stick_group = ?,
                    ai_extreme_group = ?,
                    ai_low_mid_group = ?,
                    ai_mid_high_group = ?,
                    ensemble_group = ?,
                    prediction_timestamp = ?
                    WHERE result_id = ?`,
                [prediction.stick, prediction.extreme, prediction.lowMid, prediction.midHigh, prediction.ensemble, new Date().toISOString(), resultId],
                (err) => {
                    if (err) console.error('Error updating prediction:', err);
                    else console.log(`✅ Prediction UPDATED for ${resultId}`);
                    resolve(prediction);
                }
            );
        });
    } else {
        return new Promise((resolve) => {
            db.run(`INSERT INTO predictions (
                    result_id,
                    ai_stick_group,
                    ai_extreme_group,
                    ai_low_mid_group,
                    ai_mid_high_group,
                    ensemble_group,
                    prediction_timestamp,
                    correct_stick,
                    correct_extreme,
                    correct_low_mid,
                    correct_mid_high,
                    correct_ensemble
                ) VALUES (?, ?, ?, ?, ?, ?, ?, -1, -1, -1, -1, -1)`,
                [resultId, prediction.stick, prediction.extreme, prediction.lowMid, prediction.midHigh, prediction.ensemble, new Date().toISOString()],
                (err) => {
                    if (err) console.error('Error saving prediction:', err);
                    else console.log(`✅ Prediction INSERTED for ${resultId} (pending result)`);
                    resolve(prediction);
                }
            );
        });
    }
}

async function updatePredictionWithResult(resultId, actualGroup) {
    console.log(`\n📊 UPDATING PREDICTION with result for ${resultId}:`);
    console.log(`   ACTUAL RESULT: ${actualGroup}`);
    
    const prediction = await new Promise((resolve) => {
        db.get(`SELECT ai_stick_group, ai_extreme_group, ai_low_mid_group, ai_mid_high_group, ensemble_group 
                FROM predictions WHERE result_id = ?`, [resultId], (err, row) => {
            resolve(row);
        });
    });
    
    if (!prediction) {
        console.log(`⚠️ No prediction found for ${resultId}, cannot update`);
        return null;
    }
    
    const correct = {
        stick: prediction.ai_stick_group === actualGroup ? 1 : 0,
        extreme: prediction.ai_extreme_group === actualGroup ? 1 : 0,
        low_mid: prediction.ai_low_mid_group === actualGroup ? 1 : 0,
        mid_high: prediction.ai_mid_high_group === actualGroup ? 1 : 0,
        ensemble: prediction.ensemble_group === actualGroup ? 1 : 0
    };
    
    console.log(`   CORRECTNESS:`);
    console.log(`   AI-A: ${prediction.ai_stick_group} → ${correct.stick ? '✓' : '✗'}`);
    console.log(`   AI-B: ${prediction.ai_extreme_group} → ${correct.extreme ? '✓' : '✗'}`);
    console.log(`   AI-C: ${prediction.ai_low_mid_group} → ${correct.low_mid ? '✓' : '✗'}`);
    console.log(`   AI-D: ${prediction.ai_mid_high_group} → ${correct.mid_high ? '✓' : '✗'}`);
    console.log(`   ENSEMBLE: ${prediction.ensemble_group} → ${correct.ensemble ? '✓' : '✗'}`);
    
    return new Promise((resolve) => {
        db.run(`UPDATE predictions SET
                actual_group = ?,
                actual_timestamp = ?,
                correct_stick = ?,
                correct_extreme = ?,
                correct_low_mid = ?,
                correct_mid_high = ?,
                correct_ensemble = ?
                WHERE result_id = ?`,
            [actualGroup, new Date().toISOString(), correct.stick, correct.extreme, correct.low_mid, correct.mid_high, correct.ensemble, resultId],
            async (err) => {
                if (err) {
                    console.error('Error updating prediction with result:', err);
                } else {
                    console.log(`✅ Prediction UPDATED with result for ${resultId}`);
                    await updateAIStatsTable('AI_Stick', correct.stick === 1);
                    await updateAIStatsTable('AI_ExtremeSwitch', correct.extreme === 1);
                    await updateAIStatsTable('AI_LowMidSwitch', correct.low_mid === 1);
                    await updateAIStatsTable('AI_MidHighSwitch', correct.mid_high === 1);
                    await updateAIStatsTable('EnsembleVoter', correct.ensemble === 1);
                }
                resolve({ prediction, correct });
            }
        );
    });
}

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

// ============ BROADCAST FUNCTIONS ============

async function broadcastFullDataOnNewResult(gameResult, predictionData) {
    const [results, predictions, stats, aiStats] = await Promise.all([
        getResultsData(100),
        getPredictionsData(500),
        getStatsData(),
        getAIStatsData()
    ]);
    
    const message = JSON.stringify({
        type: 'new_result',
        result: {
            id: gameResult.id,
            total: gameResult.total,
            group: gameResult.group_name,
            multiplier: gameResult.multiplier,
            diceValues: gameResult.dice_values,
            timestamp: gameResult.timestamp
        },
        prediction: predictionData,
        history: predictions,
        stats: stats,
        aiStats: aiStats
    });
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// ============ DATA COLLECTION ============

let lastGameId = null;
let isCollecting = false;
let pendingPredictions = new Set();

function getGroup(number) {
    if (number >= 3 && number <= 9) return 'LOW';
    if (number >= 10 && number <= 11) return 'MEDIUM';
    if (number >= 12 && number <= 18) return 'HIGH';
    return 'UNKNOWN';
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
                
                const exists = await new Promise((resolve) => {
                    db.get(`SELECT id FROM results WHERE id = ?`, [gameId], (err, row) => {
                        resolve(!!row);
                    });
                });
                
                if (!exists) {
                    console.log(`🆕 New game detected: ${gameId}`);
                    
                    // FIX 1: Get previous results BEFORE saving prediction
                    const previousResults = await getPreviousResultsForPrediction(5);
                    
                    let predictionData = null;
                    
                    // Save prediction FIRST (before result arrives)
                    if (previousResults.length >= 2 && !pendingPredictions.has(gameId)) {
                        pendingPredictions.add(gameId);
                        predictionData = await savePredictionOnly(gameId, previousResults);
                        broadcast({ type: 'prediction_pending', data: { result_id: gameId } });
                        console.log(`📝 Prediction saved for ${gameId}`);
                    }
                    
                    // THEN save the actual result
                    const savedResult = await saveGameResult(game);
                    console.log(`💾 Result saved for ${gameId}`);
                    
                    // THEN update prediction with actual result
                    const totalResult = game.result.total;
                    const group = getGroup(totalResult);
                    await updatePredictionWithResult(gameId, group);
                    console.log(`📊 Prediction updated with result: ${group}`);
                    
                    pendingPredictions.delete(gameId);
                    
                    // Update AI models with the actual result
                    const previousGroups = await getPreviousResultsForPrediction(3);
                    const currentGroup = previousGroups[0]?.group || group;
                    const previousGroup = previousGroups[1]?.group || currentGroup;
                    
                    serverAI.stick.updateWithResult(group, previousGroup);
                    serverAI.extreme.updateWithResult(group, previousGroup);
                    serverAI.lowMid.updateWithResult(group, previousGroup);
                    serverAI.midHigh.updateWithResult(group, previousGroup);
                    
                    await saveServerAIState('AI_Stick');
                    await saveServerAIState('AI_ExtremeSwitch');
                    await saveServerAIState('AI_LowMidSwitch');
                    await saveServerAIState('AI_MidHighSwitch');
                    
                    // Broadcast full data to all connected clients
                    const currentPrediction = await getCurrentPredictionData();
                    await broadcastFullDataOnNewResult(savedResult, currentPrediction);
                    
                    console.log(`✅ Complete flow done for game: ${gameId}`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Data collection error:', error.message);
    }
    
    isCollecting = false;
}

// ============ API ENDPOINTS ============

// NEW: Single endpoint for all data
app.get('/api/all-data', async (req, res) => {
    try {
        const [results, predictions, stats, aiStats, currentPrediction] = await Promise.all([
            getResultsData(100),
            getPredictionsData(500),
            getStatsData(),
            getAIStatsData(),
            getCurrentPredictionData()
        ]);
        
        res.json({
            success: true,
            results: results,
            predictions: predictions,
            stats: stats,
            aiStats: aiStats,
            currentPrediction: currentPrediction
        });
    } catch (error) {
        console.error('Error loading all data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/predictions', (req, res) => {
    const limit = parseInt(req.query.limit) || 500;
    
    db.all(`SELECT p.*, r.total, r.dice_values, r.timestamp as result_time
            FROM predictions p
            LEFT JOIN results r ON p.result_id = r.id
            ORDER BY p.prediction_timestamp DESC LIMIT ?`, [limit], (err, predictions) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const transformed = predictions.map(p => ({
            result_id: p.result_id,
            total: p.total || null,
            actual_group: p.actual_group || null,
            dice_values: p.dice_values || null,
            result_time: p.result_time || null,
            ai_stick_group: p.ai_stick_group,
            ai_extreme_group: p.ai_extreme_group,
            ai_low_mid_group: p.ai_low_mid_group,
            ai_mid_high_group: p.ai_mid_high_group,
            ensemble_group: p.ensemble_group,
            correct_stick: p.correct_stick,
            correct_extreme: p.correct_extreme,
            correct_low_mid: p.correct_low_mid,
            correct_mid_high: p.correct_mid_high,
            correct_ensemble: p.correct_ensemble,
            prediction_timestamp: p.prediction_timestamp,
            is_pending: p.actual_group === null
        }));
        
        res.json(transformed);
    });
});

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

app.get('/api/ai-stats', (req, res) => {
    db.all(`SELECT * FROM ai_stats`, (err, stats) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(stats);
    });
});

app.get('/api/current-prediction', async (req, res) => {
    const prediction = await getCurrentPredictionData();
    res.json({
        success: true,
        prediction: prediction
    });
});

app.get('/api/server-ai-stats', (req, res) => {
    res.json({
        stick: { accuracy: serverAI.stick.getAccuracy(), totalPredictions: serverAI.stick.totalPredictions },
        extreme: { accuracy: serverAI.extreme.getAccuracy(), totalPredictions: serverAI.extreme.totalPredictions },
        lowMid: { accuracy: serverAI.lowMid.getAccuracy(), totalPredictions: serverAI.lowMid.totalPredictions },
        midHigh: { accuracy: serverAI.midHigh.getAccuracy(), totalPredictions: serverAI.midHigh.totalPredictions },
        ensemble: { accuracy: serverAI.ensemble.getAccuracy(), totalPredictions: serverAI.ensemble.totalPredictions }
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        clients: clients.size,
        uptime: process.uptime()
    });
});

// Start background data collection
setInterval(collectData, 3000);
collectData();

console.log('📊 Background data collection started (every 3 seconds)');
console.log('🤖 Server-side AI prediction engine active');
console.log('🔌 WebSocket server ready for real-time updates');

// Graceful shutdown
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
