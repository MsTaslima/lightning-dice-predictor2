// ============================================================
// new-ai-logic.js (v9.0 - 3-Step Pattern AI with Real-Time Learning)
// 
// 6 Patterns for 3-Step Detection:
// 1. LOW → HIGH → MEDIUM
// 2. HIGH → LOW → MEDIUM
// 3. MEDIUM → LOW → HIGH
// 4. MEDIUM → HIGH → LOW
// 5. LOW → MEDIUM → HIGH
// 6. HIGH → MEDIUM → LOW
//
// Rules:
// - When pattern matches → Predict immediately using CONTINUE or SWITCH
// - CONTINUE = Recent Data (last result of the 3)
// - SWITCH = Previous Data (second result of the 3)
// - When prediction is WRONG → Keep predicting with SAME rule (no auto-switch)
// - When prediction is CORRECT → Go back to WAIT mode
// - AI learns from history to choose better protection type over time
// ============================================================

class NewPatternAI {
    constructor() {
        this.version = "9.0";
        this.name = "3-Step Pattern AI with Real-Time Learning";
        
        // Define the 6 patterns
        this.patterns = [
            "LOW→HIGH→MEDIUM",
            "HIGH→LOW→MEDIUM",
            "MEDIUM→LOW→HIGH",
            "MEDIUM→HIGH→LOW",
            "LOW→MEDIUM→HIGH",
            "HIGH→MEDIUM→LOW"
        ];
        
        // Define what each pattern predicts (CONTINUE vs SWITCH)
        // CONTINUE = recent data (3rd result)
        // SWITCH = previous data (2nd result)
        this.patternMapping = {
            // Pattern 1: LOW → HIGH → MEDIUM
            "LOW→HIGH→MEDIUM": {
                continueGroup: "MEDIUM",  // recent data (3rd)
                switchGroup: "HIGH",      // previous data (2nd)
                description: "LOW থেকে HIGH হয়ে MEDIUM এ এসেছে",
                recentData: "MEDIUM",
                previousData: "HIGH"
            },
            // Pattern 2: HIGH → LOW → MEDIUM
            "HIGH→LOW→MEDIUM": {
                continueGroup: "MEDIUM",
                switchGroup: "LOW",
                description: "HIGH থেকে LOW হয়ে MEDIUM এ এসেছে",
                recentData: "MEDIUM",
                previousData: "LOW"
            },
            // Pattern 3: MEDIUM → LOW → HIGH
            "MEDIUM→LOW→HIGH": {
                continueGroup: "HIGH",
                switchGroup: "LOW",
                description: "MEDIUM থেকে LOW হয়ে HIGH এ এসেছে",
                recentData: "HIGH",
                previousData: "LOW"
            },
            // Pattern 4: MEDIUM → HIGH → LOW
            "MEDIUM→HIGH→LOW": {
                continueGroup: "LOW",
                switchGroup: "HIGH",
                description: "MEDIUM থেকে HIGH হয়ে LOW এ এসেছে",
                recentData: "LOW",
                previousData: "HIGH"
            },
            // Pattern 5: LOW → MEDIUM → HIGH
            "LOW→MEDIUM→HIGH": {
                continueGroup: "HIGH",
                switchGroup: "MEDIUM",
                description: "LOW থেকে MEDIUM হয়ে HIGH এ এসেছে",
                recentData: "HIGH",
                previousData: "MEDIUM"
            },
            // Pattern 6: HIGH → MEDIUM → LOW
            "HIGH→MEDIUM→LOW": {
                continueGroup: "LOW",
                switchGroup: "MEDIUM",
                description: "HIGH থেকে MEDIUM হয়ে LOW এ এসেছে",
                recentData: "LOW",
                previousData: "MEDIUM"
            }
        };
        
        // Pattern tracking history
        this.patternHistory = [];
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        
        // Active pattern tracking (for retry logic)
        this.activePattern = null;        
        this.activeProtectionType = null;
        this.activeRecentData = null;
        this.activePreviousData = null;
        this.isWaitingForCorrect = false;
        this.consecutiveWrongCount = 0;
        
        // Pattern-specific learning data
        this.patternOccurrences = {};
        
        // Initialize pattern occurrences counter
        for (const pattern of this.patterns) {
            this.patternOccurrences[pattern] = {
                count: 0,
                lastSeen: null,
                continueCount: 0,
                switchCount: 0,
                continueCorrect: 0,
                switchCorrect: 0,
                continueAccuracy: 0,
                switchAccuracy: 0
            };
        }
        
        console.log(`🤖 ${this.name} initialized with ${this.patterns.length} patterns`);
        console.log(`📋 Rules: CONTINUE = Recent Data | SWITCH = Previous Data`);
        console.log(`📋 AI learns from history to choose better protection type over time`);
    }
    
