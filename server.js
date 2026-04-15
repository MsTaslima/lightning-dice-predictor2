const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== GLOBAL SERVER STORAGE ==========
// সব ডিভাইস থেকে একই ডাটা দেখানোর জন্য সার্ভারে স্টোর করছি

// AI Training Data Storage (20,000 records)
let serverAITrainingData = [];
let serverPredictionHistory = [];

// AI Models Data Storage
let serverAIModelsData = {
    stick: null,
    extremeSwitch: null,
    lowMidSwitch: null,
    midHighSwitch: null,
    ensembleWeights: null
};

// File paths for persistence
const DATA_DIR = path.join(__dirname, 'data');
const AI_TRAINING_FILE = path.join(DATA_DIR, 'ai_training.json');
const PREDICTION_HISTORY_FILE = path.join(DATA_DIR, 'prediction_history.json');
const AI_MODELS_FILE = path.join(DATA_DIR, 'ai_models.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('📁 Created data directory:', DATA_DIR);
}

// Load data from files on startup
function loadDataFromFiles() {
    try {
        if (fs.existsSync(AI_TRAINING_FILE)) {
            serverAITrainingData = JSON.parse(fs.readFileSync(AI_TRAINING_FILE, 'utf8'));
            console.log(`✅ Loaded ${serverAITrainingData.length} AI training records from file`);
        }
        if (fs.existsSync(PREDICTION_HISTORY_FILE)) {
            serverPredictionHistory = JSON.parse(fs.readFileSync(PREDICTION_HISTORY_FILE, 'utf8'));
            console.log(`✅ Loaded ${serverPredictionHistory.length} prediction history records from file`);
        }
        if (fs.existsSync(AI_MODELS_FILE)) {
            serverAIModelsData = JSON.parse(fs.readFileSync(AI_MODELS_FILE, 'utf8'));
            console.log(`✅ Loaded AI models data from file`);
        }
    } catch (e) {
        console.error('Error loading data from files:', e);
    }
}

// Save data to files
function saveAITrainingDataToFile() {
    try {
        fs.writeFileSync(AI_TRAINING_FILE, JSON.stringify(serverAITrainingData.slice(0, 20000)));
        console.log(`💾 Saved ${serverAITrainingData.length} AI training records to file`);
    } catch (e) {
        console.error('Error saving AI training data:', e);
    }
}

function savePredictionHistoryToFile() {
    try {
        fs.writeFileSync(PREDICTION_HISTORY_FILE, JSON.stringify(serverPredictionHistory.slice(0, 1000)));
        console.log(`💾 Saved ${serverPredictionHistory.length} prediction history records to file`);
    } catch (e) {
        console.error('Error saving prediction history:', e);
    }
}

function saveAIModelsDataToFile() {
    try {
        fs.writeFileSync(AI_MODELS_FILE, JSON.stringify(serverAIModelsData));
        console.log(`💾 Saved AI models data to file`);
    } catch (e) {
        console.error('Error saving AI models data:', e);
    }
}

// Load existing data on startup
loadDataFromFiles();

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to get headers for casino.org API
const getApiHeaders = () => {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site'
    };
};

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ========== SERVER STORAGE API ENDPOINTS ==========

// Save AI Training Data to Server
app.post('/api/server/save-training', asyncHandler(async (req, res) => {
    const { data, maxSize } = req.body;
    if (data && Array.isArray(data)) {
        serverAITrainingData = data.slice(0, maxSize || 20000);
        saveAITrainingDataToFile();
        res.json({ success: true, count: serverAITrainingData.length });
    } else {
        res.json({ success: false, error: 'Invalid data' });
    }
}));

// Get AI Training Data from Server
app.get('/api/server/get-training', asyncHandler(async (req, res) => {
    res.json({ success: true, data: serverAITrainingData, count: serverAITrainingData.length });
}));

// Save Prediction History to Server
app.post('/api/server/save-history', asyncHandler(async (req, res) => {
    const { data, maxSize } = req.body;
    if (data && Array.isArray(data)) {
        serverPredictionHistory = data.slice(0, maxSize || 1000);
        savePredictionHistoryToFile();
        res.json({ success: true, count: serverPredictionHistory.length });
    } else {
        res.json({ success: false, error: 'Invalid data' });
    }
}));

// Get Prediction History from Server
app.get('/api/server/get-history', asyncHandler(async (req, res) => {
    res.json({ success: true, data: serverPredictionHistory, count: serverPredictionHistory.length });
}));

