// ============================================================
// server-ai-logic.js (COMPLETE NEW VERSION)
// Four AI Pattern Recognition System
// Based on your Draw.io Design
// 
// Features:
// - Length-wise tracking (1-18)
// - Score System (+25/-25, starting from 40)
// - Fallback Mode (15 results tracking)
// - Data + Score combined prediction
// ============================================================

/**
 * Base AI Class - All AIs follow same rules
 */
class BaseAI {
    constructor(name, patterns) {
        this.name = name;
        this.groups = ['LOW', 'MEDIUM', 'HIGH'];
        this.patternsList = patterns; // e.g., ["LOW→LOW", "MEDIUM→MEDIUM", "HIGH→HIGH"]
        
        // Pattern data storage: patterns[patternKey][length] = { totalBreaks, nextGroups }
        this.patterns = {};
        
        // Score storage: scores[patternKey][length][group] = score (0-100)
        this.scores = {};
        
        // Fallback tracking
        this.fallbackTracking = {
            active: false,
            lastPattern: null,
            trackedGroups: { LOW: 0, MEDIUM: 0, HIGH: 0 },
            totalTracked: 0,
            maxTrackLimit: 15
        };
        
        // Fallback scores (when no pattern)
        this.fallbackScores = {
            LOW: 40,
            MEDIUM: 40,
            HIGH: 40
        };
        
        // Current pattern tracking
        this.currentPatternKey = null;
        this.currentStreak = 0;
        
        // Statistics
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        
        // Last prediction info for score update
        this.lastPredictionInfo = null;
        
        // Initialize data structures
        this._initializeStructures();
    }
    
    _initializeStructures() {
        // Initialize for each pattern
        for (const pattern of this.patternsList) {
            this.patterns[pattern] = {};
            this.scores[pattern] = {};
            
            for (let len = 1; len <= 18; len++) {
                this.patterns[pattern][len] = {
                    totalBreaks: 0,
                    nextGroups: { LOW: 0, MEDIUM: 0, HIGH: 0 }
                };
                
                this.scores[pattern][len] = {
                    LOW: 40,
                    MEDIUM: 40,
                    HIGH: 40
                };
            }
        }
    }
    
    /**
     * Train AI with historical data
     */
    train(history) {
        if (!history || history.length < 3) return false;
        
        // Reset all data
        this._initializeStructures();
        this.fallbackTracking = {
            active: false,
            lastPattern: null,
            trackedGroups: { LOW: 0, MEDIUM: 0, HIGH: 0 },
            totalTracked: 0,
            maxTrackLimit: 15
        };
        
        let tempPattern = null;
        let tempStreak = 0;
        
        for (let i = 2; i < history.length; i++) {
            const prevPrev = history[i-2].group;
            const prev = history[i-1].group;
            const curr = history[i].group;
            
            const patternKey = `${prevPrev}→${prev}`;
            const isPatternMatch = this.patternsList.includes(patternKey);
            
            if (isPatternMatch) {
                // Check if pattern continues
                const expectedCurr = this._getExpectedNext(patternKey, tempStreak);
                
                if (curr === expectedCurr) {
                    if (tempPattern === patternKey) {
                        tempStreak++;
                    } else {
                        if (tempPattern !== null && tempStreak >= 1 && tempStreak <= 18) {
                            this._recordBreak(tempPattern, tempStreak, prev);
                        }
                        tempPattern = patternKey;
                        tempStreak = 1;
                    }
                } else {
                    if (tempPattern !== null && tempStreak >= 1 && tempStreak <= 18) {
                        this._recordBreak(tempPattern, tempStreak, curr);
                    }
                    tempPattern = null;
                    tempStreak = 0;
                }
            } else {
                if (tempPattern !== null && tempStreak >= 1 && tempStreak <= 18) {
                    this._recordBreak(tempPattern, tempStreak, curr);
                }
                tempPattern = null;
                tempStreak = 0;
            }
        }
        
        return true;
    }
    
    _getExpectedNext(patternKey, streakLength) {
        // For stick patterns, expected same as current
        if (patternKey.includes("→LOW") && patternKey.split("→")[1] === "LOW") return "LOW";
        if (patternKey.includes("→MEDIUM")) return "MEDIUM";
        if (patternKey.includes("→HIGH")) return "HIGH";
        return null;
    }
    