    /**
     * Get last 3 results as a pattern string
     */
    getPatternString(last3Results) {
        if (!last3Results || last3Results.length !== 3) {
            return null;
        }
        return `${last3Results[0]}→${last3Results[1]}→${last3Results[2]}`;
    }
    
    /**
     * Get recent and previous data from pattern
     */
    getPatternData(patternString) {
        const parts = patternString.split('→');
        if (parts.length !== 3) return null;
        return {
            first: parts[0],
            second: parts[1],
            third: parts[2],
            recentData: parts[2],
            previousData: parts[1]
        };
    }
    
    /**
     * Check if a pattern matches any of the 6 defined patterns
     */
    isPatternMatch(patternString) {
        return this.patterns.includes(patternString);
    }
    
    /**
     * Get prediction for a matched pattern based on protection type
     * CONTINUE = recentData (3rd result)
     * SWITCH = previousData (2nd result)
     */
    getPredictionForPattern(patternString, protectionType) {
        const mapping = this.patternMapping[patternString];
        
        if (!mapping) {
            return {
                predictedGroup: null,
                confidence: 0,
                error: "Pattern not found in mapping"
            };
        }
        
        let predictedGroup = null;
        let confidence = 70; // Base confidence
        
        if (protectionType === 'CONTINUE') {
            predictedGroup = mapping.continueGroup; // recent data
            const histAccuracy = this.patternOccurrences[patternString]?.continueAccuracy || 50;
            confidence = Math.min(92, Math.max(45, (confidence + histAccuracy) / 2));
        } else if (protectionType === 'SWITCH') {
            predictedGroup = mapping.switchGroup; // previous data
            const histAccuracy = this.patternOccurrences[patternString]?.switchAccuracy || 50;
            confidence = Math.min(92, Math.max(45, (confidence + histAccuracy) / 2));
        } else {
            return {
                predictedGroup: null,
                confidence: 0,
                error: `Invalid protection type: ${protectionType}`
            };
        }
        
        return {
            predictedGroup: predictedGroup,
            confidence: Math.round(confidence),
            continueGroup: mapping.continueGroup,
            switchGroup: mapping.switchGroup,
            recentData: mapping.recentData,
            previousData: mapping.previousData,
            description: mapping.description
        };
    }
    
    /**
     * Decide which protection type to use based on historical learning
     */
    decideProtectionType(patternString) {
        const occurrence = this.patternOccurrences[patternString];
        
        // Not enough data yet, use CONTINUE as default
        if (!occurrence || occurrence.count < 3) {
            console.log(`   Not enough data for pattern, using CONTINUE (default)`);
            return { type: "CONTINUE", method: "default" };
        }
        
        // Compare historical accuracy
        const continueAccuracy = occurrence.continueAccuracy;
        const switchAccuracy = occurrence.switchAccuracy;
        
        if (continueAccuracy > switchAccuracy) {
            console.log(`   Historical data: CONTINUE (${continueAccuracy.toFixed(1)}%) > SWITCH (${switchAccuracy.toFixed(1)}%)`);
            return { type: "CONTINUE", method: "historical" };
        } else if (switchAccuracy > continueAccuracy) {
            console.log(`   Historical data: SWITCH (${switchAccuracy.toFixed(1)}%) > CONTINUE (${continueAccuracy.toFixed(1)}%)`);
            return { type: "SWITCH", method: "historical" };
        } else {
            console.log(`   Equal accuracy, using CONTINUE (default)`);
            return { type: "CONTINUE", method: "default" };
        }
    }
    
    /**
     * Reset active pattern (go back to WAIT mode)
     */
    resetActivePattern() {
        console.log(`🔄 Resetting active pattern. Going back to WAIT mode.`);
        this.activePattern = null;
        this.activeProtectionType = null;
        this.activeRecentData = null;
        this.activePreviousData = null;
        this.isWaitingForCorrect = false;
        this.consecutiveWrongCount = 0;
    }
    
