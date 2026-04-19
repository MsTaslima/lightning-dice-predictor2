/**
 * AI-C: Low-Mid Switch Detector (FIXED VERSION)
 * 
 * ONLY tracks: LOW→MEDIUM and MEDIUM→LOW (NO other patterns)
 * 
 * NEW LOGIC:
 * - Tracks streak lengths from 2 to 18 for EACH pattern separately
 * - Learns what comes AFTER the switch breaks
 * - Predicts the MOSTLY occurring group for each pattern + length
 * - If no specific data → predicts HIGH (as instructed)
 * - If pattern mismatch (not LOW→MEDIUM or MEDIUM→LOW) → predicts HIGH with low confidence
 * - Real-time learning, NO random predictions
 */

class AI_LowMidSwitch {
    constructor() {
        this.name = "AI-LowMidSwitch (Fixed)";
        this.patterns = ['LOW→MEDIUM', 'MEDIUM→LOW'];
        
        // Data structure for each pattern and each streak length (2 to 18)
        // This stores ONLY switch break data (what comes AFTER the switch)
        this.switchData = {
            "LOW→MEDIUM": {},
            "MEDIUM→LOW": {}
        };
        
        // Initialize data for lengths 2 through 18 for both patterns
        for (let len = 2; len <= 18; len++) {
            this.switchData["LOW→MEDIUM"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.switchData["MEDIUM→LOW"][len] = {
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
        console.log('🤖 AI-C (Low-Mid Switch) FIXED VERSION Initializing...');
        console.log('   ✅ Tracks ONLY: LOW→MEDIUM and MEDIUM→LOW');
        console.log('   ✅ NO stick tracking, NO extreme switch, NO mid-high switch');
        console.log('   ✅ Tracks streak lengths 2-18 for EACH pattern separately');
        console.log('   ✅ Learns what comes AFTER the switch breaks');
        console.log('   ✅ Predicts MOSTLY occurring group');
        console.log('   ✅ No specific data → predicts HIGH (as instructed)');
        console.log('   ✅ Pattern mismatch → predicts HIGH with 30% confidence');
        this.loadFromStorage();
    }
    
    /**
     * Train from historical data (optional, for initial load)
     * Real-time learning happens via updateWithResult()
     */
    train(history) {
        if (!history || history.length < 3) return false;
        
        console.log(`📚 AI-C: Training with ${history.length} historical results...`);
        
        // Reset all data
        for (let len = 2; len <= 18; len++) {
            this.switchData["LOW→MEDIUM"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.switchData["MEDIUM→LOW"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        
        // Process history to find LOW-MID switch patterns
        let tempPattern = null;
        let tempStreak = 0;
        
        for (let i = 1; i < history.length; i++) {
            const prevGroup = history[i-1].group;
            const currGroup = history[i].group;
            const patternKey = `${prevGroup}→${currGroup}`;
            
            // Check if this is a LOW-MID switch pattern
            if (patternKey === "LOW→MEDIUM" || patternKey === "MEDIUM→LOW") {
                if (tempPattern === patternKey) {
                    // Same pattern continues
                    tempStreak++;
                } else {
                    // Pattern changed or new pattern started
                    if (tempPattern !== null && tempStreak >= 2 && tempStreak <= 18) {
                        // Record break for the previous pattern
                        this.recordBreak(tempPattern, tempStreak, currGroup);
                    }
                    // Start new pattern
                    tempPattern = patternKey;
                    tempStreak = 1;
                }
            } else {
                // Not a LOW-MID switch pattern
                if (tempPattern !== null && tempStreak >= 2 && tempStreak <= 18) {
                    // Record break for the previous pattern
                    this.recordBreak(tempPattern, tempStreak, currGroup);
                }
                // Reset tracking
                tempPattern = null;
                tempStreak = 0;
            }
        }
        
        this.saveToStorage();
        this.printStats();
        
        return true;
    }
    
    /**
     * Record a break event for a specific pattern and streak length
     */
    recordBreak(pattern, streakLength, nextGroup) {
        if (streakLength >= 2 && streakLength <= 18) {
            if (this.switchData[pattern] && this.switchData[pattern][streakLength]) {
                this.switchData[pattern][streakLength].totalBreaks++;
                this.switchData[pattern][streakLength].nextGroups[nextGroup]++;
            }
        }
    }
    
    /**
     * Get the MOSTLY occurring group for a specific pattern and streak length
     * Returns null if no data available
     */
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
    
    /**
     * Get confidence for a specific prediction
     * Confidence = (count_of_mostly / total_breaks) * 100
     */
    getConfidenceForSwitch(pattern, streakLength, predictedGroup) {
        if (streakLength < 2 || streakLength > 18) return 30;
        if (!this.switchData[pattern] || !this.switchData[pattern][streakLength]) return 30;
        
        const data = this.switchData[pattern][streakLength];
        if (data.totalBreaks === 0) return 30;
        
        const count = data.nextGroups[predictedGroup] || 0;
        return Math.round((count / data.totalBreaks) * 100);
    }
    
    /**
     * MAIN PREDICTION METHOD
     * Follows your exact requirements:
     * - ONLY handles LOW→MEDIUM and MEDIUM→LOW patterns
     * - Uses specific pattern+length data if available
     * - If no specific data → predicts HIGH (as instructed)
     * - If pattern mismatch → predicts HIGH with low confidence
     */
    predict(currentGroup, previousGroup) {
        const patternKey = `${previousGroup}→${currentGroup}`;
        
        // CASE 1: Not a LOW-MID switch pattern
        if (patternKey !== "LOW→MEDIUM" && patternKey !== "MEDIUM→LOW") {
            return {
                model: this.name,
                prediction: "DEFAULT",
                pattern: patternKey,
                currentGroup: currentGroup,
                previousGroup: previousGroup,
                currentStreak: 0,
                nextGroup: "HIGH",
                nextGroupConfidence: 30,
                confidence: 30,
                reason: "Pattern mismatch (not LOW→MEDIUM or MEDIUM→LOW), defaulting to HIGH with 30% confidence",
                accuracy: this.accuracy
            };
        }
        
        // Get current streak length from memory
        let currentStreak = this.getCurrentStreakFromMemory(patternKey);
        
        // For prediction, we look at what happens AFTER this streak
        const streakLength = currentStreak;
        
        let predictedGroup = null;
        let confidence = 0;
        let hasSpecificData = false;
        
        // Try to get mostly group for this specific pattern + streak length
        if (streakLength >= 2 && streakLength <= 18) {
            predictedGroup = this.getMostlyGroupForSwitch(patternKey, streakLength);
            if (predictedGroup) {
                hasSpecificData = true;
                confidence = this.getConfidenceForSwitch(patternKey, streakLength, predictedGroup);
            }
        }
        
        // FALLBACK: If no specific data, use HIGH (as instructed)
        if (!predictedGroup) {
            predictedGroup = "HIGH";  // ← Your instruction: নির্দিষ্ট ডাটা নেই → HIGH
            confidence = 40;          // Default confidence for fallback
            hasSpecificData = false;
        }
        
        // Determine prediction type (CONTINUE or BREAK)
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
                : `No specific data for ${streakLength}x ${patternKey}, using HIGH as instructed (40% confidence)`,
            accuracy: this.accuracy
        };
    }
    
    /**
     * Track current streak from memory
     * Updated in updateWithResult()
     */
    getCurrentStreakFromMemory(patternKey) {
        if (this.currentPattern === patternKey) {
            return this.currentStreak;
        }
        return 1;  // New pattern starts at 1
    }
    
    /**
     * UPDATE WITH ACTUAL RESULT (Real-time learning happens here)
     * This only learns from switch breaks, NOT from sticks
     */
    updateWithResult(result, previousGroup) {
        const resultGroup = result.group;
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        // Check if this is a LOW-MID switch pattern
        const isLowMidSwitch = (patternKey === "LOW→MEDIUM" || patternKey === "MEDIUM→LOW");
        
        if (isLowMidSwitch) {
            // Same pattern continues
            if (this.currentPattern === patternKey) {
                this.currentStreak++;
            } else {
                // New pattern started
                this.currentPattern = patternKey;
                this.currentStreak = 1;
            }
        } else {
            // NOT a LOW-MID switch pattern
            // This means the switch pattern broke!
            if (this.currentPattern !== null && this.currentStreak >= 2 && this.currentStreak <= 18) {
                // Record what happened AFTER the switch broke
                this.recordBreak(this.currentPattern, this.currentStreak, resultGroup);
                console.log(`📝 AI-C learned: After ${this.currentStreak}x ${this.currentPattern} → ${resultGroup}`);
            }
            // Reset tracking
            this.currentPattern = null;
            this.currentStreak = 0;
        }
        
        // Save to localStorage
        this.saveToStorage();
    }
    
    /**
     * Record prediction result (for accuracy tracking)
     */
    recordPredictionResult(correct) {
        this.totalPredictions++;
        if (correct) this.correctPredictions++;
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
        this.saveToStorage();
    }
    
    /**
     * Save all data to localStorage
     */
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
            localStorage.setItem('ai_low_mid_switch_fixed_data', JSON.stringify(data));
        } catch(e) { 
            console.warn('Save failed:', e); 
        }
    }
    
    /**
     * Load data from localStorage
     */
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('ai_low_mid_switch_fixed_data');
            if (saved) {
                const data = JSON.parse(saved);
                this.switchData = data.switchData || this.switchData;
                this.currentPattern = data.currentPattern || null;
                this.currentStreak = data.currentStreak || 0;
                this.totalPredictions = data.totalPredictions || 0;
                this.correctPredictions = data.correctPredictions || 0;
                this.accuracy = data.accuracy || 0;
                console.log(`✅ AI-C: Loaded from storage (${this.accuracy.toFixed(1)}% accuracy)`);
                this.printStats();
            }
        } catch(e) { 
            console.warn('Load failed:', e); 
        }
    }
    
    /**
     * Print statistics for debugging
     */
    printStats() {
        console.log(`📊 AI-C (Low-Mid Switch) Stats:`);
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
        console.log(`   Default (no data): HIGH with 40% confidence`);
        console.log(`   Pattern mismatch: HIGH with 30% confidence`);
    }
    
    /**
     * Public getters
     */
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
    
    /**
     * Load patterns from server (for sync)
     */
    loadFromServer(patterns) {
        if (patterns && patterns.switchData) {
            this.switchData = patterns.switchData;
            console.log(`✅ ${this.name}: Loaded patterns from server`);
        }
    }
    
    /**
     * Export for server sync
     */
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

// Create global instance
window.AI_LowMidSwitch = new AI_LowMidSwitch();