    _recordBreak(patternKey, streakLength, nextGroup) {
        if (streakLength >= 1 && streakLength <= 18) {
            if (this.patterns[patternKey] && this.patterns[patternKey][streakLength]) {
                this.patterns[patternKey][streakLength].totalBreaks++;
                this.patterns[patternKey][streakLength].nextGroups[nextGroup]++;
            }
        }
    }
    
    /**
     * Get group with highest count for a pattern length
     */
    _getMostFrequentGroup(patternKey, streakLength) {
        if (streakLength < 1 || streakLength > 18) return null;
        if (!this.patterns[patternKey] || !this.patterns[patternKey][streakLength]) return null;
        
        const data = this.patterns[patternKey][streakLength];
        if (data.totalBreaks === 0) return null;
        
        let maxCount = 0;
        let mostFrequentGroup = null;
        
        for (const group of this.groups) {
            const count = data.nextGroups[group] || 0;
            if (count > maxCount) {
                maxCount = count;
                mostFrequentGroup = group;
            }
        }
        
        return mostFrequentGroup;
    }
    
    /**
     * Get count for a specific group in a pattern length
     */
    _getGroupCount(patternKey, streakLength, group) {
        if (!this.patterns[patternKey] || !this.patterns[patternKey][streakLength]) {
            return 0;
        }
        return this.patterns[patternKey][streakLength].nextGroups[group] || 0;
    }
    
    /**
     * Decide prediction based on data count AND scores
     * Rule: যার ডাটা বেশি সে প্রাধান্য পাবে
     *       ডাটা সমান হলে → স্কোর দেখবে
     *       স্কোরও সমান হলে → যার ডাটা কম/বেশি সেটা প্রাধান্য পাবে
     */
    _decidePrediction(counts, scores) {
        // Find max count
        let maxCount = Math.max(counts.LOW, counts.MEDIUM, counts.HIGH);
        let groupsWithMaxCount = [];
        
        for (const group of this.groups) {
            if (counts[group] === maxCount && maxCount > 0) {
                groupsWithMaxCount.push(group);
            }
        }
        
        // If unique group with highest count - select it
        if (groupsWithMaxCount.length === 1) {
            return groupsWithMaxCount[0];
        }
        
        // If multiple groups have same count - use scores
        if (groupsWithMaxCount.length > 1) {
            let bestScore = -1;
            let bestGroup = groupsWithMaxCount[0];
            
            for (const group of groupsWithMaxCount) {
                if (scores[group] > bestScore) {
                    bestScore = scores[group];
                    bestGroup = group;
                }
            }
            
            // If scores are also equal, use data count difference
            let sameScoreGroups = [];
            for (const group of groupsWithMaxCount) {
                if (scores[group] === bestScore) {
                    sameScoreGroups.push(group);
                }
            }
            
            if (sameScoreGroups.length > 1) {
                // যার ডাটা কম/বেশি সেটা প্রাধান্য পাবে
                // For now, return the first one with highest count
                return sameScoreGroups[0];
            }
            
            return bestGroup;
        }
        
        // If no counts (all zero) - use scores only
        let bestScore = -1;
        let bestGroup = "MEDIUM";
        for (const group of this.groups) {
            if (scores[group] > bestScore) {
                bestScore = scores[group];
                bestGroup = group;
            }
        }
        
        return bestGroup;
    }
    
    /**
     * Update scores based on prediction result
     * Rule: সঠিক হলে +২৫, ভুল হলে -২৫ এবং রেজাল্ট গ্রুপ +২৫
     */
    _updateScores(patternKey, streakLength, predictedGroup, actualGroup) {
        const scores = this.scores[patternKey][streakLength];
        
        if (predictedGroup === actualGroup) {
            // Correct prediction: predicted group +25
            scores[predictedGroup] = Math.min(100, scores[predictedGroup] + 25);
        } else {
            // Wrong prediction: predicted group -25, actual group +25
            scores[predictedGroup] = Math.max(0, scores[predictedGroup] - 25);
            scores[actualGroup] = Math.min(100, scores[actualGroup] + 25);
        }
    }
    
    /**
     * Update fallback scores
     */
    _updateFallbackScores(predictedGroup, actualGroup) {
        if (predictedGroup === actualGroup) {
            this.fallbackScores[predictedGroup] = Math.min(100, this.fallbackScores[predictedGroup] + 25);
        } else {
            this.fallbackScores[predictedGroup] = Math.max(0, this.fallbackScores[predictedGroup] - 25);
            this.fallbackScores[actualGroup] = Math.min(100, this.fallbackScores[actualGroup] + 25);
        }
    }
    
