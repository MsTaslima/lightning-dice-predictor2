// ============================================================
// new-ai-logic.js (v7.0 - 3-Step Pattern AI)
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
// - When pattern matches → Predict using CONTINUE or SWITCH
// - When pattern DOES NOT match → WAIT (no prediction)
// ============================================================

class NewPatternAI {
    constructor() {
        this.version = "7.0";
        this.name = "3-Step Pattern AI";
        
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
        // For each pattern, define:
        // - continueGroup: রিসেন্ট ডাটা (সর্বশেষ রেজাল্ট)
        // - switchGroup: রিসেন্ট এর আগের ডাটা (দ্বিতীয় রেজাল্ট)
        
        this.patternMapping = {
            // Pattern 1: LOW → HIGH → MEDIUM
            "LOW→HIGH→MEDIUM": {
                continueGroup: "MEDIUM",  // রিসেন্ট ডাটা
                switchGroup: "HIGH",      // রিসেন্ট এর আগের ডাটা
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
        
        // Recent pattern occurrences (for frequency analysis)
        this.patternOccurrences = {};
        
        // Initialize pattern occurrences counter
        for (const pattern of this.patterns) {
            this.patternOccurrences[pattern] = {
                count: 0,
                lastSeen: null,
                continueAccuracy: 0,
                switchAccuracy: 0
            };
        }
        
        console.log(`🤖 ${this.name} initialized with ${this.patterns.length} patterns`);
    }
    
    /**
     * Get last 3 results as a pattern string
     * @param {Array} last3Results - Array of 3 groups ['LOW', 'HIGH', 'MEDIUM']
     * @returns {string|null} Pattern string like "LOW→HIGH→MEDIUM" or null if invalid
     */
    getPatternString(last3Results) {
        if (!last3Results || last3Results.length !== 3) {
            return null;
        }
        return `${last3Results[0]}→${last3Results[1]}→${last3Results[2]}`;
    }
    
    /**
     * Check if a pattern matches any of the 6 defined patterns
     * @param {string} patternString - Pattern to check
     * @returns {boolean} True if pattern matches
     */
    isPatternMatch(patternString) {
        return this.patterns.includes(patternString);
    }
    
    /**
     * Get prediction for a matched pattern
     * @param {string} patternString - Matched pattern
     * @param {string} protectionType - Either 'CONTINUE' or 'SWITCH'
     * @returns {object} Prediction result
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
            // Adjust confidence based on historical accuracy
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
     * MAIN PREDICTION FUNCTION
     * @param {Array} last3Results - Array of last 3 results ['LOW', 'HIGH', 'MEDIUM']
     * @param {string} protectionType - 'CONTINUE' or 'SWITCH' (optional, can be auto-decided)
     * @returns {object} Prediction result
     */
    predict(last3Results, protectionType = null) {
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
                message: `Pattern "${patternString}" does not match any known pattern. Waiting for next result.`,
                waitingForData: true,
                matchedPatterns: this.patterns
            };
        }
        
        // Pattern matched! Now decide protection type if not provided
        let finalProtectionType = protectionType;
        let decisionMethod = "provided";
        
        if (!finalProtectionType) {
            // TODO: You can implement auto-decision logic here
            // For now, default to CONTINUE
            finalProtectionType = "CONTINUE";
            decisionMethod = "auto (default CONTINUE)";
            
            // Optional: You can analyze pattern frequency to decide
            // const occurrence = this.patternOccurrences[patternString];
            // if (occurrence.count > 5) {
            //     // Use historical best protection type
            //     finalProtectionType = occurrence.continueAccuracy > occurrence.switchAccuracy ? "CONTINUE" : "SWITCH";
            //     decisionMethod = "auto (based on historical accuracy)";
            // }
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
        
        // Record this prediction for future learning
        this.recordPrediction({
            pattern: patternString,
            protectionType: finalProtectionType,
            predictedGroup: prediction.predictedGroup,
            timestamp: new Date().toISOString(),
            confidence: prediction.confidence,
            actualGroup: null // Will be filled later
        });
        
        console.log(`✅ Pattern MATCHED!`);
        console.log(`   Pattern: ${patternString}`);
        console.log(`   Protection: ${finalProtectionType}`);
        console.log(`   Prediction: ${prediction.predictedGroup} (${prediction.confidence}% confidence)`);
        console.log(`   ${prediction.description}`);
        
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
            last3Results: last3Results
        };
    }
    