// Save AI Models Data
app.post('/api/server/save-models', asyncHandler(async (req, res) => {
    const { stick, extremeSwitch, lowMidSwitch, midHighSwitch, ensembleWeights } = req.body;
    if (stick) serverAIModelsData.stick = stick;
    if (extremeSwitch) serverAIModelsData.extremeSwitch = extremeSwitch;
    if (lowMidSwitch) serverAIModelsData.lowMidSwitch = lowMidSwitch;
    if (midHighSwitch) serverAIModelsData.midHighSwitch = midHighSwitch;
    if (ensembleWeights) serverAIModelsData.ensembleWeights = ensembleWeights;
    saveAIModelsDataToFile();
    res.json({ success: true });
}));

// Get AI Models Data
app.get('/api/server/get-models', asyncHandler(async (req, res) => {
    res.json({ success: true, data: serverAIModelsData });
}));

// Clear Prediction History (Server side)
app.delete('/api/server/clear-history', asyncHandler(async (req, res) => {
    serverPredictionHistory = [];
    savePredictionHistoryToFile();
    res.json({ success: true, message: 'History cleared on server' });
}));

// Get server stats
app.get('/api/server/stats', asyncHandler(async (req, res) => {
    res.json({
        success: true,
        trainingCount: serverAITrainingData.length,
        historyCount: serverPredictionHistory.length,
        maxTraining: 20000,
        maxHistory: 1000
    });
}));

// ========== ORIGINAL API ENDPOINTS ==========

// Latest result API
app.get('/api/latest', asyncHandler(async (req, res) => {
    try {
        const response = await axios.get('https://api-cs.casino.org/svc-evolution-game-events/api/lightningdice/latest', {
            headers: getApiHeaders(),
            timeout: 10000
        });
        res.json(response.data);
    } catch (error) {
        console.error('❌ Error fetching latest:', error.message);
        res.status(500).json({ error: 'Failed to fetch latest results' });
    }
}));

// Full History API with pagination
app.get('/api/history', asyncHandler(async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 0;
        const size = Math.min(parseInt(req.query.size) || 200, 200);
        const duration = req.query.duration || 24;
        
        console.log(`📜 Fetching history page ${page} with size ${size}...`);
        
        const response = await axios.get(
            'https://api-cs.casino.org/svc-evolution-game-events/api/lightningdice',
            {
                params: {
                    page: page,
                    size: size,
                    sort: 'data.settledAt,desc',
                    duration: duration,
                    totals: '3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18'
                },
                headers: getApiHeaders(),
                timeout: 15000
            }
        );
        
        const totalCount = response.headers['x-total-count'];
        if (totalCount) {
            res.set('X-Total-Count', totalCount);
        }
        
        console.log(`✅ Fetched ${response.data.length} records. Total available: ${totalCount || 'unknown'}`);
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Error fetching history:', error.message);
        res.status(500).json({ error: 'Failed to fetch history', message: error.message });
    }
}));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'production',
        serverStorage: {
            trainingRecords: serverAITrainingData.length,
            historyRecords: serverPredictionHistory.length
        }
    });
});

// Test endpoint
app.get('/api/test', asyncHandler(async (req, res) => {
    try {
        const response = await axios.get('https://api-cs.casino.org/svc-evolution-game-events/api/lightningdice/latest', {
            headers: getApiHeaders(),
            timeout: 10000
        });
        res.json({ success: true, message: 'API is accessible', data: response.data });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}));

// Keep-alive function
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000;

setInterval(async () => {
    try {
        const protocol = process.env.RAILWAY ? 'https' : 'http';
        const host = process.env.RAILWAY_PUBLIC_DOMAIN || `localhost:${PORT}`;
        const url = `${protocol}://${host}/api/health`;
        
        if (process.env.RAILWAY_PUBLIC_DOMAIN) {
            const response = await axios.get(url, { timeout: 5000 });
            console.log(`🔄 Keep-alive ping sent at ${new Date().toISOString()} - Status: ${response.status}`);
        }
    } catch (error) {
        console.log(`⚠️ Keep-alive ping failed: ${error.message}`);
    }
}, KEEP_ALIVE_INTERVAL);

console.log('⏰ Keep-alive service started - pinging every 5 minutes');

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.message);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n⚡ Lightning Dice Predictor - Four AI Pattern System (SERVER STORAGE MODE)`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`💾 Server Storage: ${serverAITrainingData.length} training records, ${serverPredictionHistory.length} history records`);
    console.log(`📁 Public folder: ${path.join(__dirname, 'public')}`);
    console.log(`📁 Data folder: ${DATA_DIR}`);
    console.log(`🔄 Latest API: http://localhost:${PORT}/api/latest`);
    console.log(`📜 History API: http://localhost:${PORT}/api/history`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🚀 Server running on port ${PORT}\n`);
});
