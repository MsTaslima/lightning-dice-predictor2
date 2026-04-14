/**
 * Lightning Dice Predictor - Four AI Pattern System
 * Main Controller - Four AI Models
 * UPDATED: 20,000 AI training storage + 1,000 display history + Clear button
 */

class LightningDiceApp {
    constructor() {
        this.apiBase = '/api';
        this.baseStats = null;
        
        // 🤖 AI TRAINING STORAGE (Background - 20,000 records)
        this.aiTrainingData = [];        // AI ট্রেনিং এর জন্য (20,000 capacity)
        this.aiTrainingSize = 20000;     // ২০,০০০ রেকর্ড স্টোর করবে (ব্যাকগ্রাউন্ড)
        
        // 📊 UI DISPLAY HISTORY (User sees - 1,000 records only)
        this.predictionHistory = [];      // ইউজার দেখে (1,000 capacity)
        this.displayHistorySize = 1000;   // শুধু লাস্ট ১০০০ দেখাবে
        
        // Other variables
        this.lastGameId = null;
        this.autoRefreshInterval = null;
        this.timerInterval = null;
        this.refreshSeconds = 3;
        this.isInitialized = false;
        
        // Retraining tracking
        this.recordsSinceLastRetrain = 0;
        this.retrainThreshold = 100;      // প্রতি ১০০ নতুন রেকর্ডে রি-ট্রেন
        this.lastRetrainTime = null;
        this.retrainInterval = null;
        
        // Pagination for display
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.isLoadingHistory = false;
        
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
        console.log(`🤖 AI Training Storage: ${this.aiTrainingSize} records (background)`);
        console.log(`📊 Display History: ${this.displayHistorySize} records (UI)`);
        
        this.loadDisplayHistoryFromLocalStorage();
        this.loadAITrainingDataFromLocalStorage();
        this.bindEvents();
        
        // Load ALL history data from API
        await this.loadFullHistoryFromAPI();
        
        // Train AI models with complete data
        if (this.aiTrainingData.length >= 10) {
            await this.trainAllModels();
            this.lastRetrainTime = new Date();
        }
        
        await this.loadLatestData();
        
        this.isInitialized = true;
        this.updateUI();
        this.startAutoRefresh();
        this.startTimer();
        this.startPeriodicRetrain();
        this.updateConnectionStatus(true);
        this.setupCollapsibleStats();
        this.updateDataSizeIndicator();
    }
    
    // ✅ Load ONLY display history (1,000 records) from localStorage
    loadDisplayHistoryFromLocalStorage() {
        try {
            const saved = localStorage.getItem('prediction_history_display');
            if (saved) {
                this.predictionHistory = JSON.parse(saved);
                // Ensure not exceed display limit
                if (this.predictionHistory.length > this.displayHistorySize) {
                    this.predictionHistory = this.predictionHistory.slice(0, this.displayHistorySize);
                    this.saveDisplayHistoryToLocalStorage();
                }
                console.log(`✅ Loaded ${this.predictionHistory.length} display records from localStorage`);
                this.updateHistoryTable();
            }
        } catch(e) {
            console.warn('Failed to load display history:', e);
            this.predictionHistory = [];
        }
    }
    
    // ✅ Load AI training data (20,000 records) from localStorage
    loadAITrainingDataFromLocalStorage() {
        try {
            const saved = localStorage.getItem('ai_training_data');
            if (saved) {
                this.aiTrainingData = JSON.parse(saved);
                if (this.aiTrainingData.length > this.aiTrainingSize) {
                    this.aiTrainingData = this.aiTrainingData.slice(0, this.aiTrainingSize);
                    this.saveAITrainingDataToLocalStorage();
                }
                console.log(`✅ Loaded ${this.aiTrainingData.length} AI training records from localStorage`);
            }
        } catch(e) {
            console.warn('Failed to load AI training data:', e);
            this.aiTrainingData = [];
        }
    }
    
    // ✅ Save ONLY display history
    saveDisplayHistoryToLocalStorage() {
        try {
            const toSave = this.predictionHistory.slice(0, this.displayHistorySize);
            localStorage.setItem('prediction_history_display', JSON.stringify(toSave));
            console.log(`✅ Saved ${toSave.length} display records to localStorage`);
        } catch(e) {
            console.warn('Failed to save display history:', e);
        }
    }
    
    // ✅ Save AI training data (20,000 records)
    saveAITrainingDataToLocalStorage() {
        try {
            const toSave = this.aiTrainingData.slice(0, this.aiTrainingSize);
            localStorage.setItem('ai_training_data', JSON.stringify(toSave));
            console.log(`✅ Saved ${toSave.length} AI training records to localStorage`);
        } catch(e) {
            console.warn('Failed to save AI training data:', e);
        }
    }
    