    /**
     * MAIN PREDICTION FUNCTION
     */
    predict(last3Results, protectionType = null) {
        // CASE 1: Active pattern exists - retry with SAME rule
        if (this.isWaitingForCorrect && this.activePattern) {
            console.log(`🔄 Active pattern exists. Retrying with SAME rule (wrong count: ${this.consecutiveWrongCount})`);
            console.log(`   Active Pattern: ${this.activePattern}`);
            console.log(`   Protection Type: ${this.activeProtectionType}`);
            console.log(`   CONTINUE = Recent Data (${this.activeRecentData}) | SWITCH = Previous Data (${this.activePreviousData})`);
            
            const prediction = this.getPredictionForPattern(this.activePattern, this.activeProtectionType);
            
            if (!prediction.predictedGroup) {
                console.log(`⚠️ Failed to get prediction for active pattern, resetting...`);
                this.resetActivePattern();
                return this.predict(last3Results, protectionType);
            }
            
            this.recordPrediction({
                pattern: this.activePattern,
                protectionType: this.activeProtectionType,
                predictedGroup: prediction.predictedGroup,
                timestamp: new Date().toISOString(),
                confidence: prediction.confidence,
                actualGroup: null,
                isRetry: true,
                retryNumber: this.consecutiveWrongCount + 1
            });
            
            console.log(`🔄 RETRY PREDICTION #${this.consecutiveWrongCount + 1}`);
            console.log(`   Rule: ${this.activeProtectionType} = ${this.activeProtectionType === 'CONTINUE' ? this.activeRecentData : this.activePreviousData}`);
            console.log(`   Prediction: ${prediction.predictedGroup}`);
            
            return {
                status: "PREDICTION_READY",
                pattern: this.activePattern,
                protectionType: this.activeProtectionType,
                predictedGroup: prediction.predictedGroup,
                confidence: prediction.confidence,
                continueGroup: prediction.continueGroup,
                switchGroup: prediction.switchGroup,
                recentData: this.activeRecentData,
                previousData: this.activePreviousData,
                description: prediction.description,
                waitingForData: false,
                isRetry: true,
                retryCount: this.consecutiveWrongCount + 1,
                message: `Retry #${this.consecutiveWrongCount + 1}: Using ${this.activeProtectionType} rule.`,
                last3Results: last3Results
            };
        }
        
        // CASE 2: Need to check for new pattern
        if (!last3Results || last3Results.length !== 3) {
            console.log(`⚠️ Cannot predict: need exactly 3 results, got ${last3Results?.length || 0}`);
            return {
                status: "WAITING",
                pattern: null,
                protectionType: null,
                predictedGroup: null,
                confidence: 0,
                message: `Waiting for 3 results. Currently have ${last3Results?.length || 0}`,
                waitingForData: true
            };
        }
        
        const patternString = this.getPatternString(last3Results);
        console.log(`🔍 Checking pattern: ${patternString}`);
        
        if (!this.isPatternMatch(patternString)) {
            console.log(`❌ Pattern does NOT match any of the 6 patterns. Entering WAIT mode.`);
            return {
                status: "WAITING",
                pattern: patternString,
                protectionType: null,
                predictedGroup: null,
                confidence: 0,
                message: `Pattern "${patternString}" does not match any known pattern. Waiting for pattern to form.`,
                waitingForData: true,
                matchedPatterns: this.patterns
            };
        }
        
        // CASE 3: Pattern matched!
        console.log(`✅ Pattern MATCHED!`);
        
        const patternData = this.getPatternData(patternString);
        const recentData = patternData.recentData;
        const previousData = patternData.previousData;
        
        console.log(`   Recent Data (3rd result): ${recentData}`);
        console.log(`   Previous Data (2nd result): ${previousData}`);
        console.log(`   Rule: CONTINUE = Recent Data (${recentData}) | SWITCH = Previous Data (${previousData})`);
        
        // Decide protection type
        let finalProtectionType = protectionType;
        let decisionMethod = "provided";
        
        if (!finalProtectionType) {
            const decision = this.decideProtectionType(patternString);
            finalProtectionType = decision.type;
            decisionMethod = decision.method;
        }
        
        console.log(`   Selected Protection: ${finalProtectionType} (${decisionMethod})`);
        
        const prediction = this.getPredictionForPattern(patternString, finalProtectionType);
        
        if (!prediction.predictedGroup) {
            return {
                status: "ERROR",
                pattern: patternString,
                protectionType: finalProtectionType,
                predictedGroup: null,
                confidence: 0,
                message: prediction.error,
                waitingForData: false
            };
        }
        
        // ACTIVATE THE PATTERN
        this.activePattern = patternString;
        this.activeProtectionType = finalProtectionType;
        this.activeRecentData = recentData;
        this.activePreviousData = previousData;
        this.isWaitingForCorrect = true;
        this.consecutiveWrongCount = 0;
        
        this.recordPrediction({
            pattern: patternString,
            protectionType: finalProtectionType,
            predictedGroup: prediction.predictedGroup,
            timestamp: new Date().toISOString(),
            confidence: prediction.confidence,
            actualGroup: null,
            isRetry: false,
            recentData: recentData,
            previousData: previousData
        });
        
        console.log(`🎯 PREDICTION READY`);
        console.log(`   Pattern: ${patternString}`);
        console.log(`   Rule: ${finalProtectionType} = ${finalProtectionType === 'CONTINUE' ? recentData : previousData}`);
        console.log(`   Prediction: ${prediction.predictedGroup} (${prediction.confidence}% confidence)`);
        console.log(`   📌 Will keep predicting with SAME rule until CORRECT.`);
        
        return {
            status: "PREDICTION_READY",
            pattern: patternString,
            protectionType: finalProtectionType,
            predictedGroup: prediction.predictedGroup,
            confidence: prediction.confidence,
            continueGroup: prediction.continueGroup,
            switchGroup: prediction.switchGroup,
            recentData: recentData,
            previousData: previousData,
            description: prediction.description,
            decisionMethod: decisionMethod,
            waitingForData: false,
            isActive: true,
            message: `Pattern matched! Using ${finalProtectionType} rule. Will retry with SAME rule if wrong.`,
            last3Results: last3Results
        };
    }
    
