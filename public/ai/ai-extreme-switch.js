/**
 * AI-B: Extreme Switch Detector (FIXED VERSION)
 * 
 * ONLY tracks: LOW→HIGH and HIGH→LOW
 * 
 * LOGIC:
 * - Tracks streak lengths from 2 to 18 for EACH pattern separately
 * - Learns what comes AFTER the switch breaks
 * - Predicts the MOSTLY occurring group for each pattern + length
 * - If no specific data → predicts MEDIUM (40% confidence)
 * - If pattern mismatch → predicts MEDIUM (30% confidence)
 * - Real-time learning, NO random predictions
 */

class AI_ExtremeSwitch {
    constructor() {
        this.name = "AI-ExtremeSwitch (Fixed)";
        this.patterns = ['LOW→HIGH', 'HIGH→LOW'];
        
        // Data structure for each pattern and each streak length (2 to 18)
        this.switchData = {
            "LOW→HIGH": {},
            "HIGH→LOW": {}
        };
        
        // Initialize data for lengths 2 through 18 for both patterns
        for (let len = 2; len <= 18; len++) {
            this.switchData["LOW→HIGH"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.switchData["HIGH→LOW"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        
        // Current streak tracking (for real-time learning)
        this.currentPattern = null;      // Which pattern is currently active
        this.currentStreak = 0;          // How many times this pattern has occurred consecutively
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        
        this.init();
    }
    
    init() {
        console.log('🤖 AI-B (Extreme Switch) FIXED VERSION Initializing...');
        console.log('   ✅ Tracks ONLY: LOW→HIGH and HIGH→LOW');
        console.log('   ✅ Tracks streak lengths 2-18 for EACH pattern separately');
        console.log('   ✅ Learns what comes AFTER the switch breaks');
        console.log('   ✅ Predicts MOSTLY occurring group');
        console.log('   ✅ No specific data → predicts MEDIUM (40% confidence)');
        console.log('   ✅ Pattern mismatch → predicts MEDIUM (30% confidence)');
        this.loadFromStorage();
    }
    
    train(history) {
        if (!history || history.length < 3) return false;
        
        console.log(`📚 AI-B: Training with ${history.length} historical results...`);
        
        // Reset all data
        for (let len = 2; len <= 18; len++) {
            this.switchData["LOW→HIGH"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.switchData["HIGH→LOW"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        
        let tempPattern = null;
        let tempStreak = 0;
        
        for (let i = 1; i < history.length; i++) {
            const prevGroup = history[i-1].group;
            const currGroup = history[i].group;
            const patternKey = `${prevGroup}→${currGroup}`;
            
            if (patternKey === "LOW→HIGH" || patternKey === "HIGH→LOW") {
                if (tempPattern === patternKey) {
                    tempStreak++;
                } else {
                    if (tempPattern !== null && tempStreak >= 2 && tempStreak <= 18) {
                        this.recordBreak(tempPattern, tempStreak, currGroup);
                    }
                    tempPattern = patternKey;
                    tempStreak = 1;
                }
            } else {
                if (tempPattern !== null && tempStreak >= 2 && tempStreak <= 18) {
                    this.recordBreak(tempPattern, tempStreak, currGroup);
                }
                tempPattern = null;
                tempStreak = 0;
            }
        }
        
        this.saveToStorage();
        this.printStats();
        return true;
    }
    
    recordBreak(pattern, streakLength, nextGroup) {
        if (streakLength >= 2 && streakLength <= 18) {
            if (this.switchData[pattern] && this.switchData[pattern][streakLength]) {
                this.switchData[pattern][streakLength].totalBreaks++;
                this.switchData[pattern][streakLength].nextGroups[nextGroup]++;
            }
        }
    }
    
    getMostlyGroupForSwitch(pattern, streakLength) {
        if (streakLength < 2 || streakLength > 18) return null;
        if (!this.switchData[pattern] || !this.switchData[pattern][streakLength]) return null;
        
        const data = this.switchData[pattern][streakLength];
        if (data.totalBreaks === 0) return null;
        
        let maxCount = 0;
        let mostlyGroup = null;
        
        const groups = ["LOW", "MEDIUM", "HIGH"];
        for (let group of groups) {
            if (data.nextGroups[group] > maxCount) {
                maxCount = data.nextGroups[group];
                mostlyGroup = group;
            }
        }
        
        return mostlyGroup;
    }
    
    getConfidenceForSwitch(pattern, streakLength, predictedGroup) {
        if (streakLength < 2 || streakLength > 18) return 30;
        if (!this.switchData[pattern] || !this.switchData[pattern][streakLength]) return 30;
        
        const data = this.switchData[pattern][streakLength];
        if (data.totalBreaks === 0) return 30;
        
        const count = data.nextGroups[predictedGroup] || 0;
        return Math.round((count / data.totalBreaks) * 100);
    }
    
    predict(currentGroup, previousGroup) {
        const patternKey = `${previousGroup}→${currentGroup}`;
        
        // CASE 1: Pattern mismatch (not LOW→HIGH or HIGH→LOW)
        if (patternKey !== "LOW→HIGH" && patternKey !== "HIGH→LOW") {
            return {
                model: this.name,
                prediction: "DEFAULT",
                pattern: patternKey,
                currentGroup: currentGroup,
                previousGroup: previousGroup,
                currentStreak: 0,
                nextGroup: "MEDIUM",
                nextGroupConfidence: 30,
                confidence: 30,
                reason: "Pattern mismatch (not LOW→HIGH or HIGH→LOW), defaulting to MEDIUM",
                accuracy: this.accuracy
            };
        }
        
        let currentStreak = this.getCurrentStreakFromMemory(patternKey);
        const streakLength = currentStreak;
        
        let predictedGroup = null;
        let confidence = 0;
        let hasSpecificData = false;
        
        if (streakLength >= 2 && streakLength <= 18) {
            predictedGroup = this.getMostlyGroupForSwitch(patternKey, streakLength);
            if (predictedGroup) {
                hasSpecificData = true;
                confidence = this.getConfidenceForSwitch(patternKey, streakLength, predictedGroup);
            }
        }
        
        // FALLBACK: If no specific data, use MEDIUM (as instructed)
        if (!predictedGroup) {
            predictedGroup = "MEDIUM";
            confidence = 40;
            hasSpecificData = false;
        }
        
        const predictionType = (predictedGroup === currentGroup) ? "CONTINUE" : "BREAK";
        
        return {
            model: this.name,
            prediction: predictionType,
            pattern: patternKey,
            currentGroup: currentGroup,
            previousGroup: previousGroup,
            currentStreak: streakLength,
            nextGroup: predictedGroup,
            nextGroupConfidence: confidence,
            confidence: confidence,
            breakProbability: 100 - confidence,
            hasSpecificData: hasSpecificData,
            reason: hasSpecificData 
                ? `After ${streakLength}x ${patternKey}, mostly ${predictedGroup} (${confidence}% confidence)`
                : `No specific data for ${streakLength}x ${patternKey}, using MEDIUM as instructed (40% confidence)`,
            accuracy: this.accuracy
        };
    }
    
    getCurrentStreakFromMemory(patternKey) {
        if (this.currentPattern === patternKey) {
            return this.currentStreak;
        }
        return 1;
    }
    
    updateWithResult(result, previousGroup) {
        const resultGroup = result.group;
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        const isExtremeSwitch = (patternKey === "LOW→HIGH" || patternKey === "HIGH→LOW");
        
        if (isExtremeSwitch) {
            if (this.currentPattern === patternKey) {
                this.currentStreak++;
            } else {
                this.currentPattern = patternKey;
                this.currentStreak = 1;
            }
        } else {
            if (this.currentPattern !== null && this.currentStreak >= 2 && this.currentStreak <= 18) {
                this.recordBreak(this.currentPattern, this.currentStreak, resultGroup);
                console.log(`📝 AI-B learned: After ${this.currentStreak}x ${this.currentPattern} → ${resultGroup}`);
            }
            this.currentPattern = null;
            this.currentStreak = 0;
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
                switchData: this.switchData,
                currentPattern: this.currentPattern,
                currentStreak: this.currentStreak,
                totalPredictions: this.totalPredictions,
                correctPredictions: this.correctPredictions,
                accuracy: this.accuracy
            };
            localStorage.setItem('ai_extreme_switch_fixed_data', JSON.stringify(data));
        } catch(e) { 
            console.warn('Save failed:', e); 
        }
    }
    
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('ai_extreme_switch_fixed_data');
            if (saved) {
                const data = JSON.parse(saved);
                this.switchData = data.switchData || this.switchData;
                this.currentPattern = data.currentPattern || null;
                this.currentStreak = data.currentStreak || 0;
                this.totalPredictions = data.totalPredictions || 0;
                this.correctPredictions = data.correctPredictions || 0;
                this.accuracy = data.accuracy || 0;
                console.log(`✅ AI-B: Loaded from storage (${this.accuracy.toFixed(1)}% accuracy)`);
                this.printStats();
            }
        } catch(e) { 
            console.warn('Load failed:', e); 
        }
    }
    
    printStats() {
        console.log(`📊 AI-B (Extreme Switch) Stats:`);
        console.log(`   Accuracy: ${this.accuracy.toFixed(1)}%`);
        console.log(`   Total Predictions: ${this.totalPredictions}`);
        
        let hasData = false;
        for (let pattern of this.patterns) {
            for (let len = 2; len <= 18; len++) {
                if (this.switchData[pattern][len].totalBreaks > 0) {
                    hasData = true;
                    const mostly = this.getMostlyGroupForSwitch(pattern, len);
                    console.log(`   ${pattern} length ${len}: ${this.switchData[pattern][len].totalBreaks} breaks → Mostly: ${mostly}`);
                }
            }
        }
        if (!hasData) {
            console.log(`   (No switch break data collected yet - waiting for patterns to break)`);
        }
        console.log(`   Default (no data): MEDIUM with 40% confidence`);
        console.log(`   Pattern mismatch: MEDIUM with 30% confidence`);
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
        if (patterns && patterns.switchData) {
            this.switchData = patterns.switchData;
            console.log(`✅ ${this.name}: Loaded patterns from server`);
        }
    }
    
    exportForServer() {
        return {
            switchData: this.switchData,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
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
        if (group === 'HIGH') return '🟢';
        return '⚪';
    }
}

window.AI_ExtremeSwitch = new AI_ExtremeSwitch();
