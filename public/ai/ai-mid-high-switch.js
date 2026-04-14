/**
 * AI-D: Mid-High Switch Detector
 * Tracks: MEDIUM→HIGH, HIGH→MEDIUM
 * Predicts: Will mid-high switch continue or break?
 */

class AI_MidHighSwitch {
    constructor() {
        this.name = "AI-MidHighSwitch";
        this.groups = ['MEDIUM', 'HIGH'];
        
        // Pattern streaks tracking
        this.patternStreaks = {
            "MEDIUM→HIGH": 0,
            "HIGH→MEDIUM": 0
        };
        
        // Historical pattern data
        this.patternHistory = {
            "MEDIUM→HIGH": { maxStreak: 0, breaks: [], avgStreak: 0, nextAfterBreak: {} },
            "HIGH→MEDIUM": { maxStreak: 0, breaks: [], avgStreak: 0, nextAfterBreak: {} }
        };
        
        // Default max streak limits
        this.defaultMaxStreak = {
            "MEDIUM→HIGH": 17,
            "HIGH→MEDIUM": 17
        };
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        
        this.init();
    }
    
    init() {
        console.log('🤖 AI-D (Mid-High Switch Detector) Initializing...');
        this.loadFromStorage();
    }
    
    train(history) {
        if (!history || history.length < 3) return false;
        
        console.log(`📚 AI-D: Training with ${history.length} results...`);
        
        for (let pattern in this.patternStreaks) {
            this.patternStreaks[pattern] = 0;
        }
        
        for (let i = 1; i < history.length; i++) {
            const prevGroup = history[i-1].group;
            const currGroup = history[i].group;
            const patternKey = `${prevGroup}→${currGroup}`;
            
            if (this.patternStreaks.hasOwnProperty(patternKey)) {
                if ((prevGroup === "MEDIUM" && currGroup === "HIGH") || 
                    (prevGroup === "HIGH" && currGroup === "MEDIUM")) {
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
        const patternKey = `${previousGroup}→${currentGroup}`;
        
        if (!this.patternStreaks.hasOwnProperty(patternKey)) {
            return this.getDefaultPrediction();
        }
        
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
        
        let nextGroup = "LOW";
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
            prediction: willBreak ? "BREAK" : "CONTINUE",
            pattern: patternKey,
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
    
    getDefaultPrediction() {
        return {
            model: this.name,
            prediction: "CONTINUE",
            pattern: "MEDIUM→HIGH",
            currentStreak: 1,
            maxStreak: 17,
            remaining: 16,
            breakProbability: 5,
            nextGroup: "LOW",
            nextGroupConfidence: 50,
            confidence: 70,
            accuracy: this.accuracy
        };
    }
    
    updateWithResult(result, previousGroup) {
        const patternKey = `${previousGroup}→${result.group}`;
        
        if (this.patternStreaks.hasOwnProperty(patternKey)) {
            this.patternStreaks[patternKey]++;
        } else {
            for (let p in this.patternStreaks) {
                const streakValue = this.patternStreaks[p];
                if (streakValue > 0) {
                    this.recordBreak(p, streakValue, result.group);
                    this.calculateStats();
                }
                this.patternStreaks[p] = 0;
            }
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
            localStorage.setItem('ai_mid_high_switch_data', JSON.stringify(data));
        } catch(e) { console.warn('Save failed:', e); }
    }
    
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('ai_mid_high_switch_data');
            if (saved) {
                const data = JSON.parse(saved);
                this.patternStreaks = data.patternStreaks || this.patternStreaks;
                this.patternHistory = data.patternHistory || this.patternHistory;
                this.totalPredictions = data.totalPredictions || 0;
                this.correctPredictions = data.correctPredictions || 0;
                this.accuracy = data.accuracy || 0;
                console.log(`✅ AI-D: Loaded from storage (${this.accuracy.toFixed(1)}% accuracy)`);
            }
        } catch(e) { console.warn('Load failed:', e); }
    }
    
    printStats() {
        console.log(`📊 AI-D: Accuracy: ${this.accuracy.toFixed(1)}%`);
        for (let pattern in this.patternHistory) {
            const h = this.patternHistory[pattern];
            console.log(`   ${pattern}: max=${h.maxStreak}, avg=${h.avgStreak.toFixed(1)}`);
        }
    }
    
    getAccuracy() {
        return this.accuracy;
    }
    
    getGroupIcon(group) {
        if (group === 'LOW') return '🔴';
        if (group === 'MEDIUM') return '🟡';
        return '🟢';
    }
}

window.AI_MidHighSwitch = new AI_MidHighSwitch();