    // ✅ CLEAR BUTTON FUNCTION - clears display history only
    clearDisplayHistory() {
        if (confirm('Are you sure you want to clear ALL prediction history? This will only clear the display (UI) history. AI training data will remain intact.')) {
            this.predictionHistory = [];
            this.saveDisplayHistoryToLocalStorage();
            this.currentPage = 1;
            this.updateHistoryTable();
            this.updatePaginationControls();
            console.log('🗑️ Display history cleared!');
            
            // Show temporary message
            const clearBtn = document.getElementById('clearHistoryBtn');
            if (clearBtn) {
                const originalText = clearBtn.innerHTML;
                clearBtn.innerHTML = '✓ Cleared!';
                setTimeout(() => {
                    clearBtn.innerHTML = originalText;
                }, 2000);
            }
        }
    }
    
    // ✅ Clear ALL data (AI training + display) - for debugging
    clearAllData() {
        if (confirm('⚠️ WARNING: This will clear ALL data including AI training. Are you sure?')) {
            this.predictionHistory = [];
            this.aiTrainingData = [];
            localStorage.removeItem('prediction_history_display');
            localStorage.removeItem('ai_training_data');
            localStorage.removeItem('ai_stick_data');
            localStorage.removeItem('ai_extreme_switch_data');
            localStorage.removeItem('ai_low_mid_switch_data');
            localStorage.removeItem('ai_mid_high_switch_data');
            localStorage.removeItem('ensemble_v4_weights');
            console.log('🗑️ ALL data cleared!');
            location.reload();
        }
    }
    