    /**
     * Update AI with actual result
     */
    updateWithResult(actualGroup) {
        const pendingIndex = this.patternHistory.findIndex(p => p.actualGroup === null);
        
        if (pendingIndex === -1) {
            console.log(`⚠️ No pending prediction to update`);
            return {
                isCorrect: false,
                message: "No pending prediction found"
            };
        }
        
        const prediction = this.patternHistory[pendingIndex];
        prediction.actualGroup = actualGroup;
        prediction.isCorrect = (prediction.predictedGroup === actualGroup);
        
        // Update overall statistics
        this.totalPredictions++;
        if (prediction.isCorrect) {
            this.correctPredictions++;
        }
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
        
        // Update pattern-specific learning data
        const occurrence = this.patternOccurrences[prediction.pattern];
        if (occurrence) {
            occurrence.count++;
            occurrence.lastSeen = new Date().toISOString();
            
            if (prediction.protectionType === "CONTINUE") {
                occurrence.continueCount++;
                if (prediction.isCorrect) {
                    occurrence.continueCorrect++;
                }
                occurrence.continueAccuracy = (occurrence.continueCorrect / occurrence.continueCount) * 100;
            } else if (prediction.protectionType === "SWITCH") {
                occurrence.switchCount++;
                if (prediction.isCorrect) {
                    occurrence.switchCorrect++;
                }
                occurrence.switchAccuracy = (occurrence.switchCorrect / occurrence.switchCount) * 100;
            }
        }
        
        console.log(`📊 LEARNING UPDATE:`);
        console.log(`   Pattern: ${prediction.pattern}`);
        console.log(`   Rule: ${prediction.protectionType}`);
        console.log(`   Predicted: ${prediction.predictedGroup} → Actual: ${actualGroup}`);
        console.log(`   Result: ${prediction.isCorrect ? '✓ CORRECT' : '✗ WRONG'}`);
        
        // Update pattern-specific accuracy log
        if (occurrence) {
            console.log(`   Pattern Stats - CONTINUE: ${occurrence.continueAccuracy.toFixed(1)}% (${occurrence.continueCorrect}/${occurrence.continueCount}) | SWITCH: ${occurrence.switchAccuracy.toFixed(1)}% (${occurrence.switchCorrect}/${occurrence.switchCount})`);
        }
        
        console.log(`   Overall Accuracy: ${this.accuracy.toFixed(1)}% (${this.correctPredictions}/${this.totalPredictions})`);
        
        // Determine if we reset or keep retrying
        if (prediction.isCorrect) {
            console.log(`✅ CORRECT! Resetting pattern. Going back to WAIT mode.`);
            console.log(`   Wrong attempts for this pattern: ${this.consecutiveWrongCount}`);
            this.resetActivePattern();
            
            return {
                isCorrect: true,
                predictedGroup: prediction.predictedGroup,
                actualGroup: actualGroup,
                newAccuracy: this.accuracy,
                resetPattern: true,
                message: "Correct prediction! Pattern reset."
            };
        } else {
            this.consecutiveWrongCount++;
            console.log(`❌ WRONG! Keeping SAME rule. Wrong count: ${this.consecutiveWrongCount}`);
            console.log(`   Will retry with SAME rule: ${this.activeProtectionType} = ${this.activeProtectionType === 'CONTINUE' ? this.activeRecentData : this.activePreviousData}`);
            
            return {
                isCorrect: false,
                predictedGroup: prediction.predictedGroup,
                actualGroup: actualGroup,
                newAccuracy: this.accuracy,
                keepPattern: true,
                consecutiveWrongCount: this.consecutiveWrongCount,
                message: `Wrong prediction! Retrying with SAME ${this.activeProtectionType} rule. Attempt #${this.consecutiveWrongCount + 1}`,
                activePattern: this.activePattern,
                activeProtectionType: this.activeProtectionType
            };
        }
    }
    
