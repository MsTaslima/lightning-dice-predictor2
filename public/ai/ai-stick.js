/**
 * AI-A: Stick Pattern Detector
 * Tracks: LOW→LOW, MEDIUM→MEDIUM, HIGH→HIGH
 * Predicts: Will stick continue or switch?
 */

class AI_Stick {
    constructor() {
        this.name = "AI-Stick";
        this.groups = ['LOW', 'MEDIUM', 'HIGH'];
        
        this.patternStreaks = {
            "LOW→LOW": 0,
            "MEDIUM→MEDIUM": 0,
            "HIGH→HIGH": 0
        };
        
        this.patternHistory = {
            "LOW→LOW": { maxStreak: 0, breaks: [], avgStreak: 0, nextAfterBreak: {} },
            "MEDIUM→MEDIUM": { maxStreak: 0, breaks: [], avgStreak: 0, nextAfterBreak: {} },
            "HIGH→HIGH": { maxStreak: 0, breaks: [], avgStreak: 0, nextAfterBreak: {} }
        };
        
        this.defaultMaxStreak = {
            "LOW→LOW": 20,
            "MEDIUM→MEDIUM": 17,
            "HIGH→HIGH": 18
        };
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        
        this.init();
    }
    
    init() {
        console.log('🤖 AI-A (Stick Detector) Initializing...');
        this.loadFromStorage();
    }
    
    train(history) {
        if (!history || history.length < 3) return false;
        
        console.log(`📚 AI-A: Training with ${history.length} results...`);
        
        for (let pattern in this.patternStreaks) {
            this.patternStreaks[pattern] = 0;
        }
        
        for (let i = 1; i < history.length; i++) {
            const prevGroup = history[i-1].group;
            const currGroup = history[i].group;
            const patternKey = `${prevGroup}→${currGroup}`;
            
            if (this.patternStreaks.hasOwnProperty(patternKey)) {
                if (prevGroup === currGroup) {
                    this.patternStreaks[patternKey]++;
                } else {
                    const streakValue = this.patternStreaks[patternKey];
                    if (streakValue > 0) {
                        this.recordBreak(patternKey, streakValue, currGroup);
                    }
                    this.patternStreaks[patternKey] = 0;
                }
            }
        }
        
        this.calculateStats();
        this.saveToStorage();
        this.printStats();
        
        return true;
    }
    
    recordBreak(pattern, streakLength, nextGroup) {
        const history = this.patternHistory[pattern];
        if (history) {
            history.breaks.push(streakLength);
            if (streakLength > history.maxStreak) {
                history.maxStreak = streakLength;
            }
            history.nextAfterBreak[nextGroup] = (history.nextAfterBreak[nextGroup] || 0) + 1;
        }
    }
    
    calculateStats() {
        for (let pattern in this.patternHistory) {
            const history = this.patternHistory[pattern];
            if (history.breaks.length > 0) {
                const sum = history.breaks.reduce((a, b) => a + b, 0);
                history.avgStreak = sum / history.breaks.length;
            }
        }
    }
    
    predict(currentGroup, previousGroup) {
        if (currentGroup !== previousGroup) {
            return this.getDefaultPrediction(currentGroup);
        }
        
        const patternKey = `${previousGroup}→${currentGroup}`;
        const currentStreak = this.patternStreaks[patternKey] + 1;
        const history = this.patternHistory[patternKey];
        const maxStreak = history.maxStreak > 0 ? history.maxStreak : this.defaultMaxStreak[patternKey];
        
        let breakProbability = 0;
        let willBreak = false;
        let remaining = maxStreak - currentStreak;
        
        if (currentStreak >= maxStreak - 3) {
            breakProbability = 60 + ((currentStreak - (maxStreak - 3)) * 10);
            if (breakProbability > 95) breakProbability = 95;
            willBreak = breakProbability > 70;
        } else if (currentStreak >= maxStreak - 6) {
            breakProbability = 40 + ((currentStreak - (maxStreak - 6)) * 7);
        } else {
            breakProbability = 10 + (currentStreak * 2);
            if (breakProbability > 35) breakProbability = 35;
        }
        
        let nextGroup = currentGroup;
        let nextGroupConfidence = 50;
        
        if (willBreak && history.nextAfterBreak) {
            let maxCount = 0;
            for (let [group, count] of Object.entries(history.nextAfterBreak)) {
                if (count > maxCount) {
                    maxCount = count;
                    nextGroup = group;
                }
            }
            nextGroupConfidence = Math.round((maxCount / history.breaks.length) * 100);
        }
        
        const confidence = Math.round(100 - breakProbability);
        
        return {
            model: this.name,
            prediction: willBreak ? "SWITCH" : "STICK",
            currentGroup: currentGroup,
            currentStreak: currentStreak,
            maxStreak: maxStreak,
            remaining: remaining,
            breakProbability: Math.round(breakProbability),
            nextGroup: nextGroup,
            nextGroupConfidence: nextGroupConfidence,
            confidence: confidence,
            accuracy: this.accuracy
        };
    }
    