    /**
     * Update AI with actual result (for learning)
     * @param {string} actualGroup - The actual result that occurred
     */
    updateWithResult(actualGroup) {
        // Find the most recent pending prediction
        const pendingIndex = this.patternHistory.findIndex(p => p.actualGroup === null);
        
        if (pendingIndex === -1) {
            console.log(`⚠️ No pending prediction to update`);
            return;
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
            
            if (prediction.protectionType === "CONTINUE") {
                const correctCount = occurrence.continueAccuracy * occurrence.count / 100;
                const newCorrectCount = correctCount + (prediction.isCorrect ? 1 : 0);
                occurrence.continueAccuracy = (newCorrectCount / occurrence.count) * 100;
            } else if (prediction.protectionType === "SWITCH") {
                const correctCount = occurrence.switchAccuracy * occurrence.count / 100;
                const newCorrectCount = correctCount + (prediction.isCorrect ? 1 : 0);
                occurrence.switchAccuracy = (newCorrectCount / occurrence.count) * 100;
            }
        }
        
        console.log(`📊 Updated AI with result: ${actualGroup}`);
        console.log(`   Prediction was ${prediction.isCorrect ? '✓ CORRECT' : '✗ WRONG'}`);
        console.log(`   Current accuracy: ${this.accuracy.toFixed(1)}%`);
        
        return {
            isCorrect: prediction.isCorrect,
            predictedGroup: prediction.predictedGroup,
            actualGroup: actualGroup,
            newAccuracy: this.accuracy
        };
    }
    
    /**
     * Record a prediction for future learning
     * @param {object} predictionData - Prediction details
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
     * @returns {object} Pattern statistics
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
                mapping: this.patternMapping[pattern]
            };
        }
        
        return stats;
    }
    
    /**
     * Get overall AI stats
     * @returns {object} AI statistics
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
            patternStats: this.getPatternStats()
        };
    }
    
    /**
     * Get current accuracy
     * @returns {number} Accuracy percentage
     */
    getAccuracy() {
        return this.accuracy;
    }
    
    /**
     * Export state for database persistence
     * @returns {object} State object
     */
    exportState() {
        return {
            version: this.version,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy,
            patternOccurrences: this.patternOccurrences,
            patternHistory: this.patternHistory.slice(0, 100) // Last 100 predictions
        };
    }
    
    /**
     * Load state from database
     * @param {object} state - Saved state
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
        
        console.log(`📀 AI state loaded: ${this.totalPredictions} predictions, ${this.accuracy.toFixed(1)}% accuracy`);
    }
    
    /**
     * Get available protection types
     * @returns {Array} List of protection types
     */
    getProtectionTypes() {
        return ['CONTINUE', 'SWITCH'];
    }
    
    /**
     * Get all defined patterns
     * @returns {Array} List of patterns
     */
    getAllPatterns() {
        return this.patterns;
    }
    
    /**
     * Get pattern mapping
     * @returns {object} Pattern mapping
     */
    getPatternMapping() {
        return this.patternMapping;
    }
    
    /**
     * Manual decision: Force CONTINUE or SWITCH for next prediction
     * @param {string} protectionType - 'CONTINUE' or 'SWITCH'
     */
    setNextProtectionType(protectionType) {
        if (!this.getProtectionTypes().includes(protectionType)) {
            console.log(`⚠️ Invalid protection type: ${protectionType}`);
            return false;
        }
        this.nextProtectionType = protectionType;
        console.log(`🔧 Next prediction will use: ${protectionType}`);
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
