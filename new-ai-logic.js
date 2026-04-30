// ============================================================
// new-ai-logic.js (v7.0 - 3-Step Pattern AI with Retry Logic)
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
// - When prediction is WRONG → Keep predicting (same pattern, no WAIT)
// - When prediction is CORRECT → Go back to WAIT mode, search for new pattern
// - When pattern does NOT match → WAIT (no prediction)
// ============================================================

class NewPatternAI {
    constructor() {
        this.version = "8.0";
        this.name = "3-Step Pattern AI with Retry";
        
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
        this.patternMapping = {
            // Pattern 1: LOW → HIGH → MEDIUM
            "LOW→HIGH→MEDIUM": {
                continueGroup: "MEDIUM",
                switchGroup: "HIGH",
                description: "LOW থেকে HIGH হয়ে MEDIUM এ এসেছে"
            },
            // Pattern 2: HIGH → LOW → MEDIUM
            "HIGH→LOW→MEDIUM": {
                continueGroup: "MEDIUM",
                switchGroup: "LOW",
                description: "HIGH থেকে LOW হয়ে MEDIUM এ এসেছে"
            },
            // Pattern 3: MEDIUM → LOW → HIGH
            "MEDIUM→LOW→HIGH": {
                continueGroup: "HIGH",
                switchGroup: "LOW",
                description: "MEDIUM থেকে LOW হয়ে HIGH এ এসেছে"
            },
            // Pattern 4: MEDIUM → HIGH → LOW
            "MEDIUM→HIGH→LOW": {
                continueGroup: "LOW",
                switchGroup: "HIGH",
                description: "MEDIUM থেকে HIGH হয়ে LOW এ এসেছে"
            },
            // Pattern 5: LOW → MEDIUM → HIGH
            "LOW→MEDIUM→HIGH": {
                continueGroup: "HIGH",
                switchGroup: "MEDIUM",
                description: "LOW থেকে MEDIUM হয়ে HIGH এ এসেছে"
            },
            // Pattern 6: HIGH → MEDIUM → LOW
            "HIGH→MEDIUM→LOW": {
                continueGroup: "LOW",
                switchGroup: "MEDIUM",
                description: "HIGH থেকে MEDIUM হয়ে LOW এ এসেছে"
            }
        };
        
        // Pattern tracking history
        this.patternHistory = [];
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        
        // Active pattern tracking (for retry logic)
        this.activePattern = null;        // Currently active pattern that matched
        this.activeProtectionType = null; // CONTINUE or SWITCH for this pattern
        this.activeRecentData = null;     // Recent data (last result of the 3)
        this.activePreviousData = null;   // Previous data (second result of the 3)
        this.isWaitingForCorrect = false; // Are we waiting for the prediction to be correct?
        this.consecutiveWrongCount = 0;   // How many times we were wrong consecutively
        
        // Recent pattern occurrences (for frequency analysis)
        this.patternOccurrences = {};
        
        // Initialize pattern occurrences counter
        for (const pattern of this.patterns) {
            this.patternOccurrences[pattern] = {
                count: 0,
                lastSeen: null,
                continueAccuracy: 0,
                switchAccuracy: 0,
                correctCount: 0,
                wrongCount: 0
            };
        }
        
        console.log(`🤖 ${this.name} initialized with ${this.patterns.length} patterns`);
        console.log(`📋 Rules: Pattern match = immediate prediction | Wrong = keep trying | Correct = reset to WAIT`);
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
     * Check if a pattern matches any of the 6 defined patterns
     */
    isPatternMatch(patternString) {
        return this.patterns.includes(patternString);
    }
    
    /**
     * Get prediction for a matched pattern
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
        let confidence = 75; // Base confidence
        
        if (protectionType === 'CONTINUE') {
            predictedGroup = mapping.continueGroup;
            const histAccuracy = this.patternOccurrences[patternString]?.continueAccuracy || 50;
            confidence = Math.min(95, Math.max(50, (confidence + histAccuracy) / 2));
        } else if (protectionType === 'SWITCH') {
            predictedGroup = mapping.switchGroup;
            const histAccuracy = this.patternOccurrences[patternString]?.switchAccuracy || 50;
            confidence = Math.min(95, Math.max(50, (confidence + histAccuracy) / 2));
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
            description: mapping.description
        };
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
     * MAIN PREDICTION FUNCTION (UPDATED for v8.0)
     * Rules:
     * 1. If we have an active pattern and waiting for correct prediction → predict again (retry)
     * 2. Else check last 3 results for pattern match
     * 3. If pattern matches → predict immediately, activate pattern
     * 4. If pattern does NOT match → WAIT
     */
    predict(last3Results, protectionType = null) {
        // ============ CASE 1: We have an active pattern (waiting for correct prediction) ============
        if (this.isWaitingForCorrect && this.activePattern) {
            console.log(`🔄 Active pattern exists. Retrying prediction (wrong count: ${this.consecutiveWrongCount})`);
            console.log(`   Active Pattern: ${this.activePattern}`);
            console.log(`   Protection Type: ${this.activeProtectionType}`);
            
            // Get prediction using the active pattern
            const prediction = this.getPredictionForPattern(this.activePattern, this.activeProtectionType);
            
            if (!prediction.predictedGroup) {
                console.log(`⚠️ Failed to get prediction for active pattern, resetting...`);
                this.resetActivePattern();
                return this.predict(last3Results, protectionType);
            }
            
            // Record this retry prediction
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
            console.log(`   Pattern: ${this.activePattern}`);
            console.log(`   Protection: ${this.activeProtectionType}`);
            console.log(`   Prediction: ${prediction.predictedGroup} (${prediction.confidence}% confidence)`);
            console.log(`   ⚠️ Still waiting for CORRECT prediction...`);
            
            return {
                status: "PREDICTION_READY",
                pattern: this.activePattern,
                protectionType: this.activeProtectionType,
                predictedGroup: prediction.predictedGroup,
                confidence: prediction.confidence,
                continueGroup: prediction.continueGroup,
                switchGroup: prediction.switchGroup,
                description: prediction.description,
                waitingForData: false,
                isRetry: true,
                retryCount: this.consecutiveWrongCount + 1,
                message: `Retry #${this.consecutiveWrongCount + 1}: Pattern already matched, predicting again until correct.`,
                last3Results: last3Results
            };
        }
        
        // ============ CASE 2: Need to check for new pattern ============
        
        // Validate input
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
        
        // Check if pattern matches
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
        
        // ============ CASE 3: Pattern matched! Activate and predict immediately ============
        console.log(`✅ Pattern MATCHED! Activating and predicting immediately.`);
        
        // Extract recent and previous data from the pattern
        const patternParts = patternString.split('→');
        const recentData = patternParts[2];     // 3rd result (most recent)
        const previousData = patternParts[1];   // 2nd result
        
        // Decide protection type if not provided
        let finalProtectionType = protectionType;
        let decisionMethod = "provided";
        
        if (!finalProtectionType) {
            // Auto-decision based on historical accuracy
            const occurrence = this.patternOccurrences[patternString];
            if (occurrence && occurrence.count > 3) {
                // Choose the more accurate protection type
                if (occurrence.continueAccuracy > occurrence.switchAccuracy) {
                    finalProtectionType = "CONTINUE";
                } else if (occurrence.switchAccuracy > occurrence.continueAccuracy) {
                    finalProtectionType = "SWITCH";
                } else {
                    finalProtectionType = "CONTINUE"; // Default
                }
                decisionMethod = "auto (based on historical accuracy)";
            } else {
                finalProtectionType = "CONTINUE"; // Default for new patterns
                decisionMethod = "auto (default CONTINUE)";
            }
            console.log(`   Auto-decided protection: ${finalProtectionType}`);
        }
        
        // Get prediction for the pattern
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
        
        // ACTIVATE THE PATTERN - we will keep predicting until correct
        this.activePattern = patternString;
        this.activeProtectionType = finalProtectionType;
        this.activeRecentData = recentData;
        this.activePreviousData = previousData;
        this.isWaitingForCorrect = true;
        this.consecutiveWrongCount = 0;
        
        // Record this prediction
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
        
        console.log(`🎯 NEW PATTERN ACTIVATED!`);
        console.log(`   Pattern: ${patternString}`);
        console.log(`   Protection: ${finalProtectionType}`);
        console.log(`   Recent Data: ${recentData}`);
        console.log(`   Previous Data: ${previousData}`);
        console.log(`   Prediction: ${prediction.predictedGroup} (${prediction.confidence}% confidence)`);
        console.log(`   ${prediction.description}`);
        console.log(`   📌 This pattern is now ACTIVE. Will keep predicting until CORRECT.`);
        
        return {
            status: "PREDICTION_READY",
            pattern: patternString,
            protectionType: finalProtectionType,
            predictedGroup: prediction.predictedGroup,
            confidence: prediction.confidence,
            continueGroup: prediction.continueGroup,
            switchGroup: prediction.switchGroup,
            description: prediction.description,
            decisionMethod: decisionMethod,
            waitingForData: false,
            isActive: true,
            recentData: recentData,
            previousData: previousData,
            message: `Pattern matched! Predicting ${prediction.predictedGroup}. Will retry if wrong.`,
            last3Results: last3Results
        };
    }
    
    /**
     * Update AI with actual result (for learning)
     * CRITICAL: This determines if we reset the pattern or keep retrying
     */
    updateWithResult(actualGroup) {
        // Find the most recent pending prediction
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
        
        // Update accuracy statistics
        this.totalPredictions++;
        if (prediction.isCorrect) {
            this.correctPredictions++;
        }
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
        
        // Update pattern-specific accuracy
        const occurrence = this.patternOccurrences[prediction.pattern];
        if (occurrence) {
            occurrence.count++;
            occurrence.lastSeen = new Date().toISOString();
            
            if (prediction.isCorrect) {
                occurrence.correctCount++;
            } else {
                occurrence.wrongCount++;
            }
            
            if (prediction.protectionType === "CONTINUE") {
                const totalForType = occurrence.correctCount + occurrence.wrongCount;
                occurrence.continueAccuracy = (occurrence.correctCount / totalForType) * 100;
            } else if (prediction.protectionType === "SWITCH") {
                const totalForType = occurrence.correctCount + occurrence.wrongCount;
                occurrence.switchAccuracy = (occurrence.correctCount / totalForType) * 100;
            }
        }
        
        console.log(`📊 Updated AI with result: ${actualGroup}`);
        console.log(`   Predicted: ${prediction.predictedGroup} → ${prediction.isCorrect ? '✓ CORRECT' : '✗ WRONG'}`);
        console.log(`   Current accuracy: ${this.accuracy.toFixed(1)}%`);
        
        // ============ CRITICAL LOGIC: Determine if we reset or keep retrying ============
        
        if (prediction.isCorrect) {
            // CORRECT prediction! Reset everything and go back to WAIT mode
            console.log(`✅ Prediction CORRECT! Resetting active pattern. Going back to WAIT mode.`);
            console.log(`   Total wrong attempts for this pattern: ${this.consecutiveWrongCount}`);
            this.resetActivePattern();
            
            return {
                isCorrect: true,
                predictedGroup: prediction.predictedGroup,
                actualGroup: actualGroup,
                newAccuracy: this.accuracy,
                resetPattern: true,
                message: "Correct prediction! Pattern reset. Now waiting for new pattern."
            };
        } else {
            // WRONG prediction! Keep the active pattern, increment wrong count
            this.consecutiveWrongCount++;
            console.log(`❌ Prediction WRONG! Keeping active pattern. Wrong count: ${this.consecutiveWrongCount}`);
            console.log(`   Will retry prediction with same pattern next round.`);
            console.log(`   Active Pattern: ${this.activePattern}`);
            console.log(`   Protection Type: ${this.activeProtectionType}`);
            
            // isWaitingForCorrect remains TRUE, active pattern remains
            return {
                isCorrect: false,
                predictedGroup: prediction.predictedGroup,
                actualGroup: actualGroup,
                newAccuracy: this.accuracy,
                keepPattern: true,
                consecutiveWrongCount: this.consecutiveWrongCount,
                message: `Wrong prediction! Retrying with same pattern. Attempt #${this.consecutiveWrongCount + 1}`,
                activePattern: this.activePattern,
                activeProtectionType: this.activeProtectionType
            };
        }
    }
    
    /**
     * Check if AI is currently in active prediction mode (waiting for correct)
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
            consecutiveWrongCount: this.consecutiveWrongCount,
            message: `Active pattern: ${this.activePattern} using ${this.activeProtectionType}. Wrong attempts: ${this.consecutiveWrongCount}`
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
        
        // Keep only last 1000 predictions
        if (this.patternHistory.length > 1000) {
            this.patternHistory.pop();
        }
    }
    
    /**
     * Get pattern statistics
     */
    getPatternStats() {
        const stats = {};
        
        for (const pattern of this.patterns) {
            const occ = this.patternOccurrences[pattern];
            stats[pattern] = {
                occurrences: occ.count,
                lastSeen: occ.lastSeen,
                continueAccuracy: Math.round(occ.continueAccuracy),
                switchAccuracy: Math.round(occ.switchAccuracy),
                correctCount: occ.correctCount || 0,
                wrongCount: occ.wrongCount || 0,
                mapping: this.patternMapping[pattern]
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
            // Save active pattern state
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
        
        // Load active pattern state
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
     * Force reset (manual override)
     */
    forceReset() {
        console.log(`🔧 Manual force reset triggered. Resetting all active patterns.`);
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
     * Manual decision: Force CONTINUE or SWITCH for next prediction
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
}

// ============================================================
// Helper function to create pattern from results
// ============================================================
function createPatternFromResults(results) {
    if (!results || results.length < 3) {
        return null;
    }
    const last3 = results.slice(-3);
    return `${last3[0]}→${last3[1]}→${last3[2]}`;
}

// ============================================================
// Helper function to check if pattern is valid
// ============================================================
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