    getDefaultPrediction(group) {
        return {
            model: this.name,
            prediction: "STICK",
            currentGroup: group,
            currentStreak: 1,
            maxStreak: 20,
            remaining: 19,
            breakProbability: 5,
            nextGroup: group,
            nextGroupConfidence: 60,
            confidence: 70,
            accuracy: this.accuracy
        };
    }
    
    updateWithResult(result, previousGroup) {
        const patternKey = `${previousGroup}→${result.group}`;
        
        if (previousGroup === result.group) {
            this.patternStreaks[patternKey] = (this.patternStreaks[patternKey] || 0) + 1;
        } else {
            const streakValue = this.patternStreaks[patternKey] || 0;
            if (streakValue > 0) {
                this.recordBreak(patternKey, streakValue, result.group);
                this.calculateStats();
            }
            this.patternStreaks[patternKey] = 0;
        }
        
        this.saveToStorage();
    }
    
    recordPredictionResult(correct) {
        this.totalPredictions++;
        if (correct) this.correctPredictions++;
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
        this.saveToStorage();
    }
    
    saveToStorage() {
        try {
            const data = {
                patternStreaks: this.patternStreaks,
                patternHistory: this.patternHistory,
                totalPredictions: this.totalPredictions,
                correctPredictions: this.correctPredictions,
                accuracy: this.accuracy
            };
            localStorage.setItem('ai_stick_data', JSON.stringify(data));
        } catch(e) { console.warn('Save failed:', e); }
    }
    
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('ai_stick_data');
            if (saved) {
                const data = JSON.parse(saved);
                this.patternStreaks = data.patternStreaks || this.patternStreaks;
                this.patternHistory = data.patternHistory || this.patternHistory;
                this.totalPredictions = data.totalPredictions || 0;
                this.correctPredictions = data.correctPredictions || 0;
                this.accuracy = data.accuracy || 0;
                console.log(`✅ AI-A: Loaded from storage (${this.accuracy.toFixed(1)}% accuracy)`);
            }
        } catch(e) { console.warn('Load failed:', e); }
    }
    
    printStats() {
        console.log(`📊 AI-A: Accuracy: ${this.accuracy.toFixed(1)}%`);
        for (let pattern in this.patternHistory) {
            const h = this.patternHistory[pattern];
            console.log(`   ${pattern}: max=${h.maxStreak}, avg=${h.avgStreak.toFixed(1)}`);
        }
    }
    
    getAccuracy() {
        return this.accuracy || 0;
    }
    
    setAccuracy(accuracy) {
        this.accuracy = accuracy;
    }
    
    getTotalPredictions() {
        return this.totalPredictions;
    }
    
    getCorrectPredictions() {
        return this.correctPredictions;
    }
    
    loadFromServer(patterns) {
        for (const [patternKey, data] of Object.entries(patterns)) {
            if (this.patternStreaks.hasOwnProperty(patternKey)) {
                this.patternStreaks[patternKey] = data.streak_value || 0;
            }
            if (this.patternHistory[patternKey]) {
                this.patternHistory[patternKey].maxStreak = data.max_streak || 0;
                this.patternHistory[patternKey].breaks = data.break_data?.breaks || [];
                this.patternHistory[patternKey].nextAfterBreak = data.break_data?.nextAfterBreak || {};
                if (this.patternHistory[patternKey].breaks.length > 0) {
                    const sum = this.patternHistory[patternKey].breaks.reduce((a, b) => a + b, 0);
                    this.patternHistory[patternKey].avgStreak = sum / this.patternHistory[patternKey].breaks.length;
                }
            }
        }
        console.log(`✅ ${this.name}: Loaded patterns from server`);
    }
    
    exportForServer() {
        const exportData = {};
        for (const [patternKey, history] of Object.entries(this.patternHistory)) {
            exportData[patternKey] = {
                streak_value: this.patternStreaks[patternKey] || 0,
                max_streak: history.maxStreak,
                break_data: {
                    breaks: history.breaks,
                    nextAfterBreak: history.nextAfterBreak
                }
            };
        }
        return exportData;
    }
    
    getStats() {
        return {
            name: this.name,
            accuracy: this.accuracy,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions
        };
    }
    
    getGroupIcon(group) {
        if (group === 'LOW') return '🔴';
        if (group === 'MEDIUM') return '🟡';
        return '🟢';
    }
}

window.AI_Stick = new AI_Stick();
