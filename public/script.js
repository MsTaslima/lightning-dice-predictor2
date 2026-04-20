// script.js (COMPLETE - Server Only Version)
// No client AI references - only fetches from server API

class LightningDiceApp {
    constructor() {
        this.apiBase = '/api';
        this.ws = null;
        this.allResults = [];
        this.predictionHistory = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.autoRefreshInterval = null;
        this.timerInterval = null;
        this.refreshSeconds = 3;
        
        this.groups = {
            LOW: { name: 'LOW', range: '3-9', numbers: [3,4,5,6,7,8,9], icon: '🔴' },
            MEDIUM: { name: 'MEDIUM', range: '10-11', numbers: [10,11], icon: '🟡' },
            HIGH: { name: 'HIGH', range: '12-18', numbers: [12,13,14,15,16,17,18], icon: '🟢' }
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Server-Side AI Display System...');
        this.bindEvents();
        this.setupWebSocket();
        
        await this.loadStats();
        await this.loadResults();
        await this.loadPredictionsFromServer();
        await this.loadServerPrediction();
        
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
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'new_result') {
                    console.log('🆕 New result via WebSocket');
                    this.refreshData();
                } else if (data.type === 'prediction_pending') {
                    console.log('⏳ Prediction pending');
                    this.loadServerPrediction();
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
    
    async loadServerPrediction() {
        try {
            const response = await fetch(`${this.apiBase}/current-prediction`);
            if (!response.ok) throw new Error('Failed to load server prediction');
            const data = await response.json();
            
            if (data.success && data.prediction) {
                this.displayServerPrediction(data.prediction);
            }
        } catch (error) {
            console.error('Error loading server prediction:', error);
        }
    }
    
    displayServerPrediction(prediction) {
        // AI-A (Stick)
        const stickPredEl = document.getElementById('aiStickPred');
        const stickConfEl = document.getElementById('aiStickConf');
        const stickAccEl = document.getElementById('aiStickAcc');
        const stickInputEl = document.getElementById('aiStickInput');
        
        if (stickPredEl) stickPredEl.innerHTML = `${this.getGroupIcon(prediction.stick)} ${prediction.stick}`;
        if (stickConfEl) stickConfEl.textContent = `${prediction.stickConfidence || 65}%`;
        if (stickInputEl && this.allResults.length >= 2) {
            stickInputEl.textContent = `${this.allResults[1]?.group || '?'} → ${this.allResults[0]?.group || '?'}`;
        }
        
        // AI-B (Extreme Switch)
        const extremePredEl = document.getElementById('aiExtremePred');
        const extremeConfEl = document.getElementById('aiExtremeConf');
        const extremeAccEl = document.getElementById('aiExtremeAcc');
        const extremeInputEl = document.getElementById('aiExtremeInput');
        
        if (extremePredEl) extremePredEl.innerHTML = `${this.getGroupIcon(prediction.extreme)} ${prediction.extreme}`;
        if (extremeConfEl) extremeConfEl.textContent = `${prediction.extremeConfidence || 65}%`;
        if (extremeInputEl && this.allResults.length >= 2) {
            extremeInputEl.textContent = `${this.allResults[1]?.group || '?'} → ${this.allResults[0]?.group || '?'}`;
        }
        
        // AI-C (Low-Mid Switch)
        const lowMidPredEl = document.getElementById('aiLowMidPred');
        const lowMidConfEl = document.getElementById('aiLowMidConf');
        const lowMidAccEl = document.getElementById('aiLowMidAcc');
        const lowMidInputEl = document.getElementById('aiLowMidInput');
        
        if (lowMidPredEl) lowMidPredEl.innerHTML = `${this.getGroupIcon(prediction.lowMid)} ${prediction.lowMid}`;
        if (lowMidConfEl) lowMidConfEl.textContent = `${prediction.lowMidConfidence || 65}%`;
        if (lowMidInputEl && this.allResults.length >= 2) {
            lowMidInputEl.textContent = `${this.allResults[1]?.group || '?'} → ${this.allResults[0]?.group || '?'}`;
        }
        
        // AI-D (Mid-High Switch)
        const midHighPredEl = document.getElementById('aiMidHighPred');
        const midHighConfEl = document.getElementById('aiMidHighConf');
        const midHighAccEl = document.getElementById('aiMidHighAcc');
        const midHighInputEl = document.getElementById('aiMidHighInput');
        
        if (midHighPredEl) midHighPredEl.innerHTML = `${this.getGroupIcon(prediction.midHigh)} ${prediction.midHigh}`;
        if (midHighConfEl) midHighConfEl.textContent = `${prediction.midHighConfidence || 65}%`;
        if (midHighInputEl && this.allResults.length >= 2) {
            midHighInputEl.textContent = `${this.allResults[1]?.group || '?'} → ${this.allResults[0]?.group || '?'}`;
        }
        
        // Ensemble
        const finalIcon = document.getElementById('finalIcon');
        const finalName = document.getElementById('finalName');
        const finalRange = document.getElementById('finalRange');
        const confidenceFill = document.getElementById('confidenceFill');
        const finalConfidence = document.getElementById('finalConfidence');
        const finalExplanation = document.getElementById('finalExplanation');
        const finalWeights = document.getElementById('finalWeights');
        const voteCount = document.getElementById('voteCount');
        
        const ensembleGroup = prediction.ensemble;
        const ensembleConfidence = prediction.ensembleConfidence || 70;
        const agreement = prediction.agreement || 2;
        
        if (finalIcon) finalIcon.textContent = this.getGroupIcon(ensembleGroup);
        if (finalName) finalName.textContent = ensembleGroup;
        if (finalRange) finalRange.textContent = `(${this.getGroupRange(ensembleGroup)})`;
        if (confidenceFill) confidenceFill.style.width = `${ensembleConfidence}%`;
        if (finalConfidence) finalConfidence.textContent = `${ensembleConfidence}%`;
        if (voteCount) voteCount.textContent = `(${agreement}/4 AI agree)`;
        if (finalExplanation) finalExplanation.textContent = `Ensemble predicts ${ensembleGroup} with ${ensembleConfidence}% confidence based on weighted voting.`;
        
        // Load AI accuracies from server stats
        this.loadAIStatsForDisplay();
    }
    
    async loadAIStatsForDisplay() {
        try {
            const response = await fetch(`${this.apiBase}/ai-stats`);
            if (!response.ok) return;
            const stats = await response.json();
            
            const stickAcc = stats.find(s => s.ai_name === 'AI_Stick')?.accuracy || 0;
            const extremeAcc = stats.find(s => s.ai_name === 'AI_ExtremeSwitch')?.accuracy || 0;
            const lowMidAcc = stats.find(s => s.ai_name === 'AI_LowMidSwitch')?.accuracy || 0;
            const midHighAcc = stats.find(s => s.ai_name === 'AI_MidHighSwitch')?.accuracy || 0;
            
            const stickAccEl = document.getElementById('aiStickAcc');
            const extremeAccEl = document.getElementById('aiExtremeAcc');
            const lowMidAccEl = document.getElementById('aiLowMidAcc');
            const midHighAccEl = document.getElementById('aiMidHighAcc');
            
            if (stickAccEl) stickAccEl.textContent = `${stickAcc.toFixed(1)}%`;
            if (extremeAccEl) extremeAccEl.textContent = `${extremeAcc.toFixed(1)}%`;
            if (lowMidAccEl) lowMidAccEl.textContent = `${lowMidAcc.toFixed(1)}%`;
            if (midHighAccEl) midHighAccEl.textContent = `${midHighAcc.toFixed(1)}%`;
        } catch (error) {
            console.error('Error loading AI stats:', error);
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
                diceValues: r.dice_values
            }));
            
            console.log(`✅ Loaded ${this.allResults.length} results from database`);
            this.updateRecentResultsDisplay();
            this.updateStatisticsTable();
            this.updateGroupProbabilities();
        } catch (error) {
            console.error('Error loading results:', error);
        }
    }
    
    async loadPredictionsFromServer() {
        try {
            const response = await fetch(`${this.apiBase}/predictions?limit=500`);
            if (!response.ok) throw new Error('Failed to load predictions');
            const predictions = await response.json();
            
            this.predictionHistory = predictions.map(p => ({
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
            
            this.predictionHistory.sort((a, b) => b.timestamp - a.timestamp);
            console.log(`✅ Loaded ${this.predictionHistory.length} predictions from server`);
            this.renderHistoryTable();
        } catch (error) {
            console.error('Error loading predictions:', error);
        }
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
        this.loadServerPrediction();
        this.loadAIStatsForDisplay();
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
    
    getTimeAgo(date) {
        const diffMins = Math.floor((new Date() - new Date(date)) / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return `${Math.floor(diffMins / 1440)}d ago`;
    }
    
    updateConnectionStatus(isConnected) {
        const statusText = document.getElementById('statusText');
        const statusDot = document.querySelector('.status-dot');
        if (statusText) statusText.textContent = isConnected ? 'Connected' : 'Reconnecting...';
        if (statusDot) statusDot.style.background = isConnected ? '#4ade80' : '#ef4444';
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
    
    async refreshData() {
        console.log('🔄 Manual refresh triggered');
        await this.loadStats();
        await this.loadResults();
        await this.loadPredictionsFromServer();
        await this.loadServerPrediction();
        await this.loadAIStatsForDisplay();
    }
    
    startAutoRefresh() {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = setInterval(() => {
            this.refreshData();
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
}

// Initialize app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new LightningDiceApp();
    });
} else {
    window.app = new LightningDiceApp();
}
