/**
 * AI-A: Stick Pattern Detector (FIXED VERSION)
 * Tracks: LOW→LOW, MEDIUM→MEDIUM, HIGH→HIGH
 * 
 * NEW LOGIC:
 * - Tracks streak lengths from 2 to 18 (no number skipped)
 * - Learns what comes AFTER a streak breaks (NOT the switch itself)
 * - Predicts the MOSTLY occurring group for each streak length
 * - If streak not happening (switch already occurred) → default MEDIUM with low confidence
 * - Real-time learning, no pre-loaded history needed
 */

class AI_Stick {
    constructor() {
        this.name = "AI-Stick (Fixed)";
        this.groups = ['LOW', 'MEDIUM', 'HIGH'];
        
        // Current streak tracking
        this.currentStreak = 0;
        this.currentStreakGroup = null;
        
        // Data structure for streak length 2 to 18
        // Each streak length stores: how many times it broke, and what came after
        this.streakLengthData = {};
        
        // Initialize data structure for lengths 2 through 18
        for (let len = 2; len <= 18; len++) {
            this.streakLengthData[len] = {
                totalBreaks: 0,
                nextGroups: {
                    "LOW": 0,
                    "MEDIUM": 0,
                    "HIGH": 0
                }
            };
        }
        
        // Global fallback (in case no data for a specific length)
        this.globalFallback = {
            totalBreaks: 0,
            nextGroups: {
                "LOW": 0,
                "MEDIUM": 0,
                "HIGH": 0
            }
        };
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        
        this.init();
    }
    
    init() {
        console.log('🤖 AI-A (Stick Detector) FIXED VERSION Initializing...');
        console.log('   ✅ Tracks streak lengths 2-18');
        console.log('   ✅ Learns what comes AFTER each streak length');
        console.log('   ✅ Predicts MOSTLY occurring group');
        console.log('   ✅ Real-time learning');
        this.loadFromStorage();
    }
    