    /**
     * Get fallback prediction using tracked data + scores
     */
    _getFallbackPrediction() {
        let bestGroup = "MEDIUM";
        let predictionMethod = "";
        
        if (this.fallbackTracking.active && this.fallbackTracking.totalTracked > 0) {
            const counts = this.fallbackTracking.trackedGroups;
            const maxCount = Math.max(counts.LOW, counts.MEDIUM, counts.HIGH);
            const groupsWithMaxCount = [];
            
            for (const group of this.groups) {
                if (counts[group] === maxCount && maxCount > 0) {
                    groupsWithMaxCount.push(group);
                }
            }
            
            if (groupsWithMaxCount.length === 1) {
                bestGroup = groupsWithMaxCount[0];
                predictionMethod = "data_count";
            } else {
                // Use scores to decide
                let bestScore = -1;
                for (const group of groupsWithMaxCount) {
                    if (this.fallbackScores[group] > bestScore) {
                        bestScore = this.fallbackScores[group];
                        bestGroup = group;
                    }
                }
                predictionMethod = "score_based";
            }
        } else {
            // Use only scores
            let bestScore = -1;
            for (const group of this.groups) {
                if (this.fallbackScores[group] > bestScore) {
                    bestScore = this.fallbackScores[group];
                    bestGroup = group;
                }
            }
            predictionMethod = "score_only";
        }
        
        // Calculate confidence based on data percentage
        let confidence = 50;
        if (this.fallbackTracking.totalTracked > 0) {
            const count = this.fallbackTracking.trackedGroups[bestGroup] || 0;
            confidence = Math.min(85, Math.max(40, Math.round((count / this.fallbackTracking.totalTracked) * 100)));
        } else {
            const maxScore = Math.max(this.fallbackScores.LOW, this.fallbackScores.MEDIUM, this.fallbackScores.HIGH);
            const totalScore = this.fallbackScores.LOW + this.fallbackScores.MEDIUM + this.fallbackScores.HIGH;
            confidence = Math.min(75, Math.max(40, Math.round((maxScore / totalScore) * 100)));
        }
        
        return {
            nextGroup: bestGroup,
            confidence: confidence,
            method: predictionMethod
        };
    }
    
    /**
     * Main prediction method
     */
    predict(currentGroup, previousGroup) {
        const immediatePattern = `${previousGroup}→${currentGroup}`;
        
        // Check if pattern matches
        if (this.patternsList.includes(immediatePattern)) {
            // Calculate streak length
            let streakLength = (this.currentPatternKey === immediatePattern) ? this.currentStreak : 1;
            streakLength = Math.min(18, Math.max(1, streakLength));
            
            // Get data counts for this pattern and length
            const counts = {
                LOW: this._getGroupCount(immediatePattern, streakLength, "LOW"),
                MEDIUM: this._getGroupCount(immediatePattern, streakLength, "MEDIUM"),
                HIGH: this._getGroupCount(immediatePattern, streakLength, "HIGH")
            };
            
            const scores = this.scores[immediatePattern][streakLength];
            
            // Decide prediction based on counts and scores
            let predictedGroup = this._decidePrediction(counts, scores);
            
            // If no data available (totalBreaks === 0), use scores only
            const totalBreaks = this.patterns[immediatePattern][streakLength].totalBreaks;
            if (totalBreaks === 0) {
                let bestScore = -1;
                for (const group of this.groups) {
                    if (scores[group] > bestScore) {
                        bestScore = scores[group];
                        predictedGroup = group;
                    }
                }
            }
            
            // Calculate confidence
            let confidence = 50;
            if (totalBreaks > 0) {
                const count = this._getGroupCount(immediatePattern, streakLength, predictedGroup);
                confidence = Math.min(90, Math.max(40, Math.round((count / totalBreaks) * 100)));
            } else {
                const maxScore = Math.max(scores.LOW, scores.MEDIUM, scores.HIGH);
                const totalScore = scores.LOW + scores.MEDIUM + scores.HIGH;
                confidence = Math.min(75, Math.max(40, Math.round((maxScore / totalScore) * 100)));
            }
            
            // Determine prediction type
            let predictionType = "";
            if (predictedGroup === currentGroup) {
                predictionType = "STICK";
            } else {
                predictionType = "SWITCH";
            }
            
            // Save for later update
            this.lastPredictionInfo = {
                patternKey: immediatePattern,
                streakLength: streakLength,
                predictedGroup: predictedGroup,
                usedFallback: false
            };
            
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
                hasSpecificData: totalBreaks > 0,
                scores: scores,
                counts: counts
            };
        }
        
