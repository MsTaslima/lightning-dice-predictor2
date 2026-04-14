/**
 * Lightning Dice Predictor - Four AI Pattern System
 * Main Controller - Four AI Models: Stick, Extreme Switch, Low-Mid Switch, Mid-High Switch
 * UPDATED: 20,000 records storage, full pagination, periodic retraining
 */

class LightningDiceApp {
    constructor() {
        this.apiBase = '/api';
        this.baseStats = null;
        this.allResults = [];
        this.lastGameId = null;
        this.autoRefreshInterval = null;
        this.timerInterval = null;
        this.refreshSeconds = 3;
        this.isInitialized = false;
        
        // History tracking - UPDATED: 20,000 max size
        this.predictionHistory = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.maxHistorySize = 20000;  // ✅ Changed from 1000 to 20000
        this.isLoadingHistory = false;
        
        // Retraining tracking - NEW
        this.recordsSinceLastRetrain = 0;
        this.retrainThreshold = 100;  // Retrain every 100 new records
        this.lastRetrainTime = null;
        this.retrainInterval = null;
        
        // Group definitions
        this.groups = {
            LOW: { name: 'LOW', range: '3-9', numbers: [3,4,5,6,7,8,9], icon: '🔴' },
            MEDIUM: { name: 'MEDIUM', range: '10-11', numbers: [10,11], icon: '🟡' },
            HIGH: { name: 'HIGH', range: '12-18', numbers: [12,13,14,15,16,17,18], icon: '🟢' }
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Four AI Pattern System...');
        console.log('📦 Max storage capacity: 20,000 records');
        
        this.loadHistoryFromLocalStorage();
        this.bindEvents();
        
        // Load ALL history data from API (all pages)
        await this.loadFullHistoryFromAPI();
        
        // Train AI models with complete data
        if (this.allResults.length >= 10) {
            await this.trainAllModels();
            this.lastRetrainTime = new Date();
        }
        
        await this.loadLatestData();
        
        this.isInitialized = true;
        this.updateUI();
        this.startAutoRefresh();
        this.startTimer();
        this.startPeriodicRetrain(); // ✅ NEW: Periodic retraining
        this.updateConnectionStatus(true);
        this.setupCollapsibleStats();
        this.updateDataSizeIndicator(); // ✅ NEW: Show data size
    }
    
    loadHistoryFromLocalStorage() {
        try {
            const saved = localStorage.getItem('prediction_history');
            if (saved) {
                this.predictionHistory = JSON.parse(saved);
                console.log(`✅ Loaded ${this.predictionHistory.length} history records from localStorage`);
                this.updateHistoryTable();
            } else {
                console.log('📭 No saved history found in localStorage');
            }
        } catch(e) {
            console.warn('Failed to load history from localStorage:', e);
            this.predictionHistory = [];
        }
    }
    
    saveHistoryToLocalStorage() {
        try {
            const toSave = this.predictionHistory.slice(0, this.maxHistorySize);
            localStorage.setItem('prediction_history', JSON.stringify(toSave));
            console.log(`✅ Saved ${toSave.length} history records to localStorage`);
        } catch(e) {
            console.warn('Failed to save history to localStorage:', e);
        }
    }
    
    // ✅ NEW: Show current data size in UI
    updateDataSizeIndicator() {
        const dataSizeElement = document.getElementById('dataSizeIndicator');
        if (dataSizeElement) {
            dataSizeElement.textContent = `${this.allResults.length} / ${this.maxHistorySize}`;
        }
        
        const lastTrainElement = document.getElementById('lastTrainTime');
        if (lastTrainElement && this.lastRetrainTime) {
            lastTrainElement.textContent = this.lastRetrainTime.toLocaleTimeString();
        }
    }
    
    setupCollapsibleStats() {
        const statsHeader = document.getElementById('statsHeader');
        const statsContent = document.getElementById('statsContent');
        const toggleIcon = document.getElementById('toggleIcon');
        
        if (statsHeader && statsContent && toggleIcon) {
            statsHeader.addEventListener('click', () => {
                const isVisible = statsContent.style.display !== 'none';
                statsContent.style.display = isVisible ? 'none' : 'block';
                toggleIcon.classList.toggle('open', !isVisible);
            });
        }
    }
    
    bindEvents() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.checkForNewData(true));
        }
        
        const autoRefreshToggle = document.getElementById('autoRefreshToggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.startAutoRefresh();
                    this.startTimer();
                } else {
                    this.stopAutoRefresh();
                    this.stopTimer();
                }
            });
        }
        
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        if (prevBtn) prevBtn.addEventListener('click', () => this.changePage(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.changePage(1));
    }
    
    changePage(delta) {
        const newPage = this.currentPage + delta;
        const totalPages = Math.ceil(this.predictionHistory.length / this.itemsPerPage);
        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.updateHistoryTable();
        }
    }
    
    // ✅ UPDATED: Load ALL pages from history API (up to 20,000 records)
    async loadFullHistoryFromAPI() {
        if (this.isLoadingHistory) return;
        this.isLoadingHistory = true;
        
        try {
            console.log('📜 Loading complete history from API (all pages)...');
            
            // First, check if we already have history in localStorage
            if (this.predictionHistory.length > 0 && this.predictionHistory.length >= 1000) {
                console.log(`📦 Using existing history from localStorage (${this.predictionHistory.length} records)`);
                await this.fetchNewRecordsFromAPI();
                this.isLoadingHistory = false;
                return;
            }
            
            // Fetch first page to get total count
            const firstResponse = await fetch(`${this.apiBase}/history?page=0&size=200`);
            const totalCount = parseInt(firstResponse.headers.get('X-Total-Count') || '0');
            const firstPageData = await firstResponse.json();
            
            let allApiResults = [...firstPageData];
            console.log(`📊 Total records available in 24h: ${totalCount}`);
            
            // Calculate how many pages we need (max 20,000 records or all available)
            const recordsNeeded = Math.min(totalCount, this.maxHistorySize);
            const pagesNeeded = Math.ceil(recordsNeeded / 200);
            
            console.log(`📚 Will fetch ${pagesNeeded} pages (${recordsNeeded} records max)`);
            
            // Fetch remaining pages
            for (let page = 1; page < pagesNeeded && page < 100; page++) {
                console.log(`📜 Fetching page ${page}...`);
                const response = await fetch(`${this.apiBase}/history?page=${page}&size=200`);
                const pageData = await response.json();
                allApiResults.push(...pageData);
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 150));
                
                // Stop if we've reached max capacity
                if (allApiResults.length >= this.maxHistorySize) {
                    console.log(`📦 Reached max capacity (${this.maxHistorySize}), stopping fetch`);
                    break;
                }
            }
            
            // Convert API results to game result format
            const gameResults = [];
            const seenIds = new Set();
            
            for (const item of allApiResults) {
                if (seenIds.has(item.id)) continue;
                seenIds.add(item.id);
                
                const gameResult = this.parseHistoryGameData(item);
                if (gameResult) {
                    gameResults.push(gameResult);
                }
            }
            
            // Sort by timestamp (newest first)
            gameResults.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            
            // Limit to maxHistorySize
            this.allResults = gameResults.slice(0, this.maxHistorySize);
            console.log(`✅ Loaded ${this.allResults.length} real history records from API`);
            
            // Update lastGameId
            if (this.allResults.length > 0) {
                this.lastGameId = this.allResults[0].id;
            }
            
            // Build prediction history from real data
            await this.buildPredictionHistoryFromRealData();
            
            this.updateDataSizeIndicator();
            
        } catch (error) {
            console.error('❌ Error loading real history:', error);
            console.log('⚠️ Using existing data from localStorage');
        } finally {
            this.isLoadingHistory = false;
        }
    }
    
    // ✅ UPDATED: Fetch only new records from API (for updates)
    async fetchNewRecordsFromAPI() {
        try {
            const response = await fetch(`${this.apiBase}/history?page=0&size=50`);
            const newRecords = await response.json();
            
            let newCount = 0;
            const existingIds = new Set(this.allResults.map(r => r.id));
            
            for (const item of newRecords) {
                if (!existingIds.has(item.id)) {
                    const gameResult = this.parseHistoryGameData(item);
                    if (gameResult) {
                        this.allResults.unshift(gameResult);
                        newCount++;
                    }
                }
            }
            
            // Limit to maxHistorySize
            if (this.allResults.length > this.maxHistorySize) {
                this.allResults = this.allResults.slice(0, this.maxHistorySize);
            }
            
            if (newCount > 0) {
                console.log(`🆕 Found ${newCount} new records from API`);
                await this.buildPredictionHistoryFromRealData();
                this.updateDataSizeIndicator();
            }
        } catch (error) {
            console.warn('Could not fetch new records:', error.message);
        }
    }
    
    parseHistoryGameData(item) {
        try {
            const total = item.data.result.total;
            const diceValues = item.data.result.value || '? ? ?';
            
            return {
                id: item.id,
                total: total,
                group: this.getGroup(total),
                multiplier: this.getMultiplierFromResult(item.data.result),
                timestamp: new Date(item.data.settledAt),
                winners: item.totalWinners || 0,
                payout: item.totalAmount || 0,
                diceValues: diceValues,
                isReal: true
            };
        } catch (e) {
            console.warn('Failed to parse history item:', e);
            return null;
        }
    }
    
    getMultiplierFromResult(result) {
        if (result.luckyNumbersList && result.luckyNumbersList.length > 0) {
            const totalKey = `LightningDice_Total${result.total}`;
            const match = result.luckyNumbersList.find(m => m.outcome === totalKey);
            if (match) return match.multiplier;
        }
        return 1;
    }
    
    // ✅ UPDATED: Build prediction history from real data
    async buildPredictionHistoryFromRealData() {
        console.log('🔨 Building prediction history from real data...');
        
        const orderedResults = [...this.allResults].reverse();
        this.predictionHistory = [];
        
        for (let i = 1; i < orderedResults.length && this.predictionHistory.length < this.maxHistorySize; i++) {
            const currentResult = orderedResults[i];
            const previousResult = orderedResults[i - 1];
            
            const lastResults = this.getLastNResultsFromHistory(orderedResults, i);
            const currentGroup = currentResult.group;
            const previousGroup = previousResult.group;
            
            const predStick = window.AI_Stick ? window.AI_Stick.predict(currentGroup, previousGroup) : null;
            const predExtreme = window.AI_ExtremeSwitch ? window.AI_ExtremeSwitch.predict(currentGroup, previousGroup) : null;
            const predLowMid = window.AI_LowMidSwitch ? window.AI_LowMidSwitch.predict(currentGroup, previousGroup) : null;
            const predMidHigh = window.AI_MidHighSwitch ? window.AI_MidHighSwitch.predict(currentGroup, previousGroup) : null;
            
            const predStickGroup = this.extractPredictionGroup(predStick);
            const predExtremeGroup = this.extractPredictionGroup(predExtreme);
            const predLowMidGroup = this.extractPredictionGroup(predLowMid);
            const predMidHighGroup = this.extractPredictionGroup(predMidHigh);
            
            this.addToHistoryWithoutSave(currentResult, predStickGroup, predExtremeGroup, predLowMidGroup, predMidHighGroup);
        }
        
        this.saveHistoryToLocalStorage();
        this.updateHistoryTable();
        console.log(`✅ Built ${this.predictionHistory.length} prediction history records`);
    }
    
    getLastNResultsFromHistory(history, currentIndex) {
        const start = Math.max(0, currentIndex - 4);
        const results = [];
        for (let i = start; i < currentIndex; i++) {
            results.push(history[i].group);
        }
        return results;
    }
    
    // ✅ UPDATED: Train all models with complete data
    async trainAllModels() {
        console.log(`🎓 Training all 4 AI models with ${this.allResults.length} records...`);
        
        const historyInOrder = this.getAllResultsInOrder();
        
        if (window.AI_Stick) {
            window.AI_Stick.train(historyInOrder);
        }
        
        if (window.AI_ExtremeSwitch) {
            window.AI_ExtremeSwitch.train(historyInOrder);
        }
        
        if (window.AI_LowMidSwitch) {
            window.AI_LowMidSwitch.train(historyInOrder);
        }
        
        if (window.AI_MidHighSwitch) {
            window.AI_MidHighSwitch.train(historyInOrder);
        }
        
        if (window.EnsembleVoterV4) {
            const accStick = window.AI_Stick?.getAccuracy() || 60;
            const accExtreme = window.AI_ExtremeSwitch?.getAccuracy() || 60;
            const accLowMid = window.AI_LowMidSwitch?.getAccuracy() || 60;
            const accMidHigh = window.AI_MidHighSwitch?.getAccuracy() || 60;
            window.EnsembleVoterV4.updateWeights(accStick, accExtreme, accLowMid, accMidHigh);
        }
        
        this.recordsSinceLastRetrain = 0;
        this.lastRetrainTime = new Date();
        this.updateDataSizeIndicator();
        
        console.log('✅ All 4 AI models trained!');
    }
    
    // ✅ NEW: Periodic full retraining
    startPeriodicRetrain() {
        // Retrain every 2 hours (7200000 ms)
        this.retrainInterval = setInterval(async () => {
            console.log('⏰ Periodic retrain triggered (2 hour interval)...');
            await this.fullRetrain();
        }, 2 * 60 * 60 * 1000);
    }
    
    // ✅ NEW: Full retrain with current data
    async fullRetrain() {
        console.log('🔄 Starting full retrain...');
        
        if (this.allResults.length > 0) {
            await this.trainAllModels();
            await this.buildPredictionHistoryFromRealData();
            this.updateUI();
            console.log('✅ Full retrain complete');
        }
    }
    
    // ✅ NEW: Check and retrain if threshold reached
    async checkAndRetrain() {
        this.recordsSinceLastRetrain++;
        
        if (this.recordsSinceLastRetrain >= this.retrainThreshold) {
            console.log(`📊 Retrain threshold reached (${this.recordsSinceLastRetrain} new records), retraining...`);
            await this.fullRetrain();
        }
    }
    
    getAllResultsInOrder() {
        return [...this.allResults].reverse();
    }
    
    getLastNResults(n) {
        const orderedResults = this.getAllResultsInOrder();
        return orderedResults.slice(-n).map(r => r.group);
    }
    
    parseGameData(data) {
        const total = data.data.result.total;
        const multipliers = data.data.result.luckyNumbersList || [];
        const multiplierItem = multipliers.find(m => m.outcome === `LightningDice_Total${total}`);
        const diceValues = data.data.result.value || '? ? ?';
        
        return {
            id: data.data.id,
            total: total,
            group: this.getGroup(total),
            multiplier: multiplierItem ? multiplierItem.multiplier : 1,
            timestamp: new Date(data.data.settledAt),
            winners: data.totalWinners || 0,
            payout: data.totalAmount || 0,
            diceValues: diceValues,
            isReal: true
        };
    }
    
    getGroup(number) {
        if (number >= 3 && number <= 9) return 'LOW';
        if (number >= 10 && number <= 11) return 'MEDIUM';
        if (number >= 12 && number <= 18) return 'HIGH';
        return 'UNKNOWN';
    }
    
    // ✅ UPDATED: Check for new data with retrain trigger
    async checkForNewData(manual = false) {
        if (!this.isInitialized) return;
        
        try {
            const response = await fetch(`${this.apiBase}/latest`);
            if (!response.ok) return;
            const data = await response.json();
            
            if (data && data.data && this.lastGameId !== data.data.id) {
                console.log('🆕 New result detected!');
                
                const gameResult = this.parseGameData(data);
                const lastResults = this.getLastNResults(4);
                const currentGroup = lastResults[lastResults.length - 1];
                const previousGroup = lastResults.length >= 2 ? lastResults[lastResults.length - 2] : currentGroup;
                
                const predStick = window.AI_Stick ? window.AI_Stick.predict(currentGroup, previousGroup) : null;
                const predExtreme = window.AI_ExtremeSwitch ? window.AI_ExtremeSwitch.predict(currentGroup, previousGroup) : null;
                const predLowMid = window.AI_LowMidSwitch ? window.AI_LowMidSwitch.predict(currentGroup, previousGroup) : null;
                const predMidHigh = window.AI_MidHighSwitch ? window.AI_MidHighSwitch.predict(currentGroup, previousGroup) : null;
                
                const ensemble = window.EnsembleVoterV4 ? window.EnsembleVoterV4.combine(predStick, predExtreme, predLowMid, predMidHigh, currentGroup, previousGroup) : null;
                
                const predStickGroup = this.extractPredictionGroup(predStick);
                const predExtremeGroup = this.extractPredictionGroup(predExtreme);
                const predLowMidGroup = this.extractPredictionGroup(predLowMid);
                const predMidHighGroup = this.extractPredictionGroup(predMidHigh);
                const ensembleGroup = ensemble?.final?.group || 'MEDIUM';
                
                this.addToHistory(gameResult, predStickGroup, predExtremeGroup, predLowMidGroup, predMidHighGroup, ensembleGroup);
                
                this.allResults.unshift(gameResult);
                this.lastGameId = gameResult.id;
                this.latestResult = gameResult;
                
                // Limit to maxHistorySize
                if (this.allResults.length > this.maxHistorySize) {
                    this.allResults.pop();
                }
                
                // Update AI models incrementally
                if (window.AI_Stick) window.AI_Stick.updateWithResult(gameResult, previousGroup);
                if (window.AI_ExtremeSwitch) window.AI_ExtremeSwitch.updateWithResult(gameResult, previousGroup);
                if (window.AI_LowMidSwitch) window.AI_LowMidSwitch.updateWithResult(gameResult, previousGroup);
                if (window.AI_MidHighSwitch) window.AI_MidHighSwitch.updateWithResult(gameResult, previousGroup);
                
                if (ensemble) {
                    const correct = ensemble.final.group === gameResult.group;
                    if (window.AI_Stick) window.AI_Stick.recordPredictionResult(predStickGroup === gameResult.group);
                    if (window.AI_ExtremeSwitch) window.AI_ExtremeSwitch.recordPredictionResult(predExtremeGroup === gameResult.group);
                    if (window.AI_LowMidSwitch) window.AI_LowMidSwitch.recordPredictionResult(predLowMidGroup === gameResult.group);
                    if (window.AI_MidHighSwitch) window.AI_MidHighSwitch.recordPredictionResult(predMidHighGroup === gameResult.group);
                    if (window.EnsembleVoterV4) window.EnsembleVoterV4.recordPredictionResult(correct);
                }
                
                this.updateUI();
                this.animateNewResult();
                this.updateConnectionStatus(true);
                this.updateDataSizeIndicator();
                
                // ✅ Check if we need to retrain
                await this.checkAndRetrain();
            }
        } catch (error) {
            console.error('Error checking for new data:', error);
        }
    }
    
    extractPredictionGroup(prediction) {
        if (!prediction) return 'MEDIUM';
        
        if (prediction.prediction === "STICK" && prediction.nextGroup) {
            return prediction.nextGroup;
        }
        if (prediction.prediction === "SWITCH" && prediction.nextGroup) {
            return prediction.nextGroup;
        }
        if (prediction.prediction === "CONTINUE" && prediction.pattern) {
            const parts = prediction.pattern.split("→");
            if (parts.length >= 2) {
                return parts[1].trim();
            }
        }
        if (prediction.prediction === "BREAK" && prediction.nextGroup) {
            return prediction.nextGroup;
        }
        
        return 'MEDIUM';
    }
    
    addToHistory(result, predStickGroup, predExtremeGroup, predLowMidGroup, predMidHighGroup, ensembleGroup) {
        const time = result.timestamp.toLocaleTimeString();
        
        const historyEntry = {
            id: `${result.id}_${Date.now()}`,
            time: time,
            dice: result.diceValues,
            total: result.total,
            actualGroup: result.group,
            predStick: predStickGroup,
            predExtreme: predExtremeGroup,
            predLowMid: predLowMidGroup,
            predMidHigh: predMidHighGroup,
            ensemble: ensembleGroup,
            correctStick: predStickGroup === result.group,
            correctExtreme: predExtremeGroup === result.group,
            correctLowMid: predLowMidGroup === result.group,
            correctMidHigh: predMidHighGroup === result.group,
            correctEnsemble: ensembleGroup === result.group,
            timestamp: result.timestamp,
            isReal: true
        };
        
        const exists = this.predictionHistory.some(h => h.id === historyEntry.id);
        if (!exists) {
            this.predictionHistory.unshift(historyEntry);
            
            if (this.predictionHistory.length > this.maxHistorySize) {
                this.predictionHistory.pop();
            }
            
            this.saveHistoryToLocalStorage();
            this.updateHistoryTable();
        }
    }
    
    addToHistoryWithoutSave(result, predStickGroup, predExtremeGroup, predLowMidGroup, predMidHighGroup) {
        const time = result.timestamp.toLocaleTimeString();
        
        const historyEntry = {
            id: `${result.id}_${Date.now()}`,
            time: time,
            dice: result.diceValues,
            total: result.total,
            actualGroup: result.group,
            predStick: predStickGroup,
            predExtreme: predExtremeGroup,
            predLowMid: predLowMidGroup,
            predMidHigh: predMidHighGroup,
            ensemble: 'MEDIUM',
            correctStick: predStickGroup === result.group,
            correctExtreme: predExtremeGroup === result.group,
            correctLowMid: predLowMidGroup === result.group,
            correctMidHigh: predMidHighGroup === result.group,
            correctEnsemble: false,
            timestamp: result.timestamp,
            isReal: true
        };
        
        const exists = this.predictionHistory.some(h => h.id === historyEntry.id);
        if (!exists) {
            this.predictionHistory.push(historyEntry);
        }
    }
    
    updateHistoryTable() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const pageItems = this.predictionHistory.slice(startIndex, startIndex + this.itemsPerPage);
        
        if (pageItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No history data yet...</td></tr>';
            this.updatePaginationControls();
            return;
        }
        
        tbody.innerHTML = pageItems.map(item => {
            const getIcon = (g) => {
                if (g === 'LOW') return '🔴';
                if (g === 'MEDIUM') return '🟡';
                if (g === 'HIGH') return '🟢';
                return '⚪';
            };
            
            const getBadgeClass = (correct) => correct ? 'correct' : 'incorrect';
            
            return `
                <tr>
                    <td>${item.time}</td>
                    <td class="dice-values">🎲 ${item.dice}</td>
                    <td><strong>${item.total}</strong> <small>(${item.actualGroup})</small></td>
                    <td><span class="prediction-badge ${getBadgeClass(item.correctStick)}">${getIcon(item.predStick)} ${item.predStick} ${item.correctStick ? '✓' : '✗'}</span></td>
                    <td><span class="prediction-badge ${getBadgeClass(item.correctExtreme)}">${getIcon(item.predExtreme)} ${item.predExtreme} ${item.correctExtreme ? '✓' : '✗'}</span></td>
                    <td><span class="prediction-badge ${getBadgeClass(item.correctLowMid)}">${getIcon(item.predLowMid)} ${item.predLowMid} ${item.correctLowMid ? '✓' : '✗'}</span></td>
                    <td><span class="prediction-badge ${getBadgeClass(item.correctMidHigh)}">${getIcon(item.predMidHigh)} ${item.predMidHigh} ${item.correctMidHigh ? '✓' : '✗'}</span></td>
                    <td><span class="prediction-badge ${getBadgeClass(item.correctEnsemble)}">${getIcon(item.ensemble)} ${item.ensemble} ${item.correctEnsemble ? '✓' : '✗'}</span></td>
                </tr>
            `;
        }).join('');
        
        this.updatePaginationControls();
    }
    
    updatePaginationControls() {
        const totalPages = Math.ceil(this.predictionHistory.length / this.itemsPerPage);
        const paginationInfo = document.getElementById('paginationInfo');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (paginationInfo) paginationInfo.textContent = `Page ${this.currentPage} of ${totalPages || 1}`;
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
    }
    
    updateUI() {
        this.updateStatsUI();
        this.updateStatisticsTable();
        this.updateGroupProbabilities();
        this.updateRecentResultsDisplay();
        this.updateAIPredictions();
    }
    
    updateAIPredictions() {
        const lastResults = this.getLastNResults(4);
        if (lastResults.length < 4) {
            console.log('⚠️ Not enough results for prediction:', lastResults.length);
            return;
        }
        
        const currentGroup = lastResults[lastResults.length - 1];
        const previousGroup = lastResults.length >= 2 ? lastResults[lastResults.length - 2] : currentGroup;
        
        const predStick = window.AI_Stick ? window.AI_Stick.predict(currentGroup, previousGroup) : null;
        const predExtreme = window.AI_ExtremeSwitch ? window.AI_ExtremeSwitch.predict(currentGroup, previousGroup) : null;
        const predLowMid = window.AI_LowMidSwitch ? window.AI_LowMidSwitch.predict(currentGroup, previousGroup) : null;
        const predMidHigh = window.AI_MidHighSwitch ? window.AI_MidHighSwitch.predict(currentGroup, previousGroup) : null;
        
        const ensemble = window.EnsembleVoterV4 ? window.EnsembleVoterV4.combine(predStick, predExtreme, predLowMid, predMidHigh, currentGroup, previousGroup) : null;
        
        if (predStick) {
            document.getElementById('aiStickInput').textContent = `${previousGroup} → ${currentGroup}`;
            const stickPredText = predStick.prediction === "STICK" ? 
                `${predStick.nextGroup} (Stick)` : `Switch to ${predStick.nextGroup}`;
            document.getElementById('aiStickPred').innerHTML = `${this.getGroupIcon(predStick.nextGroup)} ${stickPredText}`;
            document.getElementById('aiStickConf').textContent = `${predStick.confidence}%`;
            document.getElementById('aiStickAcc').textContent = `${predStick.accuracy.toFixed(1)}%`;
        }
        
        if (predExtreme) {
            document.getElementById('aiExtremeInput').textContent = predExtreme.pattern || `${previousGroup} → ${currentGroup}`;
            let extremePredText = '';
            let extremeIcon = '';
            if (predExtreme.prediction === "CONTINUE" && predExtreme.pattern) {
                const targetGroup = predExtreme.pattern.split("→")[1]?.trim() || 'MEDIUM';
                extremePredText = `Continue ${targetGroup}`;
                extremeIcon = this.getGroupIcon(targetGroup);
            } else if (predExtreme.prediction === "BREAK") {
                extremePredText = `Break to ${predExtreme.nextGroup}`;
                extremeIcon = this.getGroupIcon(predExtreme.nextGroup);
            } else {
                extremePredText = predExtreme.nextGroup || 'MEDIUM';
                extremeIcon = this.getGroupIcon(extremePredText);
            }
            document.getElementById('aiExtremePred').innerHTML = `${extremeIcon} ${extremePredText}`;
            document.getElementById('aiExtremeConf').textContent = `${predExtreme.confidence}%`;
            document.getElementById('aiExtremeAcc').textContent = `${predExtreme.accuracy.toFixed(1)}%`;
        }
        
        if (predLowMid) {
            document.getElementById('aiLowMidInput').textContent = predLowMid.pattern || `${previousGroup} → ${currentGroup}`;
            let lowMidPredText = '';
            let lowMidIcon = '';
            if (predLowMid.prediction === "CONTINUE" && predLowMid.pattern) {
                const targetGroup = predLowMid.pattern.split("→")[1]?.trim() || 'MEDIUM';
                lowMidPredText = `Continue ${targetGroup}`;
                lowMidIcon = this.getGroupIcon(targetGroup);
            } else if (predLowMid.prediction === "BREAK") {
                lowMidPredText = `Break to ${predLowMid.nextGroup}`;
                lowMidIcon = this.getGroupIcon(predLowMid.nextGroup);
            } else {
                lowMidPredText = predLowMid.nextGroup || 'MEDIUM';
                lowMidIcon = this.getGroupIcon(lowMidPredText);
            }
            document.getElementById('aiLowMidPred').innerHTML = `${lowMidIcon} ${lowMidPredText}`;
            document.getElementById('aiLowMidConf').textContent = `${predLowMid.confidence}%`;
            document.getElementById('aiLowMidAcc').textContent = `${predLowMid.accuracy.toFixed(1)}%`;
        }
        
        if (predMidHigh) {
            document.getElementById('aiMidHighInput').textContent = predMidHigh.pattern || `${previousGroup} → ${currentGroup}`;
            let midHighPredText = '';
            let midHighIcon = '';
            if (predMidHigh.prediction === "CONTINUE" && predMidHigh.pattern) {
                const targetGroup = predMidHigh.pattern.split("→")[1]?.trim() || 'HIGH';
                midHighPredText = `Continue ${targetGroup}`;
                midHighIcon = this.getGroupIcon(targetGroup);
            } else if (predMidHigh.prediction === "BREAK") {
                midHighPredText = `Break to ${predMidHigh.nextGroup}`;
                midHighIcon = this.getGroupIcon(predMidHigh.nextGroup);
            } else {
                midHighPredText = predMidHigh.nextGroup || 'HIGH';
                midHighIcon = this.getGroupIcon(midHighPredText);
            }
            document.getElementById('aiMidHighPred').innerHTML = `${midHighIcon} ${midHighPredText}`;
            document.getElementById('aiMidHighConf').textContent = `${predMidHigh.confidence}%`;
            document.getElementById('aiMidHighAcc').textContent = `${predMidHigh.accuracy.toFixed(1)}%`;
        }
        
        if (ensemble) {
            const agreement = ensemble.final.agreement;
            document.getElementById('voteCount').textContent = `(${agreement}/4 AI agree)`;
            document.getElementById('finalIcon').textContent = this.getGroupIcon(ensemble.final.group);
            document.getElementById('finalName').textContent = ensemble.final.group;
            document.getElementById('finalRange').textContent = `(${this.getGroupRange(ensemble.final.group)})`;
            document.getElementById('confidenceFill').style.width = `${ensemble.final.confidence}%`;
            document.getElementById('finalConfidence').textContent = `${ensemble.final.confidence}%`;
            document.getElementById('finalExplanation').textContent = ensemble.explanation;
            
            const weights = ensemble.weights;
            document.getElementById('finalWeights').innerHTML = `Weights: Stick ${(weights.stick*100).toFixed(0)}% | Extreme ${(weights.extremeSwitch*100).toFixed(0)}% | Low-Mid ${(weights.lowMidSwitch*100).toFixed(0)}% | Mid-High ${(weights.midHighSwitch*100).toFixed(0)}%`;
        }
    }
    
    getGroupIcon(group) {
        if (group === 'LOW') return '🔴';
        if (group === 'MEDIUM') return '🟡';
        if (group === 'HIGH') return '🟢';
        return '⚪';
    }
    
    getGroupRange(group) {
        if (group === 'LOW') return '3-9';
        if (group === 'MEDIUM') return '10-11';
        if (group === 'HIGH') return '12-18';
        return '-';
    }
    
    updateStatsUI() {
        // Stats UI updated without /stats API
        const totalCount = this.allResults.length;
        document.getElementById('totalRounds').textContent = totalCount.toLocaleString();
        
        // Calculate average from actual results
        let totalSum = 0;
        this.allResults.forEach(result => {
            totalSum += result.total;
        });
        const avgResult = totalCount > 0 ? (totalSum / totalCount).toFixed(2) : 0;
        document.getElementById('avgResult').textContent = avgResult;
        
        // Calculate group distribution
        const groupCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        this.allResults.forEach(result => {
            if (result.group !== 'UNKNOWN') groupCounts[result.group]++;
        });
        
        let mostActive = 'LOW', maxCount = groupCounts.LOW;
        if (groupCounts.MEDIUM > maxCount) { mostActive = 'MEDIUM'; maxCount = groupCounts.MEDIUM; }
        if (groupCounts.HIGH > maxCount) { mostActive = 'HIGH'; }
        document.getElementById('mostActiveGroup').textContent = mostActive;
        
        document.getElementById('lightningBoost').textContent = 'N/A';
    }
    
    updateStatisticsTable() {
        const tbody = document.getElementById('statsTableBody');
        
        if (!tbody) return;
        
        // Calculate frequency from allResults
        const frequencyMap = {};
        const lastSeenMap = {};
        
        this.allResults.forEach(result => {
            const num = result.total;
            frequencyMap[num] = (frequencyMap[num] || 0) + 1;
            if (!lastSeenMap[num]) {
                lastSeenMap[num] = result.timestamp;
            }
        });
        
        const numbers = [];
        for (let i = 3; i <= 18; i++) {
            numbers.push({
                wheelResult: i,
                count: frequencyMap[i] || 0,
                lastOccurredAt: lastSeenMap[i] || null
            });
        }
        
        if (numbers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No data available</td></tr>';
            return;
        }
        
        tbody.innerHTML = numbers.map(item => {
            const group = this.getGroup(item.wheelResult);
            const groupClass = `group-${group.toLowerCase()}`;
            const lastTime = item.lastOccurredAt ? new Date(item.lastOccurredAt) : null;
            const timeAgo = lastTime ? this.getTimeAgo(lastTime) : 'Never';
            
            return `
                <tr>
                    <td><strong>${item.wheelResult}</strong></td>
                    <td><span class="group-badge ${groupClass}">${group}</span></td>
                    <td>${item.count}</td>
                    <td>${item.count > 0 ? Math.round((item.count / this.allResults.length) * 100) : 0}%</td>
                    <td>${timeAgo}</td>
                </tr>
            `;
        }).join('');
    }
    
    getTimeAgo(date) {
        const diffMins = Math.floor((new Date() - date) / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return `${Math.floor(diffMins / 1440)}d ago`;
    }
    
    updateGroupProbabilities() {
        if (!this.allResults.length) return;
        
        const recentResults = this.allResults.slice(0, 10);
        const recentCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        recentResults.forEach(r => { if (r && r.group) recentCount[r.group]++; });
        
        const total = recentResults.length;
        document.getElementById('lowProb').textContent = `${Math.round((recentCount.LOW / total) * 100)}%`;
        document.getElementById('mediumProb').textContent = `${Math.round((recentCount.MEDIUM / total) * 100)}%`;
        document.getElementById('highProb').textContent = `${Math.round((recentCount.HIGH / total) * 100)}%`;
        
        document.getElementById('lowTrend').textContent = this.getTrendText(recentCount.LOW, total);
        document.getElementById('mediumTrend').textContent = this.getTrendText(recentCount.MEDIUM, total);
        document.getElementById('highTrend').textContent = this.getTrendText(recentCount.HIGH, total);
    }
    
    getTrendText(count, total) {
        const percentage = (count / total) * 100;
        if (percentage > 40) return '🔥 Hot streak';
        if (percentage > 20) return '📈 Warming up';
        if (percentage > 10) return '⚖️ Average';
        return '❄️ Cooling down';
    }
    
    updateRecentResultsDisplay() {
        const resultsGrid = document.getElementById('resultsGrid');
        if (!resultsGrid) return;
        
        if (this.allResults.length === 0) {
            resultsGrid.innerHTML = '<div class="loading">No results yet</div>';
            return;
        }
        
        const recentResults = this.allResults.slice(0, 10);
        resultsGrid.innerHTML = recentResults.map(result => {
            const isLightning = result.multiplier > 10;
            const time = result.timestamp.toLocaleTimeString();
            const groupIcon = this.groups[result.group]?.icon || '🎲';
            
            return `
                <div class="result-card ${isLightning ? 'lightning' : ''}">
                    <div class="result-number">${groupIcon} ${result.total}</div>
                    <div class="result-multiplier">${result.multiplier}x</div>
                    <div class="result-time">${time}</div>
                    <div class="result-dice">${result.diceValues}</div>
                </div>
            `;
        }).join('');
        
        if (this.latestResult) {
            resultsGrid.innerHTML += `
                <div class="winners-info">
                    🏆 Winners: ${this.latestResult.winners} | 💰 Total Payout: $${this.latestResult.payout.toLocaleString()}
                </div>
            `;
        }
    }
    
    updateConnectionStatus(isConnected) {
        const statusText = document.getElementById('statusText');
        const statusDot = document.querySelector('.status-dot');
        if (statusText) statusText.textContent = isConnected ? 'Connected' : 'Disconnected';
        if (statusDot) statusDot.style.background = isConnected ? '#4ade80' : '#ef4444';
    }
    
    animateNewResult() {
        const predictionBox = document.querySelector('.prediction-section');
        if (predictionBox) {
            predictionBox.style.animation = 'none';
            setTimeout(() => predictionBox.style.animation = 'slideIn 0.3s ease', 10);
        }
    }
    
    startAutoRefresh() {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = setInterval(() => this.checkForNewData(), this.refreshSeconds * 1000);
    }
    
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }
    
    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        let seconds = this.refreshSeconds;
        const timerElement = document.getElementById('refreshTimer');
        
        this.timerInterval = setInterval(() => {
            seconds--;
            if (seconds < 0) seconds = this.refreshSeconds;
            if (timerElement) timerElement.textContent = `${seconds}s`;
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.textContent = `⚠️ ${message}`;
            errorDiv.style.display = 'block';
            setTimeout(() => errorDiv.style.display = 'none', 5000);
        }
    }
    
    async loadLatestData() {
        try {
            const response = await fetch(`${this.apiBase}/latest`);
            if (!response.ok) throw new Error('Failed to load latest');
            const data = await response.json();
            
            if (data && data.data) {
                const gameResult = this.parseGameData(data);
                const existingIndex = this.allResults.findIndex(r => r.id === gameResult.id);
                if (existingIndex === -1) {
                    this.allResults.unshift(gameResult);
                    this.lastGameId = gameResult.id;
                    this.latestResult = gameResult;
                    console.log('✅ Latest data loaded');
                }
            }
        } catch (error) {
            console.error('❌ Error loading latest:', error);
        }
    }
}

// Initialize app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new LightningDiceApp();
    });
} else {
    window.app = new LightningDiceApp();
}
