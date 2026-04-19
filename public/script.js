// script.js (UPDATED - Supports pending status)

class LightningDiceApp {
    constructor() {
        this.apiBase = '/api';
        this.ws = null;
        this.allResults = [];
        this.lastGameId = null;
        this.autoRefreshInterval = null;
        this.timerInterval = null;
        this.refreshSeconds = 3;
        this.isInitialized = false;
        
        this.predictionsMap = new Map();
        this.predictionHistory = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.maxHistorySize = 1000;
        
        this.groups = {
            LOW: { name: 'LOW', range: '3-9', numbers: [3,4,5,6,7,8,9], icon: '🔴' },
            MEDIUM: { name: 'MEDIUM', range: '10-11', numbers: [10,11], icon: '🟡' },
            HIGH: { name: 'HIGH', range: '12-18', numbers: [12,13,14,15,16,17,18], icon: '🟢' }
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Four AI Pattern System (Prediction First Mode)...');
        this.bindEvents();
        this.setupWebSocket();
        
        await this.loadStats();
        await this.loadResults();
        await this.loadPredictionsFromServer();
        await this.loadAIStats();
        await this.loadPatternsFromServer();
        await this.loadCurrentPrediction();
        
        if (this.allResults.length >= 5) {
            await this.trainAllModels();
        }
        
        this.isInitialized = true;
        this.updateUI();
        this.startAutoRefresh();
        this.startTimer();
        this.setupCollapsibleStats();
    }
    
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        let reconnectDelay = 1000;
        const maxDelay = 30000;
        
        const connect = () => {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('🔌 WebSocket connected');
                reconnectDelay = 1000;
                this.updateConnectionStatus(true);
                this.loadCurrentPrediction();
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'new_result') {
                    console.log('🆕 New result via WebSocket:', data.data);
                    this.handleNewResult(data.data);
                } else if (data.type === 'prediction_pending') {
                    console.log('⏳ Prediction pending for:', data.data.result_id);
                    this.loadPredictionsFromServer(); // Refresh to show pending status
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
            
            this.ws.onclose = () => {
                console.log(`WebSocket disconnected, reconnecting in ${reconnectDelay}ms...`);
                this.updateConnectionStatus(false);
                setTimeout(connect, reconnectDelay);
                reconnectDelay = Math.min(reconnectDelay * 1.5, maxDelay);
            };
        };
        
        connect();
    }
    
    async loadCurrentPrediction() {
        try {
            const response = await fetch(`${this.apiBase}/current-prediction`);
            if (!response.ok) throw new Error('Failed to load current prediction');
            const data = await response.json();
            
            if (data.success && data.prediction) {
                this.displayServerPrediction(data.prediction);
            }
        } catch (error) {
            console.error('Error loading current prediction:', error);
        }
    }
    