        // No pattern match - use FALLBACK MODE
        const fallbackResult = this._getFallbackPrediction();
        
        this.lastPredictionInfo = {
            patternKey: "FALLBACK",
            streakLength: 0,
            predictedGroup: fallbackResult.nextGroup,
            usedFallback: true
        };
        
        return {
            model: this.name,
            prediction: "FALLBACK",
            pattern: immediatePattern,
            currentGroup: currentGroup,
            previousGroup: previousGroup,
            currentStreak: 0,
            nextGroup: fallbackResult.nextGroup,
            nextGroupConfidence: fallbackResult.confidence,
            confidence: fallbackResult.confidence,
            hasSpecificData: false,
            fallbackMethod: fallbackResult.method,
            fallbackScores: this.fallbackScores,
            fallbackTracked: this.fallbackTracking.trackedGroups,
            fallbackTotalTracked: this.fallbackTracking.totalTracked
        };
    }
    
    /**
     * Update AI with actual result
     */
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        const isPatternMatch = this.patternsList.includes(patternKey);
        
        // Update scores based on last prediction
        if (this.lastPredictionInfo) {
            const predicted = this.lastPredictionInfo.predictedGroup;
            
            if (this.lastPredictionInfo.usedFallback) {
                // Update fallback scores
                this._updateFallbackScores(predicted, resultGroup);
            } else {
                // Update pattern-specific scores
                this._updateScores(
                    this.lastPredictionInfo.patternKey,
                    this.lastPredictionInfo.streakLength,
                    predicted,
                    resultGroup
                );
            }
            
            // Update accuracy
            const correct = (predicted === resultGroup);
            this.recordPredictionResult(correct);
        }
        
        // Update fallback tracking
        if (isPatternMatch) {
            // Pattern matched - reset fallback tracking and save data
            if (this.fallbackTracking.active && this.fallbackTracking.totalTracked > 0) {
                // Save tracked data to the pattern that just appeared
                // This data will be used for training next time
                // For now, we just reset tracking
            }
            
            this.fallbackTracking = {
                active: false,
                lastPattern: patternKey,
                trackedGroups: { LOW: 0, MEDIUM: 0, HIGH: 0 },
                totalTracked: 0,
                maxTrackLimit: 15
            };
        } else {
            // Pattern didn't match - track in fallback mode
            if (!this.fallbackTracking.active && this.fallbackTracking.lastPattern) {
                this.fallbackTracking.active = true;
            }
            
            if (this.fallbackTracking.active) {
                // Add to tracked groups (max 15)
                if (this.fallbackTracking.totalTracked < this.fallbackTracking.maxTrackLimit) {
                    this.fallbackTracking.trackedGroups[resultGroup]++;
                    this.fallbackTracking.totalTracked++;
                }
            }
        }
        
        // Update streak tracking
        if (this.currentPatternKey === patternKey && isPatternMatch) {
            this.currentStreak++;
        } else {
            if (isPatternMatch) {
                this.currentPatternKey = patternKey;
                this.currentStreak = 1;
            } else {
                this.currentPatternKey = null;
                this.currentStreak = 0;
            }
        }
        
        // Record break for pattern learning
        if (isPatternMatch && this.currentStreak > 0) {
            // Record continuation or break
            const expectedNext = this.currentPatternKey.split("→")[1];
            if (resultGroup !== expectedNext && this.currentStreak >= 1 && this.currentStreak <= 18) {
                this._recordBreak(this.currentPatternKey, this.currentStreak, resultGroup);
            }
        }
        
        this.lastPredictionInfo = null;
    }
    
    /**
     * Record prediction result for accuracy
     */
    recordPredictionResult(correct) {
        this.totalPredictions++;
        if (correct) this.correctPredictions++;
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
    }
    
    /**
     * Get current accuracy
     */
    getAccuracy() {
        return this.accuracy || 0;
    }
    
    /**
     * Export for persistence
     */
    exportForServer() {
        return {
            patterns: this.patterns,
            scores: this.scores,
            fallbackScores: this.fallbackScores,
            fallbackTracking: this.fallbackTracking,
            currentPatternKey: this.currentPatternKey,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
    
    /**
     * Load from saved data
     */
    loadFromData(data) {
        if (data) {
            this.patterns = data.patterns || this.patterns;
            this.scores = data.scores || this.scores;
            this.fallbackScores = data.fallbackScores || this.fallbackScores;
            this.fallbackTracking = data.fallbackTracking || this.fallbackTracking;
            this.currentPatternKey = data.currentPatternKey || null;
            this.currentStreak = data.currentStreak || 0;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
        }
    }
}


// ============================================================
// AI-A: STICK DETECTOR
// Patterns: LOW→LOW, MEDIUM→MEDIUM, HIGH→HIGH
// ============================================================
class ServerAI_Stick extends BaseAI {
    constructor() {
        super("AI_Stick", ["LOW→LOW", "MEDIUM→MEDIUM", "HIGH→HIGH"]);
    }
}


// ============================================================
// AI-B: EXTREME SWITCH
// Patterns: HIGH→LOW, LOW→HIGH
// ============================================================
class ServerAI_ExtremeSwitch extends BaseAI {
    constructor() {
        super("AI_ExtremeSwitch", ["HIGH→LOW", "LOW→HIGH"]);
    }
}


// ============================================================
// AI-C: LOW-MID SWITCH
// Patterns: LOW→MEDIUM, MEDIUM→LOW
// ============================================================
class ServerAI_LowMidSwitch extends BaseAI {
    constructor() {
        super("AI_LowMidSwitch", ["LOW→MEDIUM", "MEDIUM→LOW"]);
    }
}


// ============================================================
// AI-D: MID-HIGH SWITCH
// Patterns: MEDIUM→HIGH, HIGH→MEDIUM
// ============================================================
class ServerAI_MidHighSwitch extends BaseAI {
    constructor() {
        super("AI_MidHighSwitch", ["MEDIUM→HIGH", "HIGH→MEDIUM"]);
    }
}


// ============================================================
// ENSEMBLE VOTER
// Combines all 4 AI predictions with dynamic weights
// ============================================================
class ServerEnsembleVoter {
    constructor() {
        this.name = "EnsembleVoter";
        this.version = "6.0";
        
        // Dynamic weights for each AI (initial equal)
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
    
    /**
     * Combine all 4 AI predictions using weighted voting
     */
    combine(predStick, predExtreme, predLowMid, predMidHigh) {
        this.lastPredictions = {
            stick: predStick,
            extreme: predExtreme,
            lowMid: predLowMid,
            midHigh: predMidHigh
        };
        
        // Calculate weighted scores
        const scores = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        const voteCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        
        if (predStick && predStick.nextGroup) {
            const weight = this.weights.stick;
            const confidence = predStick.confidence || 50;
            scores[predStick.nextGroup] += confidence * weight;
            voteCount[predStick.nextGroup]++;
        }
        
        if (predExtreme && predExtreme.nextGroup) {
            const weight = this.weights.extremeSwitch;
            const confidence = predExtreme.confidence || 50;
            scores[predExtreme.nextGroup] += confidence * weight;
            voteCount[predExtreme.nextGroup]++;
        }
        
        if (predLowMid && predLowMid.nextGroup) {
            const weight = this.weights.lowMidSwitch;
            const confidence = predLowMid.confidence || 50;
            scores[predLowMid.nextGroup] += confidence * weight;
            voteCount[predLowMid.nextGroup]++;
        }
        
        if (predMidHigh && predMidHigh.nextGroup) {
            const weight = this.weights.midHighSwitch;
            const confidence = predMidHigh.confidence || 50;
            scores[predMidHigh.nextGroup] += confidence * weight;
            voteCount[predMidHigh.nextGroup]++;
        }
        
        // Select group with highest weighted score
        let finalGroup = "MEDIUM";
        let finalScore = 0;
        for (const [group, score] of Object.entries(scores)) {
            if (score > finalScore) {
                finalScore = score;
                finalGroup = group;
            }
        }
        
        // Calculate agreement (how many AIs agree)
        const agreement = Math.max(...Object.values(voteCount));
        
        // Calculate final confidence
        const maxPossibleScore = 100 * (this.weights.stick + this.weights.extremeSwitch + 
                                        this.weights.lowMidSwitch + this.weights.midHighSwitch);
        const finalConfidence = Math.min(95, Math.max(30, Math.round((finalScore / maxPossibleScore) * 100)));
        
        return {
            final: {
                group: finalGroup,
                confidence: finalConfidence,
                scores: scores,
                voteCount: voteCount,
                agreement: agreement
            },
            weights: this.weights
        };
    }
    
    /**
     * Update weights based on prediction results
     * Increase weight of correct AIs, decrease weight of wrong AIs
     */
    updateWeightsWithResult(actualGroup) {
        if (!this.lastPredictions) return;
        
        const correct = {
            stick: this.lastPredictions.stick && this.lastPredictions.stick.nextGroup === actualGroup,
            extreme: this.lastPredictions.extreme && this.lastPredictions.extreme.nextGroup === actualGroup,
            lowMid: this.lastPredictions.lowMid && this.lastPredictions.lowMid.nextGroup === actualGroup,
            midHigh: this.lastPredictions.midHigh && this.lastPredictions.midHigh.nextGroup === actualGroup
        };
        
        const weightChange = 0.03;
        
        // Update each weight
        if (correct.stick) this.weights.stick += weightChange;
        else this.weights.stick -= weightChange;
        
        if (correct.extreme) this.weights.extremeSwitch += weightChange;
        else this.weights.extremeSwitch -= weightChange;
        
        if (correct.lowMid) this.weights.lowMidSwitch += weightChange;
        else this.weights.lowMidSwitch -= weightChange;
        
        if (correct.midHigh) this.weights.midHighSwitch += weightChange;
        else this.weights.midHighSwitch -= weightChange;
        
        // Clamp weights
        this.weights.stick = Math.min(this.maxWeight, Math.max(this.minWeight, this.weights.stick));
        this.weights.extremeSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, this.weights.extremeSwitch));
        this.weights.lowMidSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, this.weights.lowMidSwitch));
        this.weights.midHighSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, this.weights.midHighSwitch));
        
        // Normalize to sum = 1
        this._normalizeWeights();
        
        // Update accuracy
        const ensembleCorrect = (
            (correct.stick ? this.weights.stick : 0) +
            (correct.extreme ? this.weights.extremeSwitch : 0) +
            (correct.lowMid ? this.weights.lowMidSwitch : 0) +
            (correct.midHigh ? this.weights.midHighSwitch : 0)
        ) > 0.5;
        
        this.recordPredictionResult(ensembleCorrect);
        
        this.lastPredictions = null;
    }
    
    /**
     * Update weights from accuracy percentages
     */
    updateWeights(accStick, accExtreme, accLowMid, accMidHigh) {
        const safeAccStick = isNaN(accStick) ? 25 : accStick;
        const safeAccExtreme = isNaN(accExtreme) ? 25 : accExtreme;
        const safeAccLowMid = isNaN(accLowMid) ? 25 : accLowMid;
        const safeAccMidHigh = isNaN(accMidHigh) ? 25 : accMidHigh;
        
        const total = safeAccStick + safeAccExtreme + safeAccLowMid + safeAccMidHigh;
        
        if (total > 0) {
            this.weights.stick = Math.min(this.maxWeight, Math.max(this.minWeight, safeAccStick / total));
            this.weights.extremeSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, safeAccExtreme / total));
            this.weights.lowMidSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, safeAccLowMid / total));
            this.weights.midHighSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, safeAccMidHigh / total));
            this._normalizeWeights();
        }
    }
    
    _normalizeWeights() {
        const total = this.weights.stick + this.weights.extremeSwitch + 
                      this.weights.lowMidSwitch + this.weights.midHighSwitch;
        
        if (total > 0) {
            this.weights.stick /= total;
            this.weights.extremeSwitch /= total;
            this.weights.lowMidSwitch /= total;
            this.weights.midHighSwitch /= total;
        }
    }
    
    recordPredictionResult(correct) {
        this.totalPredictions++;
        if (correct) this.correctPredictions++;
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
    }
    
    getAccuracy() {
        return this.accuracy || 0;
    }
    
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


// ============================================================
// EXPORT ALL CLASSES
// ============================================================
module.exports = {
    ServerAI_Stick,
    ServerAI_ExtremeSwitch,
    ServerAI_LowMidSwitch,
    ServerAI_MidHighSwitch,
    ServerEnsembleVoter
};