    /**
     * Check if AI is currently in active prediction mode
     */
    isActive() {
        return this.isWaitingForCorrect && this.activePattern !== null;
    }
    
    /**
     * Get current active pattern info
     */
    getActivePatternInfo() {
        if (!this.isActive()) {
            return {
                isActive: false,
                message: "No active pattern. AI is in WAIT mode."
            };
        }
        
        return {
            isActive: true,
            pattern: this.activePattern,
            protectionType: this.activeProtectionType,
            recentData: this.activeRecentData,
            previousData: this.activePreviousData,
            ruleDescription: `${this.activeProtectionType} = ${this.activeProtectionType === 'CONTINUE' ? this.activeRecentData : this.activePreviousData}`,
            consecutiveWrongCount: this.consecutiveWrongCount,
            message: `Active: ${this.activePattern} | Rule: ${this.activeProtectionType} = ${this.activeProtectionType === 'CONTINUE' ? this.activeRecentData : this.activePreviousData} | Wrong attempts: ${this.consecutiveWrongCount}`
        };
    }
    
    /**
     * Record a prediction for future learning
     */
    recordPrediction(predictionData) {
        this.patternHistory.unshift({
            ...predictionData,
            id: Date.now()
        });
        
        if (this.patternHistory.length > 1000) {
            this.patternHistory.pop();
        }
    }
    
    /**
     * Get pattern statistics with learning data
     */
    getPatternStats() {
        const stats = {};
        
        for (const pattern of this.patterns) {
            const occ = this.patternOccurrences[pattern];
            const mapping = this.patternMapping[pattern];
            stats[pattern] = {
                occurrences: occ.count,
                lastSeen: occ.lastSeen,
                continueAccuracy: Math.round(occ.continueAccuracy),
                switchAccuracy: Math.round(occ.switchAccuracy),
                continueStats: `${occ.continueCorrect}/${occ.continueCount}`,
                switchStats: `${occ.switchCorrect}/${occ.switchCount}`,
                recommendedProtection: occ.continueAccuracy > occ.switchAccuracy ? "CONTINUE" : (occ.switchAccuracy > occ.continueAccuracy ? "SWITCH" : "CONTINUE (default)"),
                recentData: mapping.recentData,
                previousData: mapping.previousData,
                description: mapping.description
            };
        }
        
        return stats;
    }
    
    /**
     * Get overall AI stats
     */
    getStats() {
        return {
            name: this.name,
            version: this.version,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy,
            patternsCount: this.patterns.length,
            patternHistoryLength: this.patternHistory.length,
            isActive: this.isActive(),
            activePatternInfo: this.getActivePatternInfo(),
            patternStats: this.getPatternStats()
        };
    }
    
