// ============================================================
// new-ai-logic.js (v10.0 - Dynamic CONTINUE/SWITCH with Real-Time Learning)
// 
// 6 Patterns for 3-Step Detection (ONLY for pattern detection trigger):
// 1. LOW → HIGH → MEDIUM
// 2. HIGH → LOW → MEDIUM
// 3. MEDIUM → LOW → HIGH
// 4. MEDIUM → HIGH → LOW
// 5. LOW → MEDIUM → HIGH
// 6. HIGH → MEDIUM → LOW
//
// Rules (UPDATED v10.0):
// - When pattern matches → START prediction mode with CONTINUE or SWITCH
// - CONTINUE = Last result (always updates with each new result)
// - SWITCH = Previous result (always updates with each new result)
// - When prediction is WRONG → Keep predicting with SAME protection type
// - When prediction is CORRECT → Go back to WAIT mode
// - AI learns from history to choose better protection type over time
// ============================================================

class NewPatternAI {
    constructor() {
        this.version = "10.0";
        this.name = "Dynamic 3-Step Pattern AI with Real-Time Learning";
        
        // Define the 6 patterns (ONLY for detection trigger)
        this.patterns = [
            "LOW→HIGH→MEDIUM",
            "HIGH→LOW→MEDIUM",
            "MEDIUM→LOW→HIGH",
            "MEDIUM→HIGH→LOW",
            "LOW→MEDIUM→HIGH",
            "HIGH→MEDIUM→LOW"
        ];
        
        // Pattern mapping for display purposes only (not used for actual prediction values)
        this.patternMapping = {
            "LOW→HIGH→MEDIUM": {
                continueGroup: "MEDIUM",
                switchGroup: "HIGH",
                description: "LOW থেকে HIGH হয়ে MEDIUM এ এসেছে",
                recentData: "MEDIUM",
                previousData: "HIGH"
            },
            "HIGH→LOW→MEDIUM": {
                continueGroup: "MEDIUM",
                switchGroup: "LOW",
                description: "HIGH থেকে LOW হয়ে MEDIUM এ এসেছে",
                recentData: "MEDIUM",
                previousData: "LOW"
            },
            "MEDIUM→LOW→HIGH": {
                continueGroup: "HIGH",
                switchGroup: "LOW",
                description: "MEDIUM থেকে LOW হয়ে HIGH এ এসেছে",
                recentData: "HIGH",
                previousData: "LOW"
            },
            "MEDIUM→HIGH→LOW": {
                continueGroup: "LOW",
                switchGroup: "HIGH",
                description: "MEDIUM থেকে HIGH হয়ে LOW এ এসেছে",
                recentData: "LOW",
                previousData: "HIGH"
            },
            "LOW→MEDIUM→HIGH": {
                continueGroup: "HIGH",
                switchGroup: "MEDIUM",
                description: "LOW থেকে MEDIUM হয়ে HIGH এ এসেছে",
                recentData: "HIGH",
                previousData: "MEDIUM"
            },
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
        
        // Active prediction tracking (for retry logic with DYNAMIC values)
        this.activePattern = null;           // Pattern that triggered the prediction mode
        this.activeProtectionType = null;    // CONTINUE or SWITCH
        this.isWaitingForCorrect = false;    // Are we in active prediction mode?
        this.consecutiveWrongCount = 0;      // How many consecutive wrong predictions
        
        // DYNAMIC values that update with each new result
        this.dynamicRecentData = null;       // Last result (for CONTINUE)
        this.dynamicPreviousData = null;     // Previous result (for SWITCH)
        
        // Last result tracking for dynamic updates
        this.lastResult = null;
        this.secondLastResult = null;
        
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
        console.log(`📋 NEW RULES (v10.0):`);
        console.log(`   - CONTINUE = Last Result (updates with each new result)`);
        console.log(`   - SWITCH = Previous Result (updates with each new result)`);
        console.log(`   - Pattern detection only TRIGGERS the prediction mode`);
        console.log(`   - After trigger, values update dynamically until correct`);
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
     * Get prediction based on DYNAMIC values (NOT from pattern mapping)
     * CONTINUE = dynamicRecentData (last result)
     * SWITCH = dynamicPreviousData (previous result)
     */
    getDynamicPrediction(protectionType) {
        if (protectionType === 'CONTINUE') {
            return {
                predictedGroup: this.dynamicRecentData,
                confidence: 75,
                description: `CONTINUE: Latest result (${this.dynamicRecentData})`
            };
        } else if (protectionType === 'SWITCH') {
            return {
                predictedGroup: this.dynamicPreviousData,
                confidence: 75,
                description: `SWITCH: Previous result (${this.dynamicPreviousData})`
            };
        } else {
            return {
                predictedGroup: null,
                confidence: 0,
                description: `Invalid protection type`
            };
        }
    }
    
    /**
     * Update dynamic values with new result
     * Called after each result when in active prediction mode
     */
    updateDynamicValues(newResult) {
        // Shift the values: new result becomes recent, old recent becomes previous
        this.dynamicPreviousData = this.dynamicRecentData;
        this.dynamicRecentData = newResult;
        
        console.log(`   📊 DYNAMIC VALUES UPDATED:`);
        console.log(`      CONTINUE (Last) = ${this.dynamicRecentData}`);
        console.log(`      SWITCH (Previous) = ${this.dynamicPreviousData}`);
    }
    
    /**
     * Initialize dynamic values from a pattern
     * Sets the initial values when pattern is first detected
     */
    initializeDynamicValuesFromPattern(patternString) {
        const patternData = this.getPatternData(patternString);
        if (patternData) {
            this.dynamicRecentData = patternData.recentData;   // 3rd result of pattern
            this.dynamicPreviousData = patternData.previousData; // 2nd result of pattern
            this.lastResult = this.dynamicRecentData;
            this.secondLastResult = this.dynamicPreviousData;
            
            console.log(`   🎯 DYNAMIC VALUES INITIALIZED:`);
            console.log(`      CONTINUE (Last) = ${this.dynamicRecentData}`);
            console.log(`      SWITCH (Previous) = ${this.dynamicPreviousData}`);
        }
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
        this.isWaitingForCorrect = false;
        this.consecutiveWrongCount = 0;
        this.dynamicRecentData = null;
        this.dynamicPreviousData = null;
        this.lastResult = null;
        this.secondLastResult = null;
    }
    
    /**
     * MAIN PREDICTION FUNCTION
     */
    predict(last3Results, currentResultForUpdate = null, protectionType = null) {
        
        // CASE 1: Active pattern exists - we are in prediction mode
        if (this.isWaitingForCorrect && this.activePattern) {
            console.log(`🔄 Active prediction mode (wrong count: ${this.consecutiveWrongCount})`);
            console.log(`   Protection Type: ${this.activeProtectionType}`);
            console.log(`   DYNAMIC CONTINUE (Last) = ${this.dynamicRecentData}`);
            console.log(`   DYNAMIC SWITCH (Previous) = ${this.dynamicPreviousData}`);
            
            // Get prediction using dynamic values
            const prediction = this.getDynamicPrediction(this.activeProtectionType);
            
            if (!prediction.predictedGroup) {
                console.log(`⚠️ Failed to get prediction for active pattern, resetting...`);
                this.resetActivePattern();
                return this.predict(last3Results, currentResultForUpdate, protectionType);
            }
            
            // Calculate confidence based on historical data
            let confidence = 70;
            const occurrence = this.patternOccurrences[this.activePattern];
            if (occurrence) {
                const histAccuracy = this.activeProtectionType === 'CONTINUE' ? 
                    occurrence.continueAccuracy : occurrence.switchAccuracy;
                confidence = Math.min(92, Math.max(45, (confidence + histAccuracy) / 2));
            }
            
            this.recordPrediction({
                pattern: this.activePattern,
                protectionType: this.activeProtectionType,
                predictedGroup: prediction.predictedGroup,
                timestamp: new Date().toISOString(),
                confidence: confidence,
                actualGroup: null,
                isRetry: this.consecutiveWrongCount > 0,
                retryNumber: this.consecutiveWrongCount
            });
            
            console.log(`🎯 PREDICTION (${this.consecutiveWrongCount > 0 ? 'RETRY #' + this.consecutiveWrongCount : 'INITIAL'})`);
            console.log(`   Rule: ${this.activeProtectionType} = ${this.activeProtectionType === 'CONTINUE' ? this.dynamicRecentData : this.dynamicPreviousData}`);
            console.log(`   Prediction: ${prediction.predictedGroup}`);
            
            return {
                status: "PREDICTION_READY",
                pattern: this.activePattern,
                protectionType: this.activeProtectionType,
                predictedGroup: prediction.predictedGroup,
                confidence: Math.round(confidence),
                continueGroup: this.dynamicRecentData,
                switchGroup: this.dynamicPreviousData,
                recentData: this.dynamicRecentData,
                previousData: this.dynamicPreviousData,
                description: prediction.description,
                waitingForData: false,
                isRetry: this.consecutiveWrongCount > 0,
                retryCount: this.consecutiveWrongCount,
                message: `${this.consecutiveWrongCount > 0 ? `Retry #${this.consecutiveWrongCount}` : 'Initial prediction'}: Using ${this.activeProtectionType} rule.`,
                last3Results: last3Results
            };
        }
        
        // CASE 2: Need to check for new pattern (WAIT mode)
        if (!last3Results || last3Results.length !== 3) {
            console.log(`⚠️ Cannot detect pattern: need exactly 3 results, got ${last3Results?.length || 0}`);
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
        
        // CASE 3: Pattern does NOT match - stay in WAIT mode
        if (!this.isPatternMatch(patternString)) {
            console.log(`❌ Pattern does NOT match any of the 6 patterns. Staying in WAIT mode.`);
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
        
        // CASE 4: Pattern matched! START prediction mode
        console.log(`✅ Pattern MATCHED! Starting prediction mode.`);
        
        const patternData = this.getPatternData(patternString);
        
        // Initialize dynamic values from the pattern
        this.initializeDynamicValuesFromPattern(patternString);
        
        // Decide protection type
        let finalProtectionType = protectionType;
        let decisionMethod = "provided";
        
        if (!finalProtectionType) {
            const decision = this.decideProtectionType(patternString);
            finalProtectionType = decision.type;
            decisionMethod = decision.method;
        }
        
        console.log(`   Selected Protection: ${finalProtectionType} (${decisionMethod})`);
        
        // Get prediction using dynamic values
        const prediction = this.getDynamicPrediction(finalProtectionType);
        
        if (!prediction.predictedGroup) {
            return {
                status: "ERROR",
                pattern: patternString,
                protectionType: finalProtectionType,
                predictedGroup: null,
                confidence: 0,
                message: "Failed to get prediction",
                waitingForData: false
            };
        }
        
        // Calculate confidence
        let confidence = 70;
        const occurrence = this.patternOccurrences[patternString];
        if (occurrence) {
            const histAccuracy = finalProtectionType === 'CONTINUE' ? 
                occurrence.continueAccuracy : occurrence.switchAccuracy;
            confidence = Math.min(92, Math.max(45, (confidence + histAccuracy) / 2));
        }
        
        // ACTIVATE THE PREDICTION MODE
        this.activePattern = patternString;
        this.activeProtectionType = finalProtectionType;
        this.isWaitingForCorrect = true;
        this.consecutiveWrongCount = 0;
        
        this.recordPrediction({
            pattern: patternString,
            protectionType: finalProtectionType,
            predictedGroup: prediction.predictedGroup,
            timestamp: new Date().toISOString(),
            confidence: Math.round(confidence),
            actualGroup: null,
            isRetry: false,
            retryNumber: 0,
            recentData: this.dynamicRecentData,
            previousData: this.dynamicPreviousData
        });
        
        console.log(`🎯 PREDICTION MODE ACTIVATED`);
        console.log(`   Pattern: ${patternString}`);
        console.log(`   Protection: ${finalProtectionType}`);
        console.log(`   Rule: ${finalProtectionType} = ${finalProtectionType === 'CONTINUE' ? this.dynamicRecentData : this.dynamicPreviousData}`);
        console.log(`   Prediction: ${prediction.predictedGroup} (${Math.round(confidence)}% confidence)`);
        console.log(`   📌 Will retry with SAME ${finalProtectionType} rule until CORRECT`);
        console.log(`   📌 Values will UPDATE dynamically with each new result`);
        
        return {
            status: "PREDICTION_READY",
            pattern: patternString,
            protectionType: finalProtectionType,
            predictedGroup: prediction.predictedGroup,
            confidence: Math.round(confidence),
            continueGroup: this.dynamicRecentData,
            switchGroup: this.dynamicPreviousData,
            recentData: this.dynamicRecentData,
            previousData: this.dynamicPreviousData,
            description: prediction.description,
            decisionMethod: decisionMethod,
            waitingForData: false,
            isActive: true,
            message: `Pattern matched! Using ${finalProtectionType} rule. Values will update dynamically.`,
            last3Results: last3Results
        };
    }
    
    /**
     * Update AI with actual result
     * This is called AFTER a result comes in
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
        
        console.log(`📊 UPDATE RESULT:`);
        console.log(`   Pattern: ${prediction.pattern}`);
        console.log(`   Protection: ${prediction.protectionType}`);
        console.log(`   Predicted: ${prediction.predictedGroup} → Actual: ${actualGroup}`);
        console.log(`   Result: ${prediction.isCorrect ? '✓ CORRECT' : '✗ WRONG'}`);
        
        if (occurrence) {
            console.log(`   Pattern Stats - CONTINUE: ${occurrence.continueAccuracy.toFixed(1)}% (${occurrence.continueCorrect}/${occurrence.continueCount}) | SWITCH: ${occurrence.switchAccuracy.toFixed(1)}% (${occurrence.switchCorrect}/${occurrence.switchCount})`);
        }
        console.log(`   Overall Accuracy: ${this.accuracy.toFixed(1)}% (${this.correctPredictions}/${this.totalPredictions})`);
        
        // Handle the result
        if (prediction.isCorrect) {
            console.log(`✅ CORRECT! Resetting prediction mode. Going back to WAIT mode.`);
            console.log(`   Wrong attempts for this session: ${this.consecutiveWrongCount}`);
            this.resetActivePattern();
            
            return {
                isCorrect: true,
                predictedGroup: prediction.predictedGroup,
                actualGroup: actualGroup,
                newAccuracy: this.accuracy,
                resetPattern: true,
                message: "Correct prediction! Reset to WAIT mode."
            };
        } else {
            // WRONG prediction - update dynamic values and retry with SAME protection type
            this.consecutiveWrongCount++;
            
            // CRITICAL: Update dynamic values with the actual result
            // This ensures CONTINUE now points to the latest result
            console.log(`❌ WRONG! Updating dynamic values with actual result: ${actualGroup}`);
            this.updateDynamicValues(actualGroup);
            
            console.log(`   Keeping SAME protection type: ${this.activeProtectionType}`);
            console.log(`   Wrong count: ${this.consecutiveWrongCount}`);
            console.log(`   NEW DYNAMIC VALUES - CONTINUE: ${this.dynamicRecentData}, SWITCH: ${this.dynamicPreviousData}`);
            console.log(`   Will retry with ${this.activeProtectionType} = ${this.activeProtectionType === 'CONTINUE' ? this.dynamicRecentData : this.dynamicPreviousData}`);
            
            return {
                isCorrect: false,
                predictedGroup: prediction.predictedGroup,
                actualGroup: actualGroup,
                newAccuracy: this.accuracy,
                keepPattern: true,
                consecutiveWrongCount: this.consecutiveWrongCount,
                message: `Wrong prediction! Updated values. Retrying with SAME ${this.activeProtectionType} rule. Attempt #${this.consecutiveWrongCount + 1}`,
                activePattern: this.activePattern,
                activeProtectionType: this.activeProtectionType,
                newContinueValue: this.dynamicRecentData,
                newSwitchValue: this.dynamicPreviousData
            };
        }
    }
    
    /**
     * Update dynamic values externally (called when a new result comes in)
     * This method is called by server.js when a new result is detected
     */
    updateWithNewResult(newResult) {
        if (this.isWaitingForCorrect && this.activePattern) {
            console.log(`🔄 New result detected while in prediction mode: ${newResult}`);
            this.updateDynamicValues(newResult);
            return {
                updated: true,
                continueValue: this.dynamicRecentData,
                switchValue: this.dynamicPreviousData,
                message: `Dynamic values updated with new result: ${newResult}`
            };
        }
        return {
            updated: false,
            message: "Not in prediction mode, no update needed"
        };
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
            continueValue: this.dynamicRecentData,
            switchValue: this.dynamicPreviousData,
            ruleDescription: `${this.activeProtectionType} = ${this.activeProtectionType === 'CONTINUE' ? this.dynamicRecentData : this.dynamicPreviousData}`,
            consecutiveWrongCount: this.consecutiveWrongCount,
            message: `Active: ${this.activePattern} | Rule: ${this.activeProtectionType} = ${this.activeProtectionType === 'CONTINUE' ? this.dynamicRecentData : this.dynamicPreviousData} | Wrong attempts: ${this.consecutiveWrongCount}`
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
     * Get current dynamic values
     */
    getDynamicValues() {
        return {
            continueValue: this.dynamicRecentData,
            switchValue: this.dynamicPreviousData,
            isActive: this.isActive(),
            protectionType: this.activeProtectionType,
            consecutiveWrongCount: this.consecutiveWrongCount
        };
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
            isWaitingForCorrect: this.isWaitingForCorrect,
            consecutiveWrongCount: this.consecutiveWrongCount,
            dynamicRecentData: this.dynamicRecentData,
            dynamicPreviousData: this.dynamicPreviousData,
            lastResult: this.lastResult,
            secondLastResult: this.secondLastResult
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
            this.isWaitingForCorrect = state.isWaitingForCorrect || false;
            this.consecutiveWrongCount = state.consecutiveWrongCount || 0;
            this.dynamicRecentData = state.dynamicRecentData || null;
            this.dynamicPreviousData = state.dynamicPreviousData || null;
            this.lastResult = state.lastResult || null;
            this.secondLastResult = state.secondLastResult || null;
            
            if (this.isWaitingForCorrect) {
                console.log(`🔄 Loaded active pattern: ${this.activePattern} (${this.consecutiveWrongCount} wrong attempts)`);
                console.log(`   Loaded dynamic values - CONTINUE: ${this.dynamicRecentData}, SWITCH: ${this.dynamicPreviousData}`);
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
    setProtectionType(protectionType) {
        if (!this.getProtectionTypes().includes(protectionType)) {
            console.log(`⚠️ Invalid protection type: ${protectionType}`);
            return false;
        }
        
        if (this.isActive()) {
            console.log(`🔄 Updating active protection type from ${this.activeProtectionType} to ${protectionType}`);
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
            continueRule: `CONTINUE = Last Result (dynamic)`,
            switchRule: `SWITCH = Previous Result (dynamic)`,
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
