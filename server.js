const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('public'));

let statsCache = null;
let statsCacheTime = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

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

// Stats API with cache
app.get('/api/stats', asyncHandler(async (req, res) => {
    // Check cache first
    if (statsCache && statsCacheTime && (Date.now() - statsCacheTime < CACHE_DURATION)) {
        console.log('📊 Serving stats from cache');
        return res.json(statsCache);
    }

    console.log('🔄 Fetching fresh stats data...');
    
    try {
        const response = await axios.get('https://api-cs.casino.org/svc-evolution-game-events/api/lightningdice/stats', {
            params: {
                duration: req.query.duration || 24,
                sortField: req.query.sortField || 'hotFrequency'
            },
            headers: getApiHeaders(),
            timeout: 15000,
            // Add retry mechanism
            validateStatus: function (status) {
                return status >= 200 && status < 500;
            }
        });
        
        if (response.data && response.data.totalStats) {
            statsCache = response.data;
            statsCacheTime = Date.now();
            console.log('✅ Stats data cached for 24 hours');
            res.json(response.data);
        } else {
            console.error('❌ Invalid response from API');
            res.status(500).json({ error: 'Invalid API response', data: response.data });
        }
    } catch (error) {
        console.error('❌ Error fetching stats:', error.message);
        // Return cached data if available, even if expired
        if (statsCache) {
            console.log('⚠️ Returning expired cache due to API error');
            return res.json({ ...statsCache, fromCache: true, cacheExpired: true });
        }
        res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
    }
}));

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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        cacheActive: statsCache ? true : false,
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'production'
    });
});

// Test endpoint to check if API is accessible
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
    console.log(`\n⚡ Lightning Dice Predictor - Three AI Pattern System`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📊 Stats API: http://localhost:${PORT}/api/stats`);
    console.log(`🔄 Latest API: http://localhost:${PORT}/api/latest`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🔧 Test API: http://localhost:${PORT}/api/test`);
    console.log(`🚀 Server running on port ${PORT}\n`);
});