    displayServerPrediction(prediction) {
        const ensembleGroup = prediction.ensemble;
        const stickGroup = prediction.stick;
        const extremeGroup = prediction.extreme;
        const lowMidGroup = prediction.lowMid;
        const midHighGroup = prediction.midHigh;
        
        const stickPredEl = document.getElementById('aiStickPred');
        const extremePredEl = document.getElementById('aiExtremePred');
        const lowMidPredEl = document.getElementById('aiLowMidPred');
        const midHighPredEl = document.getElementById('aiMidHighPred');
        
        if (stickPredEl) stickPredEl.innerHTML = `${this.getGroupIcon(stickGroup)} ${stickGroup}`;
        if (extremePredEl) extremePredEl.innerHTML = `${this.getGroupIcon(extremeGroup)} ${extremeGroup}`;
        if (lowMidPredEl) lowMidPredEl.innerHTML = `${this.getGroupIcon(lowMidGroup)} ${lowMidGroup}`;
        if (midHighPredEl) midHighPredEl.innerHTML = `${this.getGroupIcon(midHighGroup)} ${midHighGroup}`;
        
        const finalIcon = document.getElementById('finalIcon');
        const finalName = document.getElementById('finalName');
        const finalRange = document.getElementById('finalRange');
        
        if (finalIcon) finalIcon.textContent = this.getGroupIcon(ensembleGroup);
        if (finalName) finalName.textContent = ensembleGroup;
        if (finalRange) finalRange.textContent = `(${this.getGroupRange(ensembleGroup)})`;
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
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshData());
        
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
            this.renderHistoryTable();
        }
    }
    
    async loadStats() {
        try {
            const response = await fetch(`${this.apiBase}/stats`);
            if (!response.ok) throw new Error('Failed to load stats');
            const stats = await response.json();
            
            const totalRoundsEl = document.getElementById('totalRounds');
            const avgResultEl = document.getElementById('avgResult');
            const mostActiveGroupEl = document.getElementById('mostActiveGroup');
            const lightningBoostEl = document.getElementById('lightningBoost');
            
            if (totalRoundsEl) totalRoundsEl.textContent = stats.totalRounds.toLocaleString();
            if (avgResultEl) avgResultEl.textContent = stats.avgResult;
            if (mostActiveGroupEl) mostActiveGroupEl.textContent = stats.mostActiveGroup;
            if (lightningBoostEl) lightningBoostEl.textContent = `${stats.lightningBoost}%`;
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    async loadResults() {
        try {
            const response = await fetch(`${this.apiBase}/results?limit=100`);
            if (!response.ok) throw new Error('Failed to load results');
            const data = await response.json();
            
            this.allResults = data.data.map(r => ({
                id: r.id,
                total: r.total,
                group: r.group_name,
                multiplier: r.multiplier,
                timestamp: new Date(r.timestamp),
                diceValues: r.dice_values,
                winners: r.winners,
                payout: r.payout
            }));
            
            console.log(`✅ Loaded ${this.allResults.length} results from database`);
            
            if (this.allResults.length > 0) {
                this.lastGameId = this.allResults[0].id;
                this.updateRecentResultsDisplay();
                this.updateStatisticsTable();
                this.updateGroupProbabilities();
            }
        } catch (error) {
            console.error('Error loading results:', error);
        }
    }
    
    async loadPredictionsFromServer() {
        try {
            const response = await fetch(`${this.apiBase}/predictions?limit=500`);
            if (!response.ok) throw new Error('Failed to load predictions');
            const predictions = await response.json();
            
            // Clear and reload (append only - but server now handles correctly)
            this.predictionsMap.clear();
            
            for (const p of predictions) {
                const isPending = p.is_pending === true || p.actual_group === null;
                
                const predictionEntry = {
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
                    isPending: isPending
                };
                this.predictionsMap.set(p.result_id, predictionEntry);
            }
            
            this.predictionHistory = Array.from(this.predictionsMap.values())
                .sort((a, b) => b.timestamp - a.timestamp);
            
            console.log(`✅ Loaded ${this.predictionHistory.length} predictions from server`);
            this.renderHistoryTable();
        } catch (error) {
            console.error('Error loading predictions:', error);
        }
    }
    
    async loadAIStats() {
        try {
            const response = await fetch(`${this.apiBase}/ai-stats`);
            if (!response.ok) throw new Error('Failed to load AI stats');
            const stats = await response.json();
            
            stats.forEach(stat => {
                if (stat.ai_name === 'AI_Stick' && window.AI_Stick) window.AI_Stick.setAccuracy(stat.accuracy);
                if (stat.ai_name === 'AI_ExtremeSwitch' && window.AI_ExtremeSwitch) window.AI_ExtremeSwitch.setAccuracy(stat.accuracy);
                if (stat.ai_name === 'AI_LowMidSwitch' && window.AI_LowMidSwitch) window.AI_LowMidSwitch.setAccuracy(stat.accuracy);
                if (stat.ai_name === 'AI_MidHighSwitch' && window.AI_MidHighSwitch) window.AI_MidHighSwitch.setAccuracy(stat.accuracy);
                if (stat.ai_name === 'EnsembleVoter' && window.EnsembleVoterV4) window.EnsembleVoterV4.setAccuracy(stat.accuracy);
            });
        } catch (error) {
            console.error('Error loading AI stats:', error);
        }
    }
    
    async loadPatternsFromServer() {
        const aiNames = ['AI_Stick', 'AI_ExtremeSwitch', 'AI_LowMidSwitch', 'AI_MidHighSwitch'];
        
        for (const aiName of aiNames) {
            try {
                const response = await fetch(`${this.apiBase}/load-pattern/${aiName}`);
                if (!response.ok) continue;
                const patterns = await response.json();
                
                const ai = window[aiName];
                if (ai && patterns && Object.keys(patterns).length > 0) {
                    ai.loadFromServer(patterns);
                }
            } catch (error) {
                console.error(`Error loading patterns for ${aiName}:`, error);
            }
        }
    }
    
    async trainAllModels() {
        console.log('🎓 Training all 4 AI models...');
        
        if (this.allResults.length < 5) {
            console.log('⚠️ Not enough data for training, need at least 5 results');
            return false;
        }
        
        const historyInOrder = [...this.allResults].reverse();
        console.log(`📚 Training with ${historyInOrder.length} historical results`);
        
        if (window.AI_Stick) {
            window.AI_Stick.train(historyInOrder);
            console.log('✅ AI-A (Stick) trained');
        }
        
        if (window.AI_ExtremeSwitch) {
            window.AI_ExtremeSwitch.train(historyInOrder);
            console.log('✅ AI-B (Extreme Switch) trained');
        }
        
        if (window.AI_LowMidSwitch) {
            window.AI_LowMidSwitch.train(historyInOrder);
            console.log('✅ AI-C (Low-Mid Switch) trained');
        }
        
        if (window.AI_MidHighSwitch) {
            window.AI_MidHighSwitch.train(historyInOrder);
            console.log('✅ AI-D (Mid-High Switch) trained');
        }
        
        if (window.EnsembleVoterV4) {
            const accStick = window.AI_Stick?.getAccuracy() || 25;
            const accExtreme = window.AI_ExtremeSwitch?.getAccuracy() || 25;
            const accLowMid = window.AI_LowMidSwitch?.getAccuracy() || 25;
            const accMidHigh = window.AI_MidHighSwitch?.getAccuracy() || 25;
            
            console.log(`📊 AI Accuracies - Stick:${accStick.toFixed(1)}%, Extreme:${accExtreme.toFixed(1)}%, LowMid:${accLowMid.toFixed(1)}%, MidHigh:${accMidHigh.toFixed(1)}%`);
            
            window.EnsembleVoterV4.updateWeights(accStick, accExtreme, accLowMid, accMidHigh);
        }
        
        console.log('✅ All 4 AI models trained successfully!');
        return true;
    }
    
    getLastNResults(n) {
        return this.allResults.slice(0, n).map(r => r.group);
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
        
        return prediction.nextGroup || 'MEDIUM';
    }
    
    async handleNewResult(result) {
        console.log('📊 New result arrived:', result);
        
        // Just reload predictions from server (they should already be updated)
        await this.loadPredictionsFromServer();
        await this.loadResults();
        
        this.updateUI();
        this.updateRecentResultsDisplay();
        this.updateStatisticsTable();
        this.updateGroupProbabilities();
        this.animateNewResult();
    }
    
    renderHistoryTable() {
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
            
            const getBadgeClass = (correct, isPending) => {
                if (isPending) return 'pending';
                return correct ? 'correct' : 'incorrect';
            };
            
            const getCheckmark = (correct, isPending) => {
                if (isPending) return '⏳';
                return correct ? '✓' : '✗';
            };
            
            const isPending = item.isPending;
            
            return `
                <tr>
                    <td style="font-size: 11px;">${item.time}</td>
                    <td class="dice-values" style="font-size: 11px;">🎲 ${item.dice}</td>
                    <td><strong>${item.total}</strong> <small>(${item.actualGroup})</small></td>
                    <td><span class="prediction-badge ${getBadgeClass(item.correctStick, isPending)}">${getIcon(item.predStick)} ${item.predStick} ${getCheckmark(item.correctStick, isPending)}</span></td>
                    <td><span class="prediction-badge ${getBadgeClass(item.correctExtreme, isPending)}">${getIcon(item.predExtreme)} ${item.predExtreme} ${getCheckmark(item.correctExtreme, isPending)}</span></td>
                    <td><span class="prediction-badge ${getBadgeClass(item.correctLowMid, isPending)}">${getIcon(item.predLowMid)} ${item.predLowMid} ${getCheckmark(item.correctLowMid, isPending)}</span></td>
                    <td><span class="prediction-badge ${getBadgeClass(item.correctMidHigh, isPending)}">${getIcon(item.predMidHigh)} ${item.predMidHigh} ${getCheckmark(item.correctMidHigh, isPending)}</span></td>
                    <td><span class="prediction-badge ${getBadgeClass(item.correctEnsemble, isPending)}">${getIcon(item.ensemble)} ${item.ensemble} ${getCheckmark(item.correctEnsemble, isPending)}</span></td>
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
        this.updateAIPredictions();
    }
    
    updateAIPredictions() {
        const lastResults = this.getLastNResults(4);
        if (lastResults.length < 2) return;
        
        const currentGroup = lastResults[0];
        const previousGroup = lastResults.length >= 2 ? lastResults[1] : currentGroup;
        
        const predStick = window.AI_Stick ? window.AI_Stick.predict(currentGroup, previousGroup) : null;
        const predExtreme = window.AI_ExtremeSwitch ? window.AI_ExtremeSwitch.predict(currentGroup, previousGroup) : null;
        const predLowMid = window.AI_LowMidSwitch ? window.AI_LowMidSwitch.predict(currentGroup, previousGroup) : null;
        const predMidHigh = window.AI_MidHighSwitch ? window.AI_MidHighSwitch.predict(currentGroup, previousGroup) : null;
        
        const ensemble = window.EnsembleVoterV4 ? window.EnsembleVoterV4.combine(predStick, predExtreme, predLowMid, predMidHigh, currentGroup, previousGroup) : null;
        
        const aiStickInput = document.getElementById('aiStickInput');
        const aiStickPred = document.getElementById('aiStickPred');
        const aiStickConf = document.getElementById('aiStickConf');
        const aiStickAcc = document.getElementById('aiStickAcc');
        
        if (predStick && aiStickInput) {
            aiStickInput.textContent = `${previousGroup} → ${currentGroup}`;
            const stickText = predStick.prediction === "STICK" ? `${predStick.nextGroup} (Stick)` : `Switch to ${predStick.nextGroup}`;
            if (aiStickPred) aiStickPred.innerHTML = `${this.getGroupIcon(predStick.nextGroup)} ${stickText}`;
            if (aiStickConf) aiStickConf.textContent = `${predStick.confidence}%`;
            if (aiStickAcc) aiStickAcc.textContent = `${(predStick.accuracy || 0).toFixed(1)}%`;
        }
        
        const aiExtremeInput = document.getElementById('aiExtremeInput');
        const aiExtremePred = document.getElementById('aiExtremePred');
        const aiExtremeConf = document.getElementById('aiExtremeConf');
        const aiExtremeAcc = document.getElementById('aiExtremeAcc');
        
        if (predExtreme && aiExtremeInput) {
            aiExtremeInput.textContent = predExtreme.pattern || `${previousGroup} → ${currentGroup}`;
            let extremeText = predExtreme.prediction === "CONTINUE" ? `Continue ${predExtreme.pattern?.split("→")[1]?.trim() || 'MEDIUM'}` : `Break to ${predExtreme.nextGroup}`;
            if (aiExtremePred) aiExtremePred.innerHTML = `${this.getGroupIcon(predExtreme.nextGroup)} ${extremeText}`;
            if (aiExtremeConf) aiExtremeConf.textContent = `${predExtreme.confidence}%`;
            if (aiExtremeAcc) aiExtremeAcc.textContent = `${(predExtreme.accuracy || 0).toFixed(1)}%`;
        }
        
        const aiLowMidInput = document.getElementById('aiLowMidInput');
        const aiLowMidPred = document.getElementById('aiLowMidPred');
        const aiLowMidConf = document.getElementById('aiLowMidConf');
        const aiLowMidAcc = document.getElementById('aiLowMidAcc');
        
        if (predLowMid && aiLowMidInput) {
            aiLowMidInput.textContent = predLowMid.pattern || `${previousGroup} → ${currentGroup}`;
            let lowMidText = predLowMid.prediction === "CONTINUE" ? `Continue ${predLowMid.pattern?.split("→")[1]?.trim() || 'MEDIUM'}` : `Break to ${predLowMid.nextGroup}`;
            if (aiLowMidPred) aiLowMidPred.innerHTML = `${this.getGroupIcon(predLowMid.nextGroup)} ${lowMidText}`;
            if (aiLowMidConf) aiLowMidConf.textContent = `${predLowMid.confidence}%`;
            if (aiLowMidAcc) aiLowMidAcc.textContent = `${(predLowMid.accuracy || 0).toFixed(1)}%`;
        }
        
        const aiMidHighInput = document.getElementById('aiMidHighInput');
        const aiMidHighPred = document.getElementById('aiMidHighPred');
        const aiMidHighConf = document.getElementById('aiMidHighConf');
        const aiMidHighAcc = document.getElementById('aiMidHighAcc');
        
        if (predMidHigh && aiMidHighInput) {
            aiMidHighInput.textContent = predMidHigh.pattern || `${previousGroup} → ${currentGroup}`;
            let midHighText = predMidHigh.prediction === "CONTINUE" ? `Continue ${predMidHigh.pattern?.split("→")[1]?.trim() || 'HIGH'}` : `Break to ${predMidHigh.nextGroup}`;
            if (aiMidHighPred) aiMidHighPred.innerHTML = `${this.getGroupIcon(predMidHigh.nextGroup)} ${midHighText}`;
            if (aiMidHighConf) aiMidHighConf.textContent = `${predMidHigh.confidence}%`;
            if (aiMidHighAcc) aiMidHighAcc.textContent = `${(predMidHigh.accuracy || 0).toFixed(1)}%`;
        }
        
        const voteCount = document.getElementById('voteCount');
        const finalIcon = document.getElementById('finalIcon');
        const finalName = document.getElementById('finalName');
        const finalRange = document.getElementById('finalRange');
        const confidenceFill = document.getElementById('confidenceFill');
        const finalConfidence = document.getElementById('finalConfidence');
        const finalExplanation = document.getElementById('finalExplanation');
        const finalWeights = document.getElementById('finalWeights');
        
        if (ensemble) {
            if (voteCount) voteCount.textContent = `(${ensemble.final.agreement}/4 AI agree)`;
            if (finalIcon) finalIcon.textContent = this.getGroupIcon(ensemble.final.group);
            if (finalName) finalName.textContent = ensemble.final.group;
            if (finalRange) finalRange.textContent = `(${this.getGroupRange(ensemble.final.group)})`;
            if (confidenceFill) confidenceFill.style.width = `${ensemble.final.confidence}%`;
            if (finalConfidence) finalConfidence.textContent = `${ensemble.final.confidence}%`;
            if (finalExplanation) finalExplanation.textContent = ensemble.explanation || `Ensemble predicts ${ensemble.final.group} with ${ensemble.final.confidence}% confidence`;
            
            const weights = ensemble.weights;
            if (weights && finalWeights) {
                finalWeights.innerHTML = `Weights: Stick ${(weights.stick*100).toFixed(0)}% | Extreme ${(weights.extremeSwitch*100).toFixed(0)}% | Low-Mid ${(weights.lowMidSwitch*100).toFixed(0)}% | Mid-High ${(weights.midHighSwitch*100).toFixed(0)}%`;
            }
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
    
    getGroup(number) {
        const num = parseInt(number);
        if (num >= 3 && num <= 9) return 'LOW';
        if (num >= 10 && num <= 11) return 'MEDIUM';
        if (num >= 12 && num <= 18) return 'HIGH';
        return 'UNKNOWN';
    }
    
    updateStatisticsTable() {
        const numberStats = {};
        this.allResults.forEach(result => {
            if (!numberStats[result.total]) {
                numberStats[result.total] = { count: 0, lastSeen: result.timestamp };
            }
            numberStats[result.total].count++;
            if (result.timestamp > numberStats[result.total].lastSeen) {
                numberStats[result.total].lastSeen = result.timestamp;
            }
        });
        
        const tbody = document.getElementById('statsTableBody');
        if (!tbody) return;
        
        const sortedNumbers = Object.keys(numberStats).sort((a,b) => parseInt(a) - parseInt(b));
        const total = this.allResults.length;
        
        if (sortedNumbers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No data available</td></tr>';
            return;
        }
        
        tbody.innerHTML = sortedNumbers.map(num => {
            const stat = numberStats[num];
            const numInt = parseInt(num);
            let group = this.getGroup(numInt);
            const groupClass = `group-${group.toLowerCase()}`;
            const percentage = total > 0 ? ((stat.count / total) * 100).toFixed(1) : 0;
            const timeAgo = this.getTimeAgo(stat.lastSeen);
            
            return `
                <tr>
                    <td><strong>${num}</strong></td>
                    <td><span class="group-badge ${groupClass}">${group}</span></td>
                    <td>${stat.count}</td>
                    <td>${percentage}%</td>
                    <td>${timeAgo}</td>
                </tr>
            `;
        }).join('');
    }
    
    getTimeAgo(date) {
        const diffMins = Math.floor((new Date() - new Date(date)) / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return `${Math.floor(diffMins / 1440)}d ago`;
    }
    
    updateGroupProbabilities() {
        const recentResults = this.allResults.slice(0, 10);
        const recentCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        recentResults.forEach(r => { if (r && r.group) recentCount[r.group]++; });
        
        const total = recentResults.length || 1;
        const lowProb = document.getElementById('lowProb');
        const mediumProb = document.getElementById('mediumProb');
        const highProb = document.getElementById('highProb');
        const lowTrend = document.getElementById('lowTrend');
        const mediumTrend = document.getElementById('mediumTrend');
        const highTrend = document.getElementById('highTrend');
        
        if (lowProb) lowProb.textContent = `${Math.round((recentCount.LOW / total) * 100)}%`;
        if (mediumProb) mediumProb.textContent = `${Math.round((recentCount.MEDIUM / total) * 100)}%`;
        if (highProb) highProb.textContent = `${Math.round((recentCount.HIGH / total) * 100)}%`;
        if (lowTrend) lowTrend.textContent = this.getTrendText(recentCount.LOW, total);
        if (mediumTrend) mediumTrend.textContent = this.getTrendText(recentCount.MEDIUM, total);
        if (highTrend) highTrend.textContent = this.getTrendText(recentCount.HIGH, total);
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
    }
    
    updateConnectionStatus(isConnected) {
        const statusText = document.getElementById('statusText');
        const statusDot = document.querySelector('.status-dot');
        if (statusText) statusText.textContent = isConnected ? 'Connected' : 'Reconnecting...';
        if (statusDot) statusDot.style.background = isConnected ? '#4ade80' : '#ef4444';
    }
    
    animateNewResult() {
        const predictionBox = document.querySelector('.prediction-section');
        if (predictionBox) {
            predictionBox.style.animation = 'none';
            setTimeout(() => predictionBox.style.animation = 'slideIn 0.3s ease', 10);
        }
    }
    
    async refreshData() {
        console.log('🔄 Manual refresh triggered');
        await this.loadStats();
        await this.loadResults();
        await this.loadPredictionsFromServer();
        await this.loadAIStats();
        await this.loadCurrentPrediction();
        this.updateUI();
    }
    
    startAutoRefresh() {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = setInterval(() => {
            console.log('🔄 Auto refresh - syncing with server');
            this.loadStats();
            this.loadResults();
            this.loadPredictionsFromServer();
            this.loadAIStats();
            this.updateUI();
        }, this.refreshSeconds * 1000);
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
}

// Initialize app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new LightningDiceApp();
    });
} else {
    window.app = new LightningDiceApp();
}