    /**
     * Train from historical data (optional, for initial load)
     * Real-time learning happens via updateWithResult()
     */
    train(history) {
        if (!history || history.length < 3) return false;
        
        console.log(`📚 AI-A: Training with ${history.length} historical results...`);
        
        // Reset streak data
        for (let len = 2; len <= 18; len++) {
            this.streakLengthData[len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        this.globalFallback = {
            totalBreaks: 0,
            nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        // Process history to find streak patterns
        let tempStreak = 1;
        let tempStreakGroup = null;
        
        for (let i = 1; i < history.length; i++) {
            const prevGroup = history[i-1].group;
            const currGroup = history[i].group;
            
            if (tempStreakGroup === null) {
                tempStreakGroup = prevGroup;
            }
            
            if (prevGroup === currGroup && tempStreakGroup === prevGroup) {
                // Same group continues - streak increases
                tempStreak++;
            } else {
                // Streak broke! Record what happened
                const streakLength = tempStreak;
                
                // Only record if streak length is between 2 and 18
                if (streakLength >= 2 && streakLength <= 18) {
                    this.recordBreak(streakLength, currGroup);
                }
                
                // Also record in global fallback
                this.globalFallback.totalBreaks++;
                this.globalFallback.nextGroups[currGroup]++;
                
                // Reset streak with new group
                tempStreak = 1;
                tempStreakGroup = currGroup;
            }
        }
        
        this.saveToStorage();
        this.printStats();
        
        return true;
    }
    
    /**
     * Record a break event for a specific streak length
     */
    recordBreak(streakLength, nextGroup) {
        if (streakLength >= 2 && streakLength <= 18) {
            this.streakLengthData[streakLength].totalBreaks++;
            this.streakLengthData[streakLength].nextGroups[nextGroup]++;
        }
        // Also update global
        this.globalFallback.totalBreaks++;
        this.globalFallback.nextGroups[nextGroup]++;
    }
    
    /**
     * Get the MOSTLY occurring group for a given streak length
     * Returns null if no data available
     */
    getMostlyGroupForStreak(streakLength) {
        if (streakLength < 2 || streakLength > 18) return null;
        
        const data = this.streakLengthData[streakLength];
        if (data.totalBreaks === 0) return null;
        
        let maxCount = 0;
        let mostlyGroup = null;
        
        for (let group of this.groups) {
            if (data.nextGroups[group] > maxCount) {
                maxCount = data.nextGroups[group];
                mostlyGroup = group;
            }
        }
        
        return mostlyGroup;
    }
    
    /**
     * Get confidence for a prediction
     * Confidence = (count_of_mostly / total_breaks) * 100
     */
    getConfidenceForStreak(streakLength, predictedGroup) {
        if (streakLength < 2 || streakLength > 18) return 30;
        
        const data = this.streakLengthData[streakLength];
        if (data.totalBreaks === 0) return 30;
        
        const count = data.nextGroups[predictedGroup] || 0;
        return Math.round((count / data.totalBreaks) * 100);
    }
    
    /**
     * Get global mostly group (fallback when no data for specific length)
     */
    getGlobalMostlyGroup() {
        if (this.globalFallback.totalBreaks === 0) return "MEDIUM";
        
        let maxCount = 0;
        let mostlyGroup = "MEDIUM";
        
        for (let group of this.groups) {
            if (this.globalFallback.nextGroups[group] > maxCount) {
                maxCount = this.globalFallback.nextGroups[group];
                mostlyGroup = group;
            }
        }
        
        return mostlyGroup;
    }
    
    /**
     * Get global confidence (fallback)
     */
    getGlobalConfidence(predictedGroup) {
        if (this.globalFallback.totalBreaks === 0) return 30;
        
        const count = this.globalFallback.nextGroups[predictedGroup] || 0;
        return Math.round((count / this.globalFallback.totalBreaks) * 100);
    }
    
    /**
     * MAIN PREDICTION METHOD
     * Follows your exact requirements:
     * - If sticking (same group continues) → use streak length data → predict MOSTLY group
     * - If not sticking (switch already happened) → default MEDIUM with low confidence
     */
    predict(currentGroup, previousGroup) {
        // CASE 1: Not sticking (switch already happened)
        if (currentGroup !== previousGroup) {
            return {
                model: this.name,
                prediction: "SWITCH (Default)",
                currentGroup: currentGroup,
                previousGroup: previousGroup,
                currentStreak: 0,
                nextGroup: "MEDIUM",
                nextGroupConfidence: 30,
                confidence: 30,
                breakProbability: 50,
                reason: "Pattern already broken, defaulting to MEDIUM with low confidence",
                accuracy: this.accuracy
            };
        }
        
        // CASE 2: Sticking (same group continues)
        // First, get current streak length from the system
        let currentStreak = this.getCurrentStreakFromMemory(previousGroup, currentGroup);
        
        // If we don't have streak tracked, start at 1 (will be updated after result)
        if (currentStreak === 0) {
            currentStreak = 1;
        }
        
        // For prediction, we need to know what happens AFTER this streak
        // So we look at data for the current streak length
        const streakLength = currentStreak;
        
        let predictedGroup = null;
        let confidence = 0;
        let mostlyDataExists = false;
        
        // Try to get mostly group for this specific streak length
        if (streakLength >= 2 && streakLength <= 18) {
            predictedGroup = this.getMostlyGroupForStreak(streakLength);
            if (predictedGroup) {
                mostlyDataExists = true;
                confidence = this.getConfidenceForStreak(streakLength, predictedGroup);
            }
        }
        
        // Fallback: use global data if no specific length data
        if (!predictedGroup) {
            predictedGroup = this.getGlobalMostlyGroup();
            confidence = this.getGlobalConfidence(predictedGroup);
            mostlyDataExists = false;
        }
        
        // Determine if this is a STICK or SWITCH prediction
        const predictionType = (predictedGroup === currentGroup) ? "STICK" : "SWITCH";
        
        return {
            model: this.name,
            prediction: predictionType,
            currentGroup: currentGroup,
            previousGroup: previousGroup,
            currentStreak: currentStreak,
            nextGroup: predictedGroup,
            nextGroupConfidence: confidence,
            confidence: confidence,
            breakProbability: 100 - confidence,
            hasSpecificData: mostlyDataExists,
            reason: mostlyDataExists 
                ? `After ${streakLength} stick(s, mostly ${predictedGroup} (${confidence}% confidence)`
                : `No data for ${streakLength} sticks yet, using global data → ${predictedGroup}`,
            accuracy: this.accuracy
        };
    }
    
    /**
     * Track current streak from memory
     * This is updated in updateWithResult()
     */
    getCurrentStreakFromMemory(previousGroup, currentGroup) {
        // If this is a new streak, return 1
        if (this.currentStreakGroup !== previousGroup) {
            return 1;
        }
        return this.currentStreak;
    }
    
    /**
     * UPDATE WITH ACTUAL RESULT (Real-time learning happens here)
     */
    updateWithResult(result, previousGroup) {
        const resultGroup = result.group;
        
        // Update streak tracking
        if (previousGroup === resultGroup) {
            // Streak continues
            if (this.currentStreakGroup === previousGroup) {
                this.currentStreak++;
            } else {
                // New streak started
                this.currentStreak = 1;
                this.currentStreakGroup = previousGroup;
            }
        } else {
            // Streak broke! Record what happened
            const streakLength = this.currentStreak;
            
            // Record break for this streak length (if between 2 and 18)
            if (streakLength >= 2 && streakLength <= 18) {
                this.recordBreak(streakLength, resultGroup);
                console.log(`📝 AI-A learned: After ${streakLength} ${this.currentStreakGroup}(s) → ${resultGroup}`);
            }
            
            // Also record for global fallback
            this.globalFallback.totalBreaks++;
            this.globalFallback.nextGroups[resultGroup]++;
            
            // Reset streak
            this.currentStreak = 1;
            this.currentStreakGroup = resultGroup;
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
                streakLengthData: this.streakLengthData,
                globalFallback: this.globalFallback,
                currentStreak: this.currentStreak,
                currentStreakGroup: this.currentStreakGroup,
                totalPredictions: this.totalPredictions,
                correctPredictions: this.correctPredictions,
                accuracy: this.accuracy
            };
            localStorage.setItem('ai_stick_fixed_data', JSON.stringify(data));
        } catch(e) { 
            console.warn('Save failed:', e); 
        }
    }
    
    /**
     * Load data from localStorage
     */
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('ai_stick_fixed_data');
            if (saved) {
                const data = JSON.parse(saved);
                this.streakLengthData = data.streakLengthData || this.streakLengthData;
                this.globalFallback = data.globalFallback || this.globalFallback;
                this.currentStreak = data.currentStreak || 0;
                this.currentStreakGroup = data.currentStreakGroup || null;
                this.totalPredictions = data.totalPredictions || 0;
                this.correctPredictions = data.correctPredictions || 0;
                this.accuracy = data.accuracy || 0;
                console.log(`✅ AI-A: Loaded from storage (${this.accuracy.toFixed(1)}% accuracy)`);
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
        console.log(`📊 AI-A (Fixed) Stats:`);
        console.log(`   Accuracy: ${this.accuracy.toFixed(1)}%`);
        console.log(`   Total Predictions: ${this.totalPredictions}`);
        console.log(`   Data collected for streak lengths:`);
        
        let hasData = false;
        for (let len = 2; len <= 18; len++) {
            if (this.streakLengthData[len].totalBreaks > 0) {
                hasData = true;
                const data = this.streakLengthData[len];
                console.log(`   Length ${len}: ${data.totalBreaks} breaks → Mostly: ${this.getMostlyGroupForStreak(len)}`);
            }
        }
        if (!hasData) {
            console.log(`   (No break data collected yet - waiting for streaks to break)`);
        }
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
        if (patterns && patterns.streakLengthData) {
            this.streakLengthData = patterns.streakLengthData;
            this.globalFallback = patterns.globalFallback || this.globalFallback;
            console.log(`✅ ${this.name}: Loaded patterns from server`);
        }
    }
    
    /**
     * Export for server sync
     */
    exportForServer() {
        return {
            streakLengthData: this.streakLengthData,
            globalFallback: this.globalFallback,
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
window.AI_Stick = new AI_Stick();
