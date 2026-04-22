// ============================================================
// server-ai-logic.js (COMPLETE FIXED VERSION)
// Four AI Pattern Recognition System - Server Side
// ============================================================

/**
 * AI-A: Stick Pattern Detector (Server Version)
 * Tracks: LOW→LOW, MEDIUM→MEDIUM, HIGH→HIGH
 * Learns what comes AFTER a streak breaks
 * Predicts the MOSTLY occurring group for each streak length
 */
class ServerAI_Stick {
    constructor() {
        this.name = "AI_Stick";
        this.groups = ['LOW', 'MEDIUM', 'HIGH'];
        
        // Current streak tracking
        this.currentStreak = 0;
        this.currentStreakGroup = null;
        
        // Data structure for streak length 2 to 18
        this.streakLengthData = {};
        
        // Initialize data for lengths 2 through 18
        for (let len = 2; len <= 18; len++) {
            this.streakLengthData[len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        
        // Global fallback (when no data for specific length)
        this.globalFallback = {
            totalBreaks: 0,
            nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }
    
    init() {
        console.log('🤖 Server AI-A (Stick) initialized - Tracks: LOW→LOW, MEDIUM→MEDIUM, HIGH→HIGH');
    }
    
    /**
     * Train from historical data
     */
    train(history) {
        if (!history || history.length < 3) return false;
        
        console.log(`📚 Server AI-A: Training with ${history.length} historical results...`);
        
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
                tempStreak++;
            } else {
                // Streak broke!
                const streakLength = tempStreak;
                
                if (streakLength >= 2 && streakLength <= 18) {
                    this.recordBreak(streakLength, currGroup);
                }
                
                this.globalFallback.totalBreaks++;
                this.globalFallback.nextGroups[currGroup]++;
                
                tempStreak = 1;
                tempStreakGroup = currGroup;
            }
        }
        
        return true;
    }
    
    recordBreak(streakLength, nextGroup) {
        if (streakLength >= 2 && streakLength <= 18) {
            this.streakLengthData[streakLength].totalBreaks++;
            this.streakLengthData[streakLength].nextGroups[nextGroup]++;
        }
        this.globalFallback.totalBreaks++;
        this.globalFallback.nextGroups[nextGroup]++;
    }
    
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
    
    getConfidenceForStreak(streakLength, predictedGroup) {
        if (streakLength < 2 || streakLength > 18) return 30;
        
        const data = this.streakLengthData[streakLength];
        if (data.totalBreaks === 0) return 30;
        
        const count = data.nextGroups[predictedGroup] || 0;
        return Math.round((count / data.totalBreaks) * 100);
    }
    
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
    
    getGlobalConfidence(predictedGroup) {
        if (this.globalFallback.totalBreaks === 0) return 30;
        
        const count = this.globalFallback.nextGroups[predictedGroup] || 0;
        return Math.round((count / this.globalFallback.totalBreaks) * 100);
    }
    
    getCurrentStreakFromMemory(previousGroup, currentGroup) {
        if (this.currentStreakGroup !== previousGroup) {
            return 1;
        }
        return this.currentStreak;
    }
    
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
        let currentStreak = this.getCurrentStreakFromMemory(previousGroup, currentGroup);
        if (currentStreak === 0) currentStreak = 1;
        
        const streakLength = currentStreak;
        
        let predictedGroup = null;
        let confidence = 0;
        let mostlyDataExists = false;
        
        if (streakLength >= 2 && streakLength <= 18) {
            predictedGroup = this.getMostlyGroupForStreak(streakLength);
            if (predictedGroup) {
                mostlyDataExists = true;
                confidence = this.getConfidenceForStreak(streakLength, predictedGroup);
            }
        }
        
        // Fallback: use global data
        if (!predictedGroup) {
            predictedGroup = this.getGlobalMostlyGroup();
            confidence = this.getGlobalConfidence(predictedGroup);
            mostlyDataExists = false;
        }
        
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
                ? `After ${streakLength} stick(s), mostly ${predictedGroup} (${confidence}% confidence)`
                : `No data for ${streakLength} sticks yet, using global → ${predictedGroup}`,
            accuracy: this.accuracy
        };
    }
    
    updateWithResult(resultGroup, previousGroup) {
        // Update streak tracking
        if (previousGroup === resultGroup) {
            if (this.currentStreakGroup === previousGroup) {
                this.currentStreak++;
            } else {
                this.currentStreak = 1;
                this.currentStreakGroup = previousGroup;
            }
        } else {
            const streakLength = this.currentStreak;
            
            if (streakLength >= 2 && streakLength <= 18) {
                this.recordBreak(streakLength, resultGroup);
            }
            
            this.globalFallback.totalBreaks++;
            this.globalFallback.nextGroups[resultGroup]++;
            
            this.currentStreak = 1;
            this.currentStreakGroup = resultGroup;
        }
    }
    
    recordPredictionResult(correct) {
        this.totalPredictions++;
        if (correct) this.correctPredictions++;
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
    }
    
    getAccuracy() { return this.accuracy || 0; }
    
    loadFromData(data) {
        if (data) {
            this.streakLengthData = data.streakLengthData || this.streakLengthData;
            this.globalFallback = data.globalFallback || this.globalFallback;
            this.currentStreak = data.currentStreak || 0;
            this.currentStreakGroup = data.currentStreakGroup || null;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
        }
    }
    
    exportForServer() {
        return {
            streakLengthData: this.streakLengthData,
            globalFallback: this.globalFallback,
            currentStreak: this.currentStreak,
            currentStreakGroup: this.currentStreakGroup,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * AI-B: Extreme Switch Detector (REFACTORED)
 * 
 * NEW LOGIC:
 * - Tracks alternating patterns: HIGH→LOW→HIGH→LOW... and LOW→HIGH→LOW→HIGH...
 * - Streak length 1 to 18 (number of alternations)
 * - Learns what comes AFTER the alternating pattern
 * - When pattern matches → predict based on streak length data
 * - When pattern doesn't match → predict based on break data of that pattern
 */
class ServerAI_ExtremeSwitch {
    constructor() {
        this.name = "AI_ExtremeSwitch";
        this.groups = ['LOW', 'MEDIUM', 'HIGH'];
        
        // Two patterns to track
        this.patterns = {
            "HIGH→LOW": {},    // Alternating starting with HIGH→LOW
            "LOW→HIGH": {}     // Alternating starting with LOW→HIGH
        };
        
        // Data structure for each pattern and streak length (1 to 18)
        for (let len = 1; len <= 18; len++) {
            this.patterns["HIGH→LOW"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.patterns["LOW→HIGH"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        
        // For tracking current alternating streak
        this.currentPatternKey = null;  // Which alternating pattern is active
        this.currentStreak = 0;          // Current streak length (number of alternations)
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }
    
    init() {
        console.log('🤖 AI-B (Extreme Switch) REFACTORED - Alternating Pattern Tracker');
        console.log('   ✅ Tracks: HIGH→LOW→HIGH→LOW... and LOW→HIGH→LOW→HIGH...');
        console.log('   ✅ Streak length 1 to 18');
        console.log('   ✅ Learns what comes AFTER each streak length');
    }
    
    train(history) {
        if (!history || history.length < 3) return false;
        
        // Reset data
        for (let len = 1; len <= 18; len++) {
            this.patterns["HIGH→LOW"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.patterns["LOW→HIGH"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        
        // Process history to find alternating patterns and their breaks
        let tempPattern = null;
        let tempStreak = 0;
        
        for (let i = 2; i < history.length; i++) {
            const prevPrev = history[i-2].group;
            const prev = history[i-1].group;
            const curr = history[i].group;
            
            // Check if prevPrev → prev is an extreme switch
            const isExtreme1 = (prevPrev === 'HIGH' && prev === 'LOW') || (prevPrev === 'LOW' && prev === 'HIGH');
            
            if (isExtreme1) {
                const patternKey = `${prevPrev}→${prev}`;
                
                // Check if continuing the alternating pattern
                const expectedCurr = (patternKey === "HIGH→LOW") ? 'HIGH' : 'LOW';
                
                if (curr === expectedCurr) {
                    // Pattern continues
                    if (tempPattern === patternKey) {
                        tempStreak++;
                    } else {
                        if (tempPattern !== null && tempStreak >= 1 && tempStreak <= 18) {
                            this.recordBreak(tempPattern, tempStreak, prev);
                        }
                        tempPattern = patternKey;
                        tempStreak = 1;
                    }
                } else {
                    // Pattern broke!
                    if (tempPattern !== null && tempStreak >= 1 && tempStreak <= 18) {
                        this.recordBreak(tempPattern, tempStreak, curr);
                    }
                    tempPattern = null;
                    tempStreak = 0;
                }
            } else {
                if (tempPattern !== null && tempStreak >= 1 && tempStreak <= 18) {
                    this.recordBreak(tempPattern, tempStreak, curr);
                }
                tempPattern = null;
                tempStreak = 0;
            }
        }
        
        console.log(`✅ AI-B trained with ${history.length} results`);
        return true;
    }
    
    recordBreak(patternKey, streakLength, nextGroup) {
        if (streakLength >= 1 && streakLength <= 18) {
            if (this.patterns[patternKey] && this.patterns[patternKey][streakLength]) {
                this.patterns[patternKey][streakLength].totalBreaks++;
                this.patterns[patternKey][streakLength].nextGroups[nextGroup]++;
            }
        }
    }
    
    getMostlyGroupForPattern(patternKey, streakLength) {
        if (streakLength < 1 || streakLength > 18) return null;
        if (!this.patterns[patternKey] || !this.patterns[patternKey][streakLength]) return null;
        
        const data = this.patterns[patternKey][streakLength];
        if (data.totalBreaks === 0) return null;
        
        let maxCount = 0, mostlyGroup = null;
        for (let group of this.groups) {
            if (data.nextGroups[group] > maxCount) {
                maxCount = data.nextGroups[group];
                mostlyGroup = group;
            }
        }
        return mostlyGroup;
    }
    
    getConfidenceForPattern(patternKey, streakLength, predictedGroup) {
        if (streakLength < 1 || streakLength > 18) return 30;
        if (!this.patterns[patternKey] || !this.patterns[patternKey][streakLength]) return 30;
        
        const data = this.patterns[patternKey][streakLength];
        if (data.totalBreaks === 0) return 30;
        
        const count = data.nextGroups[predictedGroup] || 0;
        return Math.round((count / data.totalBreaks) * 100);
    }
    
    /**
     * Get the most likely next group when pattern doesn't match
     * Uses break data from all patterns
     */
    getFallbackPrediction() {
        let bestGroup = "MEDIUM";
        let bestCount = 0;
        
        for (let len = 1; len <= 18; len++) {
            for (let pKey of ["HIGH→LOW", "LOW→HIGH"]) {
                const data = this.patterns[pKey][len];
                if (data && data.nextGroups) {
                    for (let group of this.groups) {
                        if (data.nextGroups[group] > bestCount) {
                            bestCount = data.nextGroups[group];
                            bestGroup = group;
                        }
                    }
                }
            }
        }
        
        const confidence = bestCount > 0 ? Math.min(70, 30 + bestCount) : 35;
        
        return {
            nextGroup: bestGroup,
            confidence: confidence,
            hasSpecificData: false,
            reason: `Pattern not tracked, using most common outcome from break data → ${bestGroup}`
        };
    }
    
    predict(currentGroup, previousGroup) {
        // Get the pattern of last two results
        const immediatePattern = `${previousGroup}→${currentGroup}`;
        
        // Check if this matches an alternating pattern we track
        if (immediatePattern === "HIGH→LOW" || immediatePattern === "LOW→HIGH") {
            // We need to know the streak length of this alternating pattern
            let streakLength = (this.currentPatternKey === immediatePattern) ? this.currentStreak : 1;
            
            // Ensure streak length is within bounds
            streakLength = Math.min(18, Math.max(1, streakLength));
            
            let predictedGroup = this.getMostlyGroupForPattern(immediatePattern, streakLength);
            let confidence = 0;
            let hasSpecificData = false;
            
            if (predictedGroup) {
                hasSpecificData = true;
                confidence = this.getConfidenceForPattern(immediatePattern, streakLength, predictedGroup);
            } else {
                // No data for this streak length yet, use streak length 1 data or fallback
                predictedGroup = this.getMostlyGroupForPattern(immediatePattern, 1);
                if (predictedGroup) {
                    confidence = this.getConfidenceForPattern(immediatePattern, 1, predictedGroup);
                    hasSpecificData = true;
                } else {
                    predictedGroup = "MEDIUM";
                    confidence = 40;
                }
            }
            
            const predictionType = (predictedGroup === currentGroup) ? "CONTINUE" : "BREAK";
            
            return {
                model: this.name,
                prediction: predictionType,
                pattern: immediatePattern,
                currentGroup: currentGroup,
                previousGroup: previousGroup,
                currentStreak: streakLength,
                nextGroup: predictedGroup,
                nextGroupConfidence: confidence,
                confidence: confidence,
                breakProbability: 100 - confidence,
                hasSpecificData: hasSpecificData,
                reason: hasSpecificData 
                    ? `After ${streakLength}x alternating ${immediatePattern}, mostly ${predictedGroup} (${confidence}% confidence)`
                    : `No data for ${streakLength}x alternating ${immediatePattern}, using default MEDIUM`,
                accuracy: this.accuracy
            };
        }
        
        // Pattern doesn't match - use fallback
        const fallback = this.getFallbackPrediction();
        return {
            model: this.name,
            prediction: "DEFAULT",
            pattern: immediatePattern,
            currentGroup: currentGroup,
            previousGroup: previousGroup,
            currentStreak: 0,
            nextGroup: fallback.nextGroup,
            nextGroupConfidence: fallback.confidence,
            confidence: fallback.confidence,
            breakProbability: 100 - fallback.confidence,
            hasSpecificData: false,
            reason: fallback.reason,
            accuracy: this.accuracy
        };
    }
    
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        // Check if this continues an alternating pattern
        if (this.currentPatternKey === "HIGH→LOW") {
            const expectedNext = (this.currentStreak % 2 === 1) ? 'HIGH' : 'LOW';
            if (resultGroup === expectedNext) {
                // Pattern continues
                this.currentStreak++;
            } else {
                // Pattern broke - record break
                if (this.currentStreak >= 1 && this.currentStreak <= 18) {
                    this.recordBreak(this.currentPatternKey, this.currentStreak, resultGroup);
                }
                // Start new pattern if applicable
                if (patternKey === "HIGH→LOW" || patternKey === "LOW→HIGH") {
                    this.currentPatternKey = patternKey;
                    this.currentStreak = 1;
                } else {
                    this.currentPatternKey = null;
                    this.currentStreak = 0;
                }
            }
        } 
        else if (this.currentPatternKey === "LOW→HIGH") {
            const expectedNext = (this.currentStreak % 2 === 1) ? 'LOW' : 'HIGH';
            if (resultGroup === expectedNext) {
                this.currentStreak++;
            } else {
                if (this.currentStreak >= 1 && this.currentStreak <= 18) {
                    this.recordBreak(this.currentPatternKey, this.currentStreak, resultGroup);
                }
                if (patternKey === "HIGH→LOW" || patternKey === "LOW→HIGH") {
                    this.currentPatternKey = patternKey;
                    this.currentStreak = 1;
                } else {
                    this.currentPatternKey = null;
                    this.currentStreak = 0;
                }
            }
        }
        else {
            // No active pattern - check if we should start one
            if (patternKey === "HIGH→LOW" || patternKey === "LOW→HIGH") {
                this.currentPatternKey = patternKey;
                this.currentStreak = 1;
            }
        }
    }
    
    recordPredictionResult(correct) {
        this.totalPredictions++;
        if (correct) this.correctPredictions++;
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
    }
    
    getAccuracy() { return this.accuracy || 0; }
    
    loadFromData(data) {
        if (data) {
            this.patterns = data.patterns || this.patterns;
            this.currentPatternKey = data.currentPatternKey || null;
            this.currentStreak = data.currentStreak || 0;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
        }
    }
    
    exportForServer() {
        return {
            patterns: this.patterns,
            currentPatternKey: this.currentPatternKey,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * AI-C: Low-Mid Switch Detector (REFACTORED)
 * 
 * NEW LOGIC:
 * - Tracks alternating patterns: LOW→MEDIUM→LOW→MEDIUM... and MEDIUM→LOW→MEDIUM→LOW...
 * - Streak length 1 to 18 (number of alternations)
 * - Learns what comes AFTER the alternating pattern
 */
class ServerAI_LowMidSwitch {
    constructor() {
        this.name = "AI_LowMidSwitch";
        this.groups = ['LOW', 'MEDIUM', 'HIGH'];
        
        // Two patterns to track
        this.patterns = {
            "LOW→MEDIUM": {},
            "MEDIUM→LOW": {}
        };
        
        // Data structure for each pattern and streak length (1 to 18)
        for (let len = 1; len <= 18; len++) {
            this.patterns["LOW→MEDIUM"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.patterns["MEDIUM→LOW"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        
        // For tracking current alternating streak
        this.currentPatternKey = null;
        this.currentStreak = 0;
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }
    
    init() {
        console.log('🤖 AI-C (Low-Mid Switch) REFACTORED - Alternating Pattern Tracker');
        console.log('   ✅ Tracks: LOW→MEDIUM→LOW→MEDIUM... and MEDIUM→LOW→MEDIUM→LOW...');
        console.log('   ✅ Streak length 1 to 18');
    }
    
    train(history) {
        if (!history || history.length < 3) return false;
        
        for (let len = 1; len <= 18; len++) {
            this.patterns["LOW→MEDIUM"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.patterns["MEDIUM→LOW"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        
        let tempPattern = null;
        let tempStreak = 0;
        
        for (let i = 2; i < history.length; i++) {
            const prevPrev = history[i-2].group;
            const prev = history[i-1].group;
            const curr = history[i].group;
            
            const isLowMid1 = (prevPrev === 'LOW' && prev === 'MEDIUM') || (prevPrev === 'MEDIUM' && prev === 'LOW');
            
            if (isLowMid1) {
                const patternKey = `${prevPrev}→${prev}`;
                const expectedCurr = (patternKey === "LOW→MEDIUM") ? 'LOW' : 'MEDIUM';
                
                if (curr === expectedCurr) {
                    if (tempPattern === patternKey) {
                        tempStreak++;
                    } else {
                        if (tempPattern !== null && tempStreak >= 1 && tempStreak <= 18) {
                            this.recordBreak(tempPattern, tempStreak, prev);
                        }
                        tempPattern = patternKey;
                        tempStreak = 1;
                    }
                } else {
                    if (tempPattern !== null && tempStreak >= 1 && tempStreak <= 18) {
                        this.recordBreak(tempPattern, tempStreak, curr);
                    }
                    tempPattern = null;
                    tempStreak = 0;
                }
            } else {
                if (tempPattern !== null && tempStreak >= 1 && tempStreak <= 18) {
                    this.recordBreak(tempPattern, tempStreak, curr);
                }
                tempPattern = null;
                tempStreak = 0;
            }
        }
        
        return true;
    }
    
    recordBreak(patternKey, streakLength, nextGroup) {
        if (streakLength >= 1 && streakLength <= 18) {
            if (this.patterns[patternKey] && this.patterns[patternKey][streakLength]) {
                this.patterns[patternKey][streakLength].totalBreaks++;
                this.patterns[patternKey][streakLength].nextGroups[nextGroup]++;
            }
        }
    }
    
    getMostlyGroupForPattern(patternKey, streakLength) {
        if (streakLength < 1 || streakLength > 18) return null;
        if (!this.patterns[patternKey] || !this.patterns[patternKey][streakLength]) return null;
        
        const data = this.patterns[patternKey][streakLength];
        if (data.totalBreaks === 0) return null;
        
        let maxCount = 0, mostlyGroup = null;
        for (let group of this.groups) {
            if (data.nextGroups[group] > maxCount) {
                maxCount = data.nextGroups[group];
                mostlyGroup = group;
            }
        }
        return mostlyGroup;
    }
    
    getConfidenceForPattern(patternKey, streakLength, predictedGroup) {
        if (streakLength < 1 || streakLength > 18) return 30;
        if (!this.patterns[patternKey] || !this.patterns[patternKey][streakLength]) return 30;
        
        const data = this.patterns[patternKey][streakLength];
        if (data.totalBreaks === 0) return 30;
        
        const count = data.nextGroups[predictedGroup] || 0;
        return Math.round((count / data.totalBreaks) * 100);
    }
    
    getFallbackPrediction() {
        let bestGroup = "HIGH";  // Default for Low-Mid is HIGH as per instruction
        let bestCount = 0;
        
        for (let len = 1; len <= 18; len++) {
            for (let pKey of ["LOW→MEDIUM", "MEDIUM→LOW"]) {
                const data = this.patterns[pKey][len];
                if (data && data.nextGroups) {
                    for (let group of this.groups) {
                        if (data.nextGroups[group] > bestCount) {
                            bestCount = data.nextGroups[group];
                            bestGroup = group;
                        }
                    }
                }
            }
        }
        
        const confidence = bestCount > 0 ? Math.min(70, 30 + bestCount) : 40;
        
        return {
            nextGroup: bestGroup,
            confidence: confidence,
            hasSpecificData: false,
            reason: `Pattern not tracked, using most common outcome → ${bestGroup}`
        };
    }
    
    predict(currentGroup, previousGroup) {
        const immediatePattern = `${previousGroup}→${currentGroup}`;
        
        if (immediatePattern === "LOW→MEDIUM" || immediatePattern === "MEDIUM→LOW") {
            let streakLength = (this.currentPatternKey === immediatePattern) ? this.currentStreak : 1;
            streakLength = Math.min(18, Math.max(1, streakLength));
            
            let predictedGroup = this.getMostlyGroupForPattern(immediatePattern, streakLength);
            let confidence = 0;
            let hasSpecificData = false;
            
            if (predictedGroup) {
                hasSpecificData = true;
                confidence = this.getConfidenceForPattern(immediatePattern, streakLength, predictedGroup);
            } else {
                predictedGroup = this.getMostlyGroupForPattern(immediatePattern, 1);
                if (predictedGroup) {
                    confidence = this.getConfidenceForPattern(immediatePattern, 1, predictedGroup);
                    hasSpecificData = true;
                } else {
                    predictedGroup = "HIGH";
                    confidence = 40;
                }
            }
            
            const predictionType = (predictedGroup === currentGroup) ? "CONTINUE" : "BREAK";
            
            return {
                model: this.name,
                prediction: predictionType,
                pattern: immediatePattern,
                currentGroup: currentGroup,
                previousGroup: previousGroup,
                currentStreak: streakLength,
                nextGroup: predictedGroup,
                nextGroupConfidence: confidence,
                confidence: confidence,
                breakProbability: 100 - confidence,
                hasSpecificData: hasSpecificData,
                reason: hasSpecificData 
                    ? `After ${streakLength}x alternating ${immediatePattern}, mostly ${predictedGroup}`
                    : `No data for ${streakLength}x alternating ${immediatePattern}, using default HIGH`,
                accuracy: this.accuracy
            };
        }
        
        const fallback = this.getFallbackPrediction();
        return {
            model: this.name,
            prediction: "DEFAULT",
            pattern: immediatePattern,
            currentGroup: currentGroup,
            previousGroup: previousGroup,
            currentStreak: 0,
            nextGroup: fallback.nextGroup,
            nextGroupConfidence: fallback.confidence,
            confidence: fallback.confidence,
            breakProbability: 100 - fallback.confidence,
            hasSpecificData: false,
            reason: fallback.reason,
            accuracy: this.accuracy
        };
    }
    
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        if (this.currentPatternKey === "LOW→MEDIUM") {
            const expectedNext = (this.currentStreak % 2 === 1) ? 'LOW' : 'MEDIUM';
            if (resultGroup === expectedNext) {
                this.currentStreak++;
            } else {
                if (this.currentStreak >= 1 && this.currentStreak <= 18) {
                    this.recordBreak(this.currentPatternKey, this.currentStreak, resultGroup);
                }
                if (patternKey === "LOW→MEDIUM" || patternKey === "MEDIUM→LOW") {
                    this.currentPatternKey = patternKey;
                    this.currentStreak = 1;
                } else {
                    this.currentPatternKey = null;
                    this.currentStreak = 0;
                }
            }
        } 
        else if (this.currentPatternKey === "MEDIUM→LOW") {
            const expectedNext = (this.currentStreak % 2 === 1) ? 'MEDIUM' : 'LOW';
            if (resultGroup === expectedNext) {
                this.currentStreak++;
            } else {
                if (this.currentStreak >= 1 && this.currentStreak <= 18) {
                    this.recordBreak(this.currentPatternKey, this.currentStreak, resultGroup);
                }
                if (patternKey === "LOW→MEDIUM" || patternKey === "MEDIUM→LOW") {
                    this.currentPatternKey = patternKey;
                    this.currentStreak = 1;
                } else {
                    this.currentPatternKey = null;
                    this.currentStreak = 0;
                }
            }
        }
        else {
            if (patternKey === "LOW→MEDIUM" || patternKey === "MEDIUM→LOW") {
                this.currentPatternKey = patternKey;
                this.currentStreak = 1;
            }
        }
    }
    
    recordPredictionResult(correct) {
        this.totalPredictions++;
        if (correct) this.correctPredictions++;
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
    }
    
    getAccuracy() { return this.accuracy || 0; }
    
    loadFromData(data) {
        if (data) {
            this.patterns = data.patterns || this.patterns;
            this.currentPatternKey = data.currentPatternKey || null;
            this.currentStreak = data.currentStreak || 0;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
        }
    }
    
    exportForServer() {
        return {
            patterns: this.patterns,
            currentPatternKey: this.currentPatternKey,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * AI-D: Mid-High Switch Detector (REFACTORED)
 * 
 * NEW LOGIC:
 * - Tracks alternating patterns: MEDIUM→HIGH→MEDIUM→HIGH... and HIGH→MEDIUM→HIGH→MEDIUM...
 * - Streak length 1 to 18 (number of alternations)
 * - Learns what comes AFTER the alternating pattern
 */
class ServerAI_MidHighSwitch {
    constructor() {
        this.name = "AI_MidHighSwitch";
        this.groups = ['LOW', 'MEDIUM', 'HIGH'];
        
        // Two patterns to track
        this.patterns = {
            "MEDIUM→HIGH": {},
            "HIGH→MEDIUM": {}
        };
        
        // Data structure for each pattern and streak length (1 to 18)
        for (let len = 1; len <= 18; len++) {
            this.patterns["MEDIUM→HIGH"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.patterns["HIGH→MEDIUM"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        
        // For tracking current alternating streak
        this.currentPatternKey = null;
        this.currentStreak = 0;
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }
    
    init() {
        console.log('🤖 AI-D (Mid-High Switch) REFACTORED - Alternating Pattern Tracker');
        console.log('   ✅ Tracks: MEDIUM→HIGH→MEDIUM→HIGH... and HIGH→MEDIUM→HIGH→MEDIUM...');
        console.log('   ✅ Streak length 1 to 18');
    }
    
    train(history) {
        if (!history || history.length < 3) return false;
        
        for (let len = 1; len <= 18; len++) {
            this.patterns["MEDIUM→HIGH"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.patterns["HIGH→MEDIUM"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        
        let tempPattern = null;
        let tempStreak = 0;
        
        for (let i = 2; i < history.length; i++) {
            const prevPrev = history[i-2].group;
            const prev = history[i-1].group;
            const curr = history[i].group;
            
            const isMidHigh1 = (prevPrev === 'MEDIUM' && prev === 'HIGH') || (prevPrev === 'HIGH' && prev === 'MEDIUM');
            
            if (isMidHigh1) {
                const patternKey = `${prevPrev}→${prev}`;
                const expectedCurr = (patternKey === "MEDIUM→HIGH") ? 'MEDIUM' : 'HIGH';
                
                if (curr === expectedCurr) {
                    if (tempPattern === patternKey) {
                        tempStreak++;
                    } else {
                        if (tempPattern !== null && tempStreak >= 1 && tempStreak <= 18) {
                            this.recordBreak(tempPattern, tempStreak, prev);
                        }
                        tempPattern = patternKey;
                        tempStreak = 1;
                    }
                } else {
                    if (tempPattern !== null && tempStreak >= 1 && tempStreak <= 18) {
                        this.recordBreak(tempPattern, tempStreak, curr);
                    }
                    tempPattern = null;
                    tempStreak = 0;
                }
            } else {
                if (tempPattern !== null && tempStreak >= 1 && tempStreak <= 18) {
                    this.recordBreak(tempPattern, tempStreak, curr);
                }
                tempPattern = null;
                tempStreak = 0;
            }
        }
        
        return true;
    }
    
    recordBreak(patternKey, streakLength, nextGroup) {
        if (streakLength >= 1 && streakLength <= 18) {
            if (this.patterns[patternKey] && this.patterns[patternKey][streakLength]) {
                this.patterns[patternKey][streakLength].totalBreaks++;
                this.patterns[patternKey][streakLength].nextGroups[nextGroup]++;
            }
        }
    }
    
    getMostlyGroupForPattern(patternKey, streakLength) {
        if (streakLength < 1 || streakLength > 18) return null;
        if (!this.patterns[patternKey] || !this.patterns[patternKey][streakLength]) return null;
        
        const data = this.patterns[patternKey][streakLength];
        if (data.totalBreaks === 0) return null;
        
        let maxCount = 0, mostlyGroup = null;
        for (let group of this.groups) {
            if (data.nextGroups[group] > maxCount) {
                maxCount = data.nextGroups[group];
                mostlyGroup = group;
            }
        }
        return mostlyGroup;
    }
    
    getConfidenceForPattern(patternKey, streakLength, predictedGroup) {
        if (streakLength < 1 || streakLength > 18) return 30;
        if (!this.patterns[patternKey] || !this.patterns[patternKey][streakLength]) return 30;
        
        const data = this.patterns[patternKey][streakLength];
        if (data.totalBreaks === 0) return 30;
        
        const count = data.nextGroups[predictedGroup] || 0;
        return Math.round((count / data.totalBreaks) * 100);
    }
    
    getFallbackPrediction() {
        let bestGroup = "LOW";  // Default for Mid-High is LOW as per instruction
        let bestCount = 0;
        
        for (let len = 1; len <= 18; len++) {
            for (let pKey of ["MEDIUM→HIGH", "HIGH→MEDIUM"]) {
                const data = this.patterns[pKey][len];
                if (data && data.nextGroups) {
                    for (let group of this.groups) {
                        if (data.nextGroups[group] > bestCount) {
                            bestCount = data.nextGroups[group];
                            bestGroup = group;
                        }
                    }
                }
            }
        }
        
        const confidence = bestCount > 0 ? Math.min(70, 30 + bestCount) : 40;
        
        return {
            nextGroup: bestGroup,
            confidence: confidence,
            hasSpecificData: false,
            reason: `Pattern not tracked, using most common outcome → ${bestGroup}`
        };
    }
    
    predict(currentGroup, previousGroup) {
        const immediatePattern = `${previousGroup}→${currentGroup}`;
        
        if (immediatePattern === "MEDIUM→HIGH" || immediatePattern === "HIGH→MEDIUM") {
            let streakLength = (this.currentPatternKey === immediatePattern) ? this.currentStreak : 1;
            streakLength = Math.min(18, Math.max(1, streakLength));
            
            let predictedGroup = this.getMostlyGroupForPattern(immediatePattern, streakLength);
            let confidence = 0;
            let hasSpecificData = false;
            
            if (predictedGroup) {
                hasSpecificData = true;
                confidence = this.getConfidenceForPattern(immediatePattern, streakLength, predictedGroup);
            } else {
                predictedGroup = this.getMostlyGroupForPattern(immediatePattern, 1);
                if (predictedGroup) {
                    confidence = this.getConfidenceForPattern(immediatePattern, 1, predictedGroup);
                    hasSpecificData = true;
                } else {
                    predictedGroup = "LOW";
                    confidence = 40;
                }
            }
            
            const predictionType = (predictedGroup === currentGroup) ? "CONTINUE" : "BREAK";
            
            return {
                model: this.name,
                prediction: predictionType,
                pattern: immediatePattern,
                currentGroup: currentGroup,
                previousGroup: previousGroup,
                currentStreak: streakLength,
                nextGroup: predictedGroup,
                nextGroupConfidence: confidence,
                confidence: confidence,
                breakProbability: 100 - confidence,
                hasSpecificData: hasSpecificData,
                reason: hasSpecificData 
                    ? `After ${streakLength}x alternating ${immediatePattern}, mostly ${predictedGroup}`
                    : `No data for ${streakLength}x alternating ${immediatePattern}, using default LOW`,
                accuracy: this.accuracy
            };
        }
        
        const fallback = this.getFallbackPrediction();
        return {
            model: this.name,
            prediction: "DEFAULT",
            pattern: immediatePattern,
            currentGroup: currentGroup,
            previousGroup: previousGroup,
            currentStreak: 0,
            nextGroup: fallback.nextGroup,
            nextGroupConfidence: fallback.confidence,
            confidence: fallback.confidence,
            breakProbability: 100 - fallback.confidence,
            hasSpecificData: false,
            reason: fallback.reason,
            accuracy: this.accuracy
        };
    }
    
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        if (this.currentPatternKey === "MEDIUM→HIGH") {
            const expectedNext = (this.currentStreak % 2 === 1) ? 'MEDIUM' : 'HIGH';
            if (resultGroup === expectedNext) {
                this.currentStreak++;
            } else {
                if (this.currentStreak >= 1 && this.currentStreak <= 18) {
                    this.recordBreak(this.currentPatternKey, this.currentStreak, resultGroup);
                }
                if (patternKey === "MEDIUM→HIGH" || patternKey === "HIGH→MEDIUM") {
                    this.currentPatternKey = patternKey;
                    this.currentStreak = 1;
                } else {
                    this.currentPatternKey = null;
                    this.currentStreak = 0;
                }
            }
        } 
        else if (this.currentPatternKey === "HIGH→MEDIUM") {
            const expectedNext = (this.currentStreak % 2 === 1) ? 'HIGH' : 'MEDIUM';
            if (resultGroup === expectedNext) {
                this.currentStreak++;
            } else {
                if (this.currentStreak >= 1 && this.currentStreak <= 18) {
                    this.recordBreak(this.currentPatternKey, this.currentStreak, resultGroup);
                }
                if (patternKey === "MEDIUM→HIGH" || patternKey === "HIGH→MEDIUM") {
                    this.currentPatternKey = patternKey;
                    this.currentStreak = 1;
                } else {
                    this.currentPatternKey = null;
                    this.currentStreak = 0;
                }
            }
        }
        else {
            if (patternKey === "MEDIUM→HIGH" || patternKey === "HIGH→MEDIUM") {
                this.currentPatternKey = patternKey;
                this.currentStreak = 1;
            }
        }
    }
    
    recordPredictionResult(correct) {
        this.totalPredictions++;
        if (correct) this.correctPredictions++;
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
    }
    
    getAccuracy() { return this.accuracy || 0; }
    
    loadFromData(data) {
        if (data) {
            this.patterns = data.patterns || this.patterns;
            this.currentPatternKey = data.currentPatternKey || null;
            this.currentStreak = data.currentStreak || 0;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
        }
    }
    
    exportForServer() {
        return {
            patterns: this.patterns,
            currentPatternKey: this.currentPatternKey,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * Server Ensemble Voter (UNCHANGED)
 * Real-time weight updates based on AI performance
 */
class ServerEnsembleVoter {
    constructor() {
        this.name = "EnsembleVoter";
        this.version = "4.1";
        
        this.weights = {
            stick: 0.25,
            extremeSwitch: 0.25,
            lowMidSwitch: 0.25,
            midHighSwitch: 0.25
        };
        
        this.minWeight = 0.05;
        this.maxWeight = 0.55;
        
        this.lastPredictions = null;
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }
    
    combine(predStick, predExtreme, predLowMid, predMidHigh) {
        // Store for weight update later
        this.lastPredictions = {
            stick: predStick,
            extreme: predExtreme,
            lowMid: predLowMid,
            midHigh: predMidHigh
        };
        
        const predictions = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        const voteCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        
        if (predStick && predStick.nextGroup) {
            const weight = this.weights.stick;
            const confidence = predStick.confidence || 50;
            predictions[predStick.nextGroup] += confidence * weight;
            voteCount[predStick.nextGroup]++;
        }
        
        if (predExtreme && predExtreme.nextGroup) {
            const weight = this.weights.extremeSwitch;
            const confidence = predExtreme.confidence || 50;
            predictions[predExtreme.nextGroup] += confidence * weight;
            voteCount[predExtreme.nextGroup]++;
        }
        
        if (predLowMid && predLowMid.nextGroup) {
            const weight = this.weights.lowMidSwitch;
            const confidence = predLowMid.confidence || 50;
            predictions[predLowMid.nextGroup] += confidence * weight;
            voteCount[predLowMid.nextGroup]++;
        }
        
        if (predMidHigh && predMidHigh.nextGroup) {
            const weight = this.weights.midHighSwitch;
            const confidence = predMidHigh.confidence || 50;
            predictions[predMidHigh.nextGroup] += confidence * weight;
            voteCount[predMidHigh.nextGroup]++;
        }
        
        let finalGroup = "MEDIUM";
        let finalScore = 0;
        for (let [group, score] of Object.entries(predictions)) {
            if (score > finalScore) {
                finalScore = score;
                finalGroup = group;
            }
        }
        
        const agreement = Math.max(...Object.values(voteCount));
        const finalConfidence = Math.min(95, Math.round(finalScore));
        
        return {
            final: {
                group: finalGroup,
                confidence: finalConfidence,
                scores: predictions,
                voteCount: voteCount,
                agreement: agreement
            },
            weights: this.weights
        };
    }
    
    updateWeightsWithResult(actualGroup) {
        if (!this.lastPredictions) return;
        
        const predStick = this.lastPredictions.stick;
        const predExtreme = this.lastPredictions.extreme;
        const predLowMid = this.lastPredictions.lowMid;
        const predMidHigh = this.lastPredictions.midHigh;
        
        const correct = {
            stick: predStick && predStick.nextGroup === actualGroup,
            extreme: predExtreme && predExtreme.nextGroup === actualGroup,
            lowMid: predLowMid && predLowMid.nextGroup === actualGroup,
            midHigh: predMidHigh && predMidHigh.nextGroup === actualGroup
        };
        
        const weightChange = 0.02;
        
        if (correct.stick) this.weights.stick += weightChange;
        else this.weights.stick -= weightChange;
        
        if (correct.extreme) this.weights.extremeSwitch += weightChange;
        else this.weights.extremeSwitch -= weightChange;
        
        if (correct.lowMid) this.weights.lowMidSwitch += weightChange;
        else this.weights.lowMidSwitch -= weightChange;
        
        if (correct.midHigh) this.weights.midHighSwitch += weightChange;
        else this.weights.midHighSwitch -= weightChange;
        
        // Apply limits
        this.weights.stick = Math.min(this.maxWeight, Math.max(this.minWeight, this.weights.stick));
        this.weights.extremeSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, this.weights.extremeSwitch));
        this.weights.lowMidSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, this.weights.lowMidSwitch));
        this.weights.midHighSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, this.weights.midHighSwitch));
        
        this.normalizeWeights();
        this.lastPredictions = null;
    }
    
    normalizeWeights() {
        const total = this.weights.stick + this.weights.extremeSwitch + 
                      this.weights.lowMidSwitch + this.weights.midHighSwitch;
        
        if (total > 0) {
            this.weights.stick /= total;
            this.weights.extremeSwitch /= total;
            this.weights.lowMidSwitch /= total;
            this.weights.midHighSwitch /= total;
        }
    }
    
    updateWeights(accStick, accExtreme, accLowMid, accMidHigh) {
        const total = accStick + accExtreme + accLowMid + accMidHigh;
        if (total > 0) {
            this.weights.stick = Math.min(this.maxWeight, Math.max(this.minWeight, accStick / total));
            this.weights.extremeSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, accExtreme / total));
            this.weights.lowMidSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, accLowMid / total));
            this.weights.midHighSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, accMidHigh / total));
            this.normalizeWeights();
        }
    }
    
    recordPredictionResult(correct) {
        this.totalPredictions++;
        if (correct) this.correctPredictions++;
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
    }
    
    getAccuracy() { return this.accuracy || 0; }
    
    loadFromData(data) {
        if (data) {
            this.weights = data.weights || this.weights;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
        }
    }
    
    exportForServer() {
        return {
            weights: this.weights,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


// Export all server AI classes
module.exports = {
    ServerAI_Stick,
    ServerAI_ExtremeSwitch,
    ServerAI_LowMidSwitch,
    ServerAI_MidHighSwitch,
    ServerEnsembleVoter
};