    /**
     * Get current accuracy
     */
    getAccuracy() {
        return this.accuracy;
    }
    
    /**
     * Export state for database persistence
     */
    exportState() {
        return {
            version: this.version,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy,
            patternOccurrences: this.patternOccurrences,
            patternHistory: this.patternHistory.slice(0, 100),
            activePattern: this.activePattern,
            activeProtectionType: this.activeProtectionType,
            activeRecentData: this.activeRecentData,
            activePreviousData: this.activePreviousData,
            isWaitingForCorrect: this.isWaitingForCorrect,
            consecutiveWrongCount: this.consecutiveWrongCount
        };
    }
    
    /**
     * Load state from database
     */
    loadState(state) {
        if (!state) return;
        
        this.version = state.version || this.version;
        this.totalPredictions = state.totalPredictions || 0;
        this.correctPredictions = state.correctPredictions || 0;
        this.accuracy = state.accuracy || 0;
        
        if (state.patternOccurrences) {
            this.patternOccurrences = state.patternOccurrences;
        }
        
        if (state.patternHistory) {
            this.patternHistory = state.patternHistory;
        }
        
        if (state.activePattern) {
            this.activePattern = state.activePattern;
            this.activeProtectionType = state.activeProtectionType;
            this.activeRecentData = state.activeRecentData;
            this.activePreviousData = state.activePreviousData;
            this.isWaitingForCorrect = state.isWaitingForCorrect || false;
            this.consecutiveWrongCount = state.consecutiveWrongCount || 0;
            
            if (this.isWaitingForCorrect) {
                console.log(`🔄 Loaded active pattern: ${this.activePattern} (${this.consecutiveWrongCount} wrong attempts)`);
            }
        }
        
        console.log(`📀 AI state loaded: ${this.totalPredictions} predictions, ${this.accuracy.toFixed(1)}% accuracy`);
    }
    
    /**
     * Force reset
     */
    forceReset() {
        console.log(`🔧 Manual force reset triggered.`);
        this.resetActivePattern();
        return {
            success: true,
            message: "AI has been reset. Now in WAIT mode."
        };
    }
    
    /**
     * Get available protection types
     */
    getProtectionTypes() {
        return ['CONTINUE', 'SWITCH'];
    }
    
    /**
     * Get all defined patterns
     */
    getAllPatterns() {
        return this.patterns;
    }
    
    /**
     * Get pattern mapping
     */
    getPatternMapping() {
        return this.patternMapping;
    }
    
    /**
     * Set protection type for current active pattern
     */
    setNextProtectionType(protectionType) {
        if (!this.getProtectionTypes().includes(protectionType)) {
            console.log(`⚠️ Invalid protection type: ${protectionType}`);
            return false;
        }
        
        if (this.isActive()) {
            console.log(`🔄 Updating active pattern protection from ${this.activeProtectionType} to ${protectionType}`);
            this.activeProtectionType = protectionType;
        }
        
        console.log(`🔧 Protection type set to: ${protectionType}`);
        return true;
    }
    
    /**
     * Get rule description for a pattern
     */
    getRuleDescription(patternString) {
        const mapping = this.patternMapping[patternString];
        if (!mapping) return null;
        
        return {
            pattern: patternString,
            continueRule: `CONTINUE = Recent Data (${mapping.recentData})`,
            switchRule: `SWITCH = Previous Data (${mapping.previousData})`,
            description: mapping.description
        };
    }
}

// ============================================================
// Helper functions
// ============================================================

function createPatternFromResults(results) {
    if (!results || results.length < 3) {
        return null;
    }
    const last3 = results.slice(-3);
    return `${last3[0]}→${last3[1]}→${last3[2]}`;
}

function isValidPattern(patternString) {
    const validPatterns = [
        "LOW→HIGH→MEDIUM",
        "HIGH→LOW→MEDIUM",
        "MEDIUM→LOW→HIGH",
        "MEDIUM→HIGH→LOW",
        "LOW→MEDIUM→HIGH",
        "HIGH→MEDIUM→LOW"
    ];
    return validPatterns.includes(patternString);
}

// ============================================================
// EXPORT
// ============================================================
module.exports = {
    NewPatternAI,
    createPatternFromResults,
    isValidPattern
};
