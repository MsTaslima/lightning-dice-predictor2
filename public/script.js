// ============================================================
// COMPLETE script.js (FULLY FIXED - Pattern Display Issue Resolved)
// ============================================================

class LightningDiceApp {
    constructor() {
        this.apiBase = '/api';
        this.ws = null;
        this.allResults = [];
        this.predictionHistory = [];
        this.currentPrediction = null;
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.isInitialized = false;
        
        this.groups = {
            LOW: { name: 'LOW', range: '3-9', numbers: [3,4,5,6,7,8,9], icon: '🔴' },
            MEDIUM: { name: 'MEDIUM', range: '10-11', numbers: [10,11], icon: '🟡' },
            HIGH: { name: 'HIGH', range: '12-18', numbers: [12,13,14,15,16,17,18], icon: '🟢' }
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing WebSocket-Only AI Display System...');
        this.bindEvents();
        
        await this.loadInitialData();
        this.setupWebSocket();
        this.setupCollapsibleStats();
        this.isInitialized = true;
    }
    
    async loadInitialData() {
        console.log('📥 Loading initial data...');
        
        try {
            const response = await fetch(`${this.apiBase}/all-data`);
            if (!response.ok) throw new Error('Failed to load initial data');
            const data = await response.json();
            
            // FIX: Sort results by timestamp descending (newest first)
            this.allResults = (data.results || []).sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            
            this.predictionHistory = data.predictions || [];
            this.currentPrediction = data.currentPrediction || null;
            
            // Debug: Check sorting
            if (this.allResults.length >= 2) {
                console.log(`📊 Sorted results - Latest: ${this.allResults[0]?.group} (${this.allResults[0]?.timestamp})`);
                console.log(`📊 Previous: ${this.allResults[1]?.group} (${this.allResults[1]?.timestamp})`);
                console.log(`📊 Pattern: ${this.allResults[1]?.group} → ${this.allResults[0]?.group}`);
            }
            
            this.displayServerPrediction(this.currentPrediction);
            this.renderHistoryTable();
            this.updateRecentResultsDisplay();
            this.updateStatisticsTable();
            this.updateGroupProbabilities();
            this.updateStatsDisplay(data.stats);
            this.updateAIDisplay(data.aiStats);
            
            console.log(`✅ Initial data loaded: ${this.allResults.length} results, ${this.predictionHistory.length} predictions`);
        } catch (error) {
            console.error('Error loading initial data:', error);
            setTimeout(() => this.loadInitialData(), 2000);
        }
    }
    
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        let reconnectDelay = 1000;
        const maxDelay = 30000;
        
        const connect = () => {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('🔌 WebSocket connected - listening for real-time updates');
                reconnectDelay = 1000;
                this.updateConnectionStatus(true);
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'new_result') {
                    console.log('🆕 Real-time update received via WebSocket');
                    this.handleRealtimeUpdate(data);
                } else if (data.type === 'prediction_pending') {
                    console.log('⏳ Prediction pending update');
                    this.updatePendingStatus(data.data);
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
    
    handleRealtimeUpdate(data) {
        console.log('📨 Processing realtime update:', data.type);
        
        // FIX: Update allResults from server with proper sorting
        if (data.allResults) {
            this.allResults = data.allResults.sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            console.log(`📊 Updated allResults with ${this.allResults.length} entries`);
            if (this.allResults.length >= 2) {
                console.log(`📊 Pattern: ${this.allResults[1]?.group} → ${this.allResults[0]?.group}`);
            }
            this.updateRecentResultsDisplay();
            this.updateStatisticsTable();
            this.updateGroupProbabilities();
        }
        
        // Add new result to allResults array
        if (data.result) {
            const exists = this.allResults.some(r => r.id === data.result.id);
            if (!exists) {
                this.allResults.unshift(data.result);
                // FIX: Always sort by timestamp
                this.allResults.sort((a, b) => {
                    return new Date(b.timestamp) - new Date(a.timestamp);
                });
                if (this.allResults.length > 100) this.allResults.pop();
                
                this.updateRecentResultsDisplay();
                this.updateStatisticsTable();
                this.updateGroupProbabilities();
            }
        }
        
        // Add new prediction to history
        if (data.prediction && data.result) {
            const newPrediction = {
                id: data.result.id,
                time: new Date().toLocaleTimeString(),
                dice: data.result.diceValues || '--',
                total: data.result.total,
                actualGroup: data.result.group,
                predStick: data.prediction.stick || 'MEDIUM',
                predExtreme: data.prediction.extreme || 'MEDIUM',
                predLowMid: data.prediction.lowMid || 'MEDIUM',
                predMidHigh: data.prediction.midHigh || 'MEDIUM',
                ensemble: data.prediction.ensemble || 'MEDIUM',
                correctStick: data.prediction.correctStick || false,
                correctExtreme: data.prediction.correctExtreme || false,
                correctLowMid: data.prediction.correctLowMid || false,
                correctMidHigh: data.prediction.correctMidHigh || false,
                correctEnsemble: data.prediction.correctEnsemble || false,
                timestamp: new Date(),
                isPending: false
            };
            this.predictionHistory.unshift(newPrediction);
            if (this.predictionHistory.length > 1000) this.predictionHistory.pop();
            this.renderHistoryTable();
        }
        
        // Update predictions history if provided
        if (data.history) {
            this.predictionHistory = data.history;
            this.renderHistoryTable();
        }
        
        // Update current prediction display
        if (data.prediction) {
            this.currentPrediction = data.prediction;
            this.displayServerPrediction(data.prediction);
        }
        
        // Update other UI components
        if (data.stats) this.updateStatsDisplay(data.stats);
        if (data.aiStats) this.updateAIDisplay(data.aiStats);
        
        this.updateGroupProbabilities();
        this.updateStatisticsTable();
        this.animateNewResult();
    }
    
    updatePendingStatus(data) {
        const pendingPrediction = this.predictionHistory.find(p => p.id === data.result_id);
        if (pendingPrediction) {
            pendingPrediction.isPending = true;
            this.renderHistoryTable();
        }
    }
    
    displayServerPrediction(prediction) {
        if (!prediction) {
            console.log('⚠️ No prediction data available');
            return;
        }
        
        this.currentPrediction = prediction;
        
        // FIX: Get correct previous and current groups with proper sorting
        let currentGroup = '?';
        let previousGroup = '?';
        
        if (this.allResults && this.allResults.length >= 2) {
            // Make sure results are sorted by timestamp
            const sortedResults = [...this.allResults].sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            
            currentGroup = sortedResults[0]?.group || '?';
            previousGroup = sortedResults[1]?.group || '?';
            
            console.log(`📊 Display Pattern: ${previousGroup} → ${currentGroup}`);
        }
        
        // Update all AI input displays with the SAME correct pattern
        const stickInputEl = document.getElementById('aiStickInput');
        const extremeInputEl = document.getElementById('aiExtremeInput');
        const lowMidInputEl = document.getElementById('aiLowMidInput');
        const midHighInputEl = document.getElementById('aiMidHighInput');
        
        if (stickInputEl) stickInputEl.textContent = `${previousGroup} → ${currentGroup}`;
        if (extremeInputEl) extremeInputEl.textContent = `${previousGroup} → ${currentGroup}`;
        if (lowMidInputEl) lowMidInputEl.textContent = `${previousGroup} → ${currentGroup}`;
        if (midHighInputEl) midHighInputEl.textContent = `${previousGroup} → ${currentGroup}`;
        
        // AI-A (Stick)
        const stickPredEl = document.getElementById('aiStickPred');
        const stickConfEl = document.getElementById('aiStickConf');
        if (stickPredEl) stickPredEl.innerHTML = `${this.getGroupIcon(prediction.stick)} ${prediction.stick}`;
        if (stickConfEl) stickConfEl.textContent = `${prediction.stickConfidence || 65}%`;
        
        // AI-B (Extreme)
        const extremePredEl = document.getElementById('aiExtremePred');
        const extremeConfEl = document.getElementById('aiExtremeConf');
        if (extremePredEl) extremePredEl.innerHTML = `${this.getGroupIcon(prediction.extreme)} ${prediction.extreme}`;
        if (extremeConfEl) extremeConfEl.textContent = `${prediction.extremeConfidence || 65}%`;
        
        // AI-C (LowMid)
        const lowMidPredEl = document.getElementById('aiLowMidPred');
        const lowMidConfEl = document.getElementById('aiLowMidConf');
        if (lowMidPredEl) lowMidPredEl.innerHTML = `${this.getGroupIcon(prediction.lowMid)} ${prediction.lowMid}`;
        if (lowMidConfEl) lowMidConfEl.textContent = `${prediction.lowMidConfidence || 65}%`;
        
        // AI-D (MidHigh)
        const midHighPredEl = document.getElementById('aiMidHighPred');
        const midHighConfEl = document.getElementById('aiMidHighConf');
        if (midHighPredEl) midHighPredEl.innerHTML = `${this.getGroupIcon(prediction.midHigh)} ${prediction.midHigh}`;
        if (midHighConfEl) midHighConfEl.textContent = `${prediction.midHighConfidence || 65}%`;
        
        // Ensemble Final Prediction
        const finalIcon = document.getElementById('finalIcon');
        const finalName = document.getElementById('finalName');
        const finalRange = document.getElementById('finalRange');
        const confidenceFill = document.getElementById('confidenceFill');
        const finalConfidence = document.getElementById('finalConfidence');
        const finalExplanation = document.getElementById('finalExplanation');
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
        
        // Update weights display if available
        const finalWeights = document.getElementById('finalWeights');
        if (finalWeights && prediction.weights) {
            finalWeights.innerHTML = `⚖️ Weights: Stick ${Math.round(prediction.weights.stick * 100)}% | Extreme ${Math.round(prediction.weights.extreme * 100)}% | LowMid ${Math.round(prediction.weights.lowMid * 100)}% | MidHigh ${Math.round(prediction.weights.midHigh * 100)}%`;
        }
    }
    
    updateStatsDisplay(stats) {
        if (!stats) return;
        
        const totalRoundsEl = document.getElementById('totalRounds');
        const avgResultEl = document.getElementById('avgResult');
        const mostActiveGroupEl = document.getElementById('mostActiveGroup');
        const lightningBoostEl = document.getElementById('lightningBoost');
        
        if (totalRoundsEl) totalRoundsEl.textContent = (stats.totalRounds || 0).toLocaleString();
        if (avgResultEl) avgResultEl.textContent = stats.avgResult || '0.00';
        if (mostActiveGroupEl) mostActiveGroupEl.textContent = stats.mostActiveGroup || 'LOW';
        if (lightningBoostEl) lightningBoostEl.textContent = `${stats.lightningBoost || 0}%`;
    }
    
    updateAIDisplay(aiStats) {
        if (!aiStats || !Array.isArray(aiStats)) return;
        
        const stickAcc = aiStats.find(s => s.ai_name === 'AI_Stick')?.accuracy || 0;
        const extremeAcc = aiStats.find(s => s.ai_name === 'AI_ExtremeSwitch')?.accuracy || 0;
        const lowMidAcc = aiStats.find(s => s.ai_name === 'AI_LowMidSwitch')?.accuracy || 0;
        const midHighAcc = aiStats.find(s => s.ai_name === 'AI_MidHighSwitch')?.accuracy || 0;
        
        const stickAccEl = document.getElementById('aiStickAcc');
        const extremeAccEl = document.getElementById('aiExtremeAcc');
        const lowMidAccEl = document.getElementById('aiLowMidAcc');
        const midHighAccEl = document.getElementById('aiMidHighAcc');
        
        if (stickAccEl) stickAccEl.textContent = `${stickAcc.toFixed(1)}%`;
        if (extremeAccEl) extremeAccEl.textContent = `${extremeAcc.toFixed(1)}%`;
        if (lowMidAccEl) lowMidAccEl.textContent = `${lowMidAcc.toFixed(1)}%`;
        if (midHighAccEl) midHighAccEl.textContent = `${midHighAcc.toFixed(1)}%`;
    }
    
    renderHistoryTable() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;
        
        if (!this.predictionHistory || this.predictionHistory.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No prediction history yet. Waiting for data...</td></tr>';
            this.updatePaginationControls();
            return;
        }
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const pageItems = this.predictionHistory.slice(startIndex, startIndex + this.itemsPerPage);
        
        if (pageItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No history data on this page...</td></tr>';
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
                if (correct === undefined || correct === null) return '?';
                return correct ? '✓' : '✗';
            };
            
            const isPending = item.isPending || false;
            const actualDisplay = item.actualGroup && item.actualGroup !== '?' ? item.actualGroup : 'Pending';
            
            return `
                <tr>
                    <td style="font-size: 11px;">${item.time || '--'}</td>
                    <td class="dice-values" style="font-size: 11px;">🎲 ${item.dice || '--'}</td>
                    <td><strong>${item.total || '--'}</strong> <small>(${actualDisplay})</small></td>
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
        const totalPages = Math.max(1, Math.ceil(this.predictionHistory.length / this.itemsPerPage));
        const paginationInfo = document.getElementById('paginationInfo');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (paginationInfo) paginationInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === totalPages;
    }
    
    updateRecentResultsDisplay() {
        const resultsGrid = document.getElementById('resultsGrid');
        if (!resultsGrid) return;
        
        if (!this.allResults || this.allResults.length === 0) {
            resultsGrid.innerHTML = '<div class="loading">No results yet. Waiting for data...</div>';
            return;
        }
        
        const recentResults = this.allResults.slice(0, 10);
        resultsGrid.innerHTML = recentResults.map(result => {
            const isLightning = result.multiplier > 10;
            const time = result.timestamp ? new Date(result.timestamp).toLocaleTimeString() : '--';
            const groupIcon = this.groups[result.group]?.icon || '🎲';
            
            return `
                <div class="result-card ${isLightning ? 'lightning' : ''}">
                    <div class="result-number">${groupIcon} ${result.total}</div>
                    <div class="result-multiplier">${result.multiplier || 1}x</div>
                    <div class="result-time">${time}</div>
                    <div class="result-dice">${result.diceValues || '--'}</div>
                </div>
            `;
        }).join('');
    }
    
    updateStatisticsTable() {
        const tbody = document.getElementById('statsTableBody');
        if (!tbody) return;
        
        if (!this.allResults || this.allResults.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No data available yet...</td></tr>';
            return;
        }
        
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
        
        const sortedNumbers = Object.keys(numberStats).sort((a,b) => parseInt(a) - parseInt(b));
        const total = this.allResults.length;
        
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
        if (!this.allResults || this.allResults.length === 0) {
            const lowProb = document.getElementById('lowProb');
            const mediumProb = document.getElementById('mediumProb');
            const highProb = document.getElementById('highProb');
            if (lowProb) lowProb.textContent = '0%';
            if (mediumProb) mediumProb.textContent = '0%';
            if (highProb) highProb.textContent = '0%';
            return;
        }
        
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
        if (!date) return 'Unknown';
        const diffMins = Math.floor((new Date() - new Date(date)) / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return `${Math.floor(diffMins / 1440)}d ago`;
    }
    
    updateConnectionStatus(isConnected) {
        const statusText = document.getElementById('statusText');
        const statusDot = document.querySelector('.status-dot');
        if (statusText) statusText.textContent = isConnected ? 'Live' : 'Reconnecting...';
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
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadInitialData());
        
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        if (prevBtn) prevBtn.addEventListener('click', () => this.changePage(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.changePage(1));
    }
    
    changePage(delta) {
        const newPage = this.currentPage + delta;
        const totalPages = Math.max(1, Math.ceil(this.predictionHistory.length / this.itemsPerPage));
        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.renderHistoryTable();
        }
    }
    
    animateNewResult() {
        const predictionBox = document.querySelector('.prediction-section');
        if (predictionBox) {
            predictionBox.style.animation = 'none';
            setTimeout(() => predictionBox.style.animation = 'slideIn 0.3s ease', 10);
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