    updateDataSizeIndicator() {
        const dataSizeElement = document.getElementById('dataSizeIndicator');
        if (dataSizeElement) {
            dataSizeElement.textContent = `${this.aiTrainingData.length} / ${this.aiTrainingSize}`;
        }
        
        const displaySizeElement = document.getElementById('displaySizeIndicator');
        if (displaySizeElement) {
            displaySizeElement.textContent = `${this.predictionHistory.length} / ${this.displayHistorySize}`;
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
        
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => this.clearDisplayHistory());
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
    
    // ✅ Load ALL pages from history API (for AI training)
    async loadFullHistoryFromAPI() {
        if (this.isLoadingHistory) return;
        this.isLoadingHistory = true;
        
        try {
            console.log('📜 Loading complete history from API for AI training...');
            
            // Fetch first page to get total count
            const firstResponse = await fetch(`${this.apiBase}/history?page=0&size=200`);
            const totalCount = parseInt(firstResponse.headers.get('X-Total-Count') || '0');
            const firstPageData = await firstResponse.json();
            
            let allApiResults = [...firstPageData];
            console.log(`📊 Total records available in 24h: ${totalCount}`);
            
            // Calculate how many pages we need (max AI training size)
            const recordsNeeded = Math.min(totalCount, this.aiTrainingSize);
            const pagesNeeded = Math.ceil(recordsNeeded / 200);
            
            console.log(`📚 Will fetch ${pagesNeeded} pages (${recordsNeeded} records for AI training)`);
            
            // Fetch remaining pages
            for (let page = 1; page < pagesNeeded && page < 100; page++) {
                console.log(`📜 Fetching page ${page}...`);
                const response = await fetch(`${this.apiBase}/history?page=${page}&size=200`);
                const pageData = await response.json();
                allApiResults.push(...pageData);
                await new Promise(resolve => setTimeout(resolve, 150));
                
                if (allApiResults.length >= this.aiTrainingSize) {
                    console.log(`📦 Reached AI training capacity (${this.aiTrainingSize}), stopping fetch`);
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
                if (gameResult) gameResults.push(gameResult);
            }
            
            gameResults.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            
            // Store in AI training storage (20,000 capacity)
            this.aiTrainingData = gameResults.slice(0, this.aiTrainingSize);
            this.saveAITrainingDataToLocalStorage();
            
            console.log(`✅ AI Training Storage: ${this.aiTrainingData.length} records`);
            
            if (this.aiTrainingData.length > 0) {
                this.lastGameId = this.aiTrainingData[0].id;
            }
            
            // Build display history from real data (only last 1000)
            await this.buildDisplayHistoryFromRealData();
            
            this.updateDataSizeIndicator();
            
        } catch (error) {
            console.error('❌ Error loading real history:', error);
        } finally {
            this.isLoadingHistory = false;
        }
    }
    
    // ✅ Build ONLY display history (last 1000)
    async buildDisplayHistoryFromRealData() {
        console.log('🔨 Building display history (last 1000 records)...');
        
        const orderedResults = [...this.aiTrainingData].reverse();
        const newDisplayHistory = [];
        
        for (let i = 1; i < orderedResults.length && newDisplayHistory.length < this.displayHistorySize; i++) {
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
            
            const time = currentResult.timestamp.toLocaleTimeString();
            
            const historyEntry = {
                id: `${currentResult.id}_${Date.now()}_${i}`,
                time: time,
                dice: currentResult.diceValues,
                total: currentResult.total,
                actualGroup: currentResult.group,
                predStick: predStickGroup,
                predExtreme: predExtremeGroup,
                predLowMid: predLowMidGroup,
                predMidHigh: predMidHighGroup,
                ensemble: 'MEDIUM',
                correctStick: predStickGroup === currentResult.group,
                correctExtreme: predExtremeGroup === currentResult.group,
                correctLowMid: predLowMidGroup === currentResult.group,
                correctMidHigh: predMidHighGroup === currentResult.group,
                correctEnsemble: false,
                timestamp: currentResult.timestamp,
                isReal: true
            };
            
            newDisplayHistory.push(historyEntry);
        }
        
        this.predictionHistory = newDisplayHistory.slice(0, this.displayHistorySize);
        this.saveDisplayHistoryToLocalStorage();
        this.updateHistoryTable();
        console.log(`✅ Display History: ${this.predictionHistory.length} records (last 1000)`);
    }
    
    getLastNResultsFromHistory(history, currentIndex) {
        const start = Math.max(0, currentIndex - 4);
        const results = [];
        for (let i = start; i < currentIndex; i++) {
            results.push(history[i].group);
        }
        return results;
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
    
    async fetchNewRecordsFromAPI() {
        try {
            const response = await fetch(`${this.apiBase}/history?page=0&size=50`);
            const newRecords = await response.json();
            
            let newCount = 0;
            const existingIds = new Set(this.aiTrainingData.map(r => r.id));
            
            for (const item of newRecords) {
                if (!existingIds.has(item.id)) {
                    const gameResult = this.parseHistoryGameData(item);
                    if (gameResult) {
                        this.aiTrainingData.unshift(gameResult);
                        newCount++;
                    }
                }
            }
            
            if (this.aiTrainingData.length > this.aiTrainingSize) {
                this.aiTrainingData = this.aiTrainingData.slice(0, this.aiTrainingSize);
            }
            
            if (newCount > 0) {
                console.log(`🆕 Found ${newCount} new records from API`);
                this.saveAITrainingDataToLocalStorage();
                await this.buildDisplayHistoryFromRealData();
                this.updateDataSizeIndicator();
            }
        } catch (error) {
            console.warn('Could not fetch new records:', error.message);
        }
    }
    
    async trainAllModels() {
        console.log(`🎓 Training all 4 AI models with ${this.aiTrainingData.length} records...`);
        
        const historyInOrder = this.getAITrainingDataInOrder();
        
        if (window.AI_Stick) window.AI_Stick.train(historyInOrder);
        if (window.AI_ExtremeSwitch) window.AI_ExtremeSwitch.train(historyInOrder);
        if (window.AI_LowMidSwitch) window.AI_LowMidSwitch.train(historyInOrder);
        if (window.AI_MidHighSwitch) window.AI_MidHighSwitch.train(historyInOrder);
        
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
    
    startPeriodicRetrain() {
        this.retrainInterval = setInterval(async () => {
            console.log('⏰ Periodic retrain triggered (2 hour interval)...');
            await this.fullRetrain();
        }, 2 * 60 * 60 * 1000);
    }
    
    async fullRetrain() {
        console.log('🔄 Starting full retrain...');
        if (this.aiTrainingData.length > 0) {
            await this.trainAllModels();
            await this.buildDisplayHistoryFromRealData();
            this.updateUI();
            console.log('✅ Full retrain complete');
        }
    }
    
    async checkAndRetrain() {
        this.recordsSinceLastRetrain++;
        if (this.recordsSinceLastRetrain >= this.retrainThreshold) {
            console.log(`📊 Retrain threshold reached (${this.recordsSinceLastRetrain} new records), retraining...`);
            await this.fullRetrain();
        }
    }
    
    getAITrainingDataInOrder() {
        return [...this.aiTrainingData].reverse();
    }
    
    getLastNResults(n) {
        const orderedResults = this.getAITrainingDataInOrder();
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
                
                // Add to display history (with auto-limit)
                this.addToDisplayHistory(gameResult, predStickGroup, predExtremeGroup, predLowMidGroup, predMidHighGroup, ensembleGroup);
                
                // Add to AI training storage
                this.aiTrainingData.unshift(gameResult);
                this.lastGameId = gameResult.id;
                this.latestResult = gameResult;
                
                if (this.aiTrainingData.length > this.aiTrainingSize) {
                    this.aiTrainingData.pop();
                }
                
                this.saveAITrainingDataToLocalStorage();
                
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
                
                await this.checkAndRetrain();
            }
        } catch (error) {
            console.error('Error checking for new data:', error);
        }
    }
    
    // ✅ Add to display history only (with auto-limit)
    addToDisplayHistory(result, predStickGroup, predExtremeGroup, predLowMidGroup, predMidHighGroup, ensembleGroup) {
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
            
            // ✅ Auto-remove old records when exceeds 1000
            if (this.predictionHistory.length > this.displayHistorySize) {
                this.predictionHistory.pop();
                console.log(`📊 Auto-cleaned: Display history now at ${this.displayHistorySize} records`);
            }
            
            this.saveDisplayHistoryToLocalStorage();
            this.updateHistoryTable();
        }
    }
    
    extractPredictionGroup(prediction) {
        if (!prediction) return 'MEDIUM';
        if (prediction.prediction === "STICK" && prediction.nextGroup) return prediction.nextGroup;
        if (prediction.prediction === "SWITCH" && prediction.nextGroup) return prediction.nextGroup;
        if (prediction.prediction === "CONTINUE" && prediction.pattern) {
            const parts = prediction.pattern.split("→");
            if (parts.length >= 2) return parts[1].trim();
        }
        if (prediction.prediction === "BREAK" && prediction.nextGroup) return prediction.nextGroup;
        return 'MEDIUM';
    }
    
    updateHistoryTable() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const pageItems = this.predictionHistory.slice(startIndex, startIndex + this.itemsPerPage);
        
        if (pageItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No history data yet... Click "Clear History" to reset or wait for new data...</td></tr>';
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
        if (lastResults.length < 4) return;
        
        const currentGroup = lastResults[lastResults.length - 1];
        const previousGroup = lastResults.length >= 2 ? lastResults[lastResults.length - 2] : currentGroup;
        
        const predStick = window.AI_Stick ? window.AI_Stick.predict(currentGroup, previousGroup) : null;
        const predExtreme = window.AI_ExtremeSwitch ? window.AI_ExtremeSwitch.predict(currentGroup, previousGroup) : null;
        const predLowMid = window.AI_LowMidSwitch ? window.AI_LowMidSwitch.predict(currentGroup, previousGroup) : null;
        const predMidHigh = window.AI_MidHighSwitch ? window.AI_MidHighSwitch.predict(currentGroup, previousGroup) : null;
        
        const ensemble = window.EnsembleVoterV4 ? window.EnsembleVoterV4.combine(predStick, predExtreme, predLowMid, predMidHigh, currentGroup, previousGroup) : null;
        
        if (predStick) {
            document.getElementById('aiStickInput').textContent = `${previousGroup} → ${currentGroup}`;
            const stickPredText = predStick.prediction === "STICK" ? `${predStick.nextGroup} (Stick)` : `Switch to ${predStick.nextGroup}`;
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
        const totalCount = this.aiTrainingData.length;
        document.getElementById('totalRounds').textContent = totalCount.toLocaleString();
        
        let totalSum = 0;
        this.aiTrainingData.forEach(result => { totalSum += result.total; });
        const avgResult = totalCount > 0 ? (totalSum / totalCount).toFixed(2) : 0;
        document.getElementById('avgResult').textContent = avgResult;
        
        const groupCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        this.aiTrainingData.forEach(result => {
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
        
        const frequencyMap = {};
        const lastSeenMap = {};
        
        this.aiTrainingData.forEach(result => {
            const num = result.total;
            frequencyMap[num] = (frequencyMap[num] || 0) + 1;
            if (!lastSeenMap[num]) lastSeenMap[num] = result.timestamp;
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
            const percentage = this.aiTrainingData.length > 0 ? Math.round((item.count / this.aiTrainingData.length) * 100) : 0;
            
            return `
                <tr>
                    <td><strong>${item.wheelResult}</strong></td>
                    <td><span class="group-badge ${groupClass}">${group}</span></td>
                    <td>${item.count}</td>
                    <td>${percentage}%</td>
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
        if (!this.aiTrainingData.length) return;
        
        const recentResults = this.aiTrainingData.slice(0, 10);
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
        
        if (this.aiTrainingData.length === 0) {
            resultsGrid.innerHTML = '<div class="loading">No results yet</div>';
            return;
        }
        
        const recentResults = this.aiTrainingData.slice(0, 10);
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
                const existingIndex = this.aiTrainingData.findIndex(r => r.id === gameResult.id);
                if (existingIndex === -1) {
                    this.aiTrainingData.unshift(gameResult);
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
