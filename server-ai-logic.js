// server-ai-logic.js (UPDATED - Matches Client AI Logic Exactly)

/**
 * AI-A: Stick Pattern Detector (Server Version)
 * EXACT MATCH with client ai-stick.js
 * 
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
        console.log('🤖 Server AI-A (Stick) initialized - Matches client logic');
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
 * AI-B: Extreme Switch Detector (Server Version)
 * EXACT MATCH with client ai-extreme-switch.js
 * 
 * ONLY tracks: LOW→HIGH and HIGH→LOW
 * Tracks streak lengths 2-18 for EACH pattern separately
 */
class ServerAI_ExtremeSwitch {
    constructor() {
        this.name = "AI_ExtremeSwitch";
        this.patterns = ['LOW→HIGH', 'HIGH→LOW'];
        
        this.switchData = {
            "LOW→HIGH": {},
            "HIGH→LOW": {}
        };
        
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
        
        this.currentPattern = null;
        this.currentStreak = 0;
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }
    
    train(history) {
        if (!history || history.length < 3) return false;
        
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
    
    getCurrentStreakFromMemory(patternKey) {
        if (this.currentPattern === patternKey) {
            return this.currentStreak;
        }
        return 1;
    }
    
    predict(currentGroup, previousGroup) {
        const patternKey = `${previousGroup}→${currentGroup}`;
        
        // Pattern mismatch
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
        
        // FALLBACK: If no specific data, use MEDIUM (40% confidence)
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
    
    updateWithResult(resultGroup, previousGroup) {
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
            }
            this.currentPattern = null;
            this.currentStreak = 0;
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
            this.switchData = data.switchData || this.switchData;
            this.currentPattern = data.currentPattern || null;
            this.currentStreak = data.currentStreak || 0;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
        }
    }
    
    exportForServer() {
        return {
            switchData: this.switchData,
            currentPattern: this.currentPattern,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * AI-C: Low-Mid Switch Detector (Server Version)
 * EXACT MATCH with client ai-low-mid-switch.js
 * 
 * ONLY tracks: LOW→MEDIUM and MEDIUM→LOW
 * If no specific data → predicts HIGH
 */
class ServerAI_LowMidSwitch {
    constructor() {
        this.name = "AI_LowMidSwitch";
        this.patterns = ['LOW→MEDIUM', 'MEDIUM→LOW'];
        
        this.switchData = {
            "LOW→MEDIUM": {},
            "MEDIUM→LOW": {}
        };
        
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
        
        this.currentPattern = null;
        this.currentStreak = 0;
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }
    
    train(history) {
        if (!history || history.length < 3) return false;
        
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
        
        let tempPattern = null;
        let tempStreak = 0;
        
        for (let i = 1; i < history.length; i++) {
            const prevGroup = history[i-1].group;
            const currGroup = history[i].group;
            const patternKey = `${prevGroup}→${currGroup}`;
            
            if (patternKey === "LOW→MEDIUM" || patternKey === "MEDIUM→LOW") {
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
    
    getCurrentStreakFromMemory(patternKey) {
        if (this.currentPattern === patternKey) {
            return this.currentStreak;
        }
        return 1;
    }
    
    predict(currentGroup, previousGroup) {
        const patternKey = `${previousGroup}→${currentGroup}`;
        
        // Pattern mismatch
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
                reason: "Pattern mismatch (not LOW→MEDIUM or MEDIUM→LOW), defaulting to HIGH",
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
        
        // FALLBACK: If no specific data, use HIGH (as instructed)
        if (!predictedGroup) {
            predictedGroup = "HIGH";
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
                : `No specific data for ${streakLength}x ${patternKey}, using HIGH as instructed (40% confidence)`,
            accuracy: this.accuracy
        };
    }
    
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        const isLowMidSwitch = (patternKey === "LOW→MEDIUM" || patternKey === "MEDIUM→LOW");
        
        if (isLowMidSwitch) {
            if (this.currentPattern === patternKey) {
                this.currentStreak++;
            } else {
                this.currentPattern = patternKey;
                this.currentStreak = 1;
            }
        } else {
            if (this.currentPattern !== null && this.currentStreak >= 2 && this.currentStreak <= 18) {
                this.recordBreak(this.currentPattern, this.currentStreak, resultGroup);
            }
            this.currentPattern = null;
            this.currentStreak = 0;
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
            this.switchData = data.switchData || this.switchData;
            this.currentPattern = data.currentPattern || null;
            this.currentStreak = data.currentStreak || 0;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
        }
    }
    
    exportForServer() {
        return {
            switchData: this.switchData,
            currentPattern: this.currentPattern,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * AI-D: Mid-High Switch Detector (Server Version)
 * EXACT MATCH with client ai-mid-high-switch.js
 * 
 * ONLY tracks: MEDIUM→HIGH and HIGH→MEDIUM
 * If no specific data → predicts LOW
 */
class ServerAI_MidHighSwitch {
    constructor() {
        this.name = "AI_MidHighSwitch";
        this.patterns = ['MEDIUM→HIGH', 'HIGH→MEDIUM'];
        
        this.switchData = {
            "MEDIUM→HIGH": {},
            "HIGH→MEDIUM": {}
        };
        
        for (let len = 2; len <= 18; len++) {
            this.switchData["MEDIUM→HIGH"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.switchData["HIGH→MEDIUM"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        
        this.globalFallback = {
            totalBreaks: 0,
            nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        this.currentPattern = null;
        this.currentStreak = 0;
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }
    
    train(history) {
        if (!history || history.length < 3) return false;
        
        for (let len = 2; len <= 18; len++) {
            this.switchData["MEDIUM→HIGH"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.switchData["HIGH→MEDIUM"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        this.globalFallback = {
            totalBreaks: 0,
            nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        let tempPattern = null;
        let tempStreak = 0;
        
        for (let i = 1; i < history.length; i++) {
            const prevGroup = history[i-1].group;
            const currGroup = history[i].group;
            const patternKey = `${prevGroup}→${currGroup}`;
            
            if (patternKey === "MEDIUM→HIGH" || patternKey === "HIGH→MEDIUM") {
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
        
        return true;
    }
    
    recordBreak(pattern, streakLength, nextGroup) {
        if (streakLength >= 2 && streakLength <= 18) {
            if (this.switchData[pattern] && this.switchData[pattern][streakLength]) {
                this.switchData[pattern][streakLength].totalBreaks++;
                this.switchData[pattern][streakLength].nextGroups[nextGroup]++;
            }
        }
        this.globalFallback.totalBreaks++;
        this.globalFallback.nextGroups[nextGroup]++;
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
    
    getCurrentStreakFromMemory(patternKey) {
        if (this.currentPattern === patternKey) {
            return this.currentStreak;
        }
        return 1;
    }
    
    predict(currentGroup, previousGroup) {
        const patternKey = `${previousGroup}→${currentGroup}`;
        
        // Pattern mismatch
        if (patternKey !== "MEDIUM→HIGH" && patternKey !== "HIGH→MEDIUM") {
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
                reason: "Pattern mismatch (not MEDIUM→HIGH or HIGH→MEDIUM), defaulting to MEDIUM",
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
        
        // FALLBACK: If no specific data, use LOW (as instructed)
        if (!predictedGroup) {
            predictedGroup = "LOW";
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
                : `No specific data for ${streakLength}x ${patternKey}, using LOW as instructed (40% confidence)`,
            accuracy: this.accuracy
        };
    }
    
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        const isMidHighSwitch = (patternKey === "MEDIUM→HIGH" || patternKey === "HIGH→MEDIUM");
        
        if (isMidHighSwitch) {
            if (this.currentPattern === patternKey) {
                this.currentStreak++;
            } else {
                this.currentPattern = patternKey;
                this.currentStreak = 1;
            }
        } else {
            if (this.currentPattern !== null && this.currentStreak >= 2 && this.currentStreak <= 18) {
                this.recordBreak(this.currentPattern, this.currentStreak, resultGroup);
            }
            this.currentPattern = null;
            this.currentStreak = 0;
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
            this.switchData = data.switchData || this.switchData;
            this.globalFallback = data.globalFallback || this.globalFallback;
            this.currentPattern = data.currentPattern || null;
            this.currentStreak = data.currentStreak || 0;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
        }
    }
    
    exportForServer() {
        return {
            switchData: this.switchData,
            globalFallback: this.globalFallback,
            currentPattern: this.currentPattern,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * Server Ensemble Voter (Server Version)
 * EXACT MATCH with client ensemble-v4.js
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
