// ============================================================
// server-ai-logic.js (COMPLETE FINAL VERSION)
// Four AI Pattern Recognition System - Server Side
// Features:
// - Length-wise tracking (1-18)
// - Fallback Mode with last pattern tracking
// - Score System (0-100, +20/-20 with clamping)
// - Dynamic weight adjustment
// ============================================================

/**
 * AI-A: Stick Pattern Detector (Server Version)
 * Tracks: LOW→LOW, MEDIUM→MEDIUM, HIGH→HIGH
 */
class ServerAI_Stick {
    constructor() {
        this.name = "AI_Stick";
        this.groups = ['LOW', 'MEDIUM', 'HIGH'];
        
        // Patterns for Stick detector (same group repeating)
        this.patterns = {
            "LOW→LOW": {},
            "MEDIUM→MEDIUM": {},
            "HIGH→HIGH": {}
        };
        
        // Pattern-specific scores (0-100) for each length
        this.patternScores = {
            "LOW→LOW": {},
            "MEDIUM→MEDIUM": {},
            "HIGH→HIGH": {}
        };
        
        // Fallback scores for when pattern doesn't match
        this.fallbackScores = {
            "LOW": 40,
            "MEDIUM": 40,
            "HIGH": 40
        };
        
        // Global fallback stats (tracks after last pattern)
        this.globalFallbackStats = {
            totalBreaks: 0,
            nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        // Last pattern tracking for Fallback Mode
        this.lastPatternKey = null;
        this.fallbackTracking = {
            active: false,
            lastPattern: null,
            trackedGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        // Initialize length-wise storage (1 to 18)
        for (let len = 1; len <= 18; len++) {
            for (let pattern in this.patterns) {
                this.patterns[pattern][len] = {
                    totalBreaks: 0,
                    nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
                };
                this.patternScores[pattern][len] = {
                    "LOW": 40,
                    "MEDIUM": 40,
                    "HIGH": 40
                };
            }
        }
        
        this.currentPatternKey = null;
        this.currentStreak = 0;
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        this.lastPredictionInfo = null;
    }
    
    init() {
        console.log('🤖 Server AI-A (Stick) initialized');
    }
    
    train(history) {
        if (!history || history.length < 3) return false;
        
        // Reset data structures
        for (let len = 1; len <= 18; len++) {
            for (let pattern in this.patterns) {
                this.patterns[pattern][len] = {
                    totalBreaks: 0,
                    nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
                };
            }
        }
        
        this.globalFallbackStats = {
            totalBreaks: 0,
            nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        let tempPattern = null;
        let tempStreak = 0;
        
        for (let i = 2; i < history.length; i++) {
            const prevPrev = history[i-2].group;
            const prev = history[i-1].group;
            const curr = history[i].group;
            
            const patternKey = `${prevPrev}→${prev}`;
            const isStickPattern = (patternKey === "LOW→LOW" || patternKey === "MEDIUM→MEDIUM" || patternKey === "HIGH→HIGH");
            
            if (isStickPattern && prevPrev === prev) {
                if (tempPattern === patternKey && prev === patternKey.split("→")[0]) {
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
        this.globalFallbackStats.totalBreaks++;
        this.globalFallbackStats.nextGroups[nextGroup]++;
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
    
    getMostCommonGroupFromGlobal() {
        let bestGroup = "MEDIUM";
        let bestCount = 0;
        
        for (let group of this.groups) {
            const count = this.globalFallbackStats.nextGroups[group] || 0;
            if (count > bestCount) {
                bestCount = count;
                bestGroup = group;
            }
        }
        return bestGroup;
    }
    
    decidePredictionWithScores(mostCommonGroup, scores) {
        for (let group of this.groups) {
            if (group !== mostCommonGroup) {
                const scoreDiff = scores[group] - scores[mostCommonGroup];
                if (scoreDiff >= 20) {
                    return group;
                }
            }
        }
        return mostCommonGroup;
    }
    
    updateScores(patternKey, streakLength, predictedGroup, actualGroup) {
        const scores = this.patternScores[patternKey][streakLength];
        
        if (predictedGroup !== actualGroup) {
            scores[predictedGroup] = Math.max(0, scores[predictedGroup] - 20);
        }
        scores[actualGroup] = Math.min(100, scores[actualGroup] + 20);
    }
    
    // Fallback Mode: Get prediction based on tracked data after last pattern
    getFallbackPredictionWithScores() {
        let bestGroup = "MEDIUM";
        let bestCount = 0;
        
        // Check if we have tracked data in fallback mode
        if (this.fallbackTracking.active && this.fallbackTracking.trackedGroups) {
            for (let group of this.groups) {
                const count = this.fallbackTracking.trackedGroups[group] || 0;
                if (count > bestCount) {
                    bestCount = count;
                    bestGroup = group;
                }
            }
            
            if (bestCount > 0) {
                // Use score system to decide
                const predictedGroup = this.decidePredictionWithScores(bestGroup, this.fallbackScores);
                const confidence = Math.min(70, Math.max(35, Math.round((bestCount / (bestCount + 1)) * 100)));
                
                return {
                    nextGroup: predictedGroup,
                    confidence: confidence,
                    hasSpecificData: true,
                    reason: `Fallback Mode: After pattern ${this.fallbackTracking.lastPattern}, most common is ${bestGroup}, score-adjusted to ${predictedGroup}`
                };
            }
        }
        
        // Default fallback using global stats
        const mostCommonGroup = this.getMostCommonGroupFromGlobal();
        const predictedGroup = this.decidePredictionWithScores(mostCommonGroup, this.fallbackScores);
        
        const count = this.globalFallbackStats.nextGroups[predictedGroup] || 0;
        const total = this.globalFallbackStats.totalBreaks || 1;
        const confidence = Math.min(70, Math.max(35, Math.round((count / total) * 100)));
        
        return {
            nextGroup: predictedGroup,
            confidence: confidence,
            hasSpecificData: false,
            reason: `Fallback: Most common ${mostCommonGroup}, score-adjusted to ${predictedGroup}`
        };
    }
    
    updateFallbackScores(predictedGroup, actualGroup) {
        // Update predicted group (wrong) - minus 20, min 0
        if (predictedGroup !== actualGroup) {
            this.fallbackScores[predictedGroup] = Math.max(0, this.fallbackScores[predictedGroup] - 20);
            console.log(`❌ FALLBACK SCORE: ${predictedGroup} -20 → ${this.fallbackScores[predictedGroup]}`);
        }
        
        // Update actual group (correct) - plus 20, max 100
        this.fallbackScores[actualGroup] = Math.min(100, this.fallbackScores[actualGroup] + 20);
        console.log(`✅ FALLBACK SCORE: ${actualGroup} +20 → ${this.fallbackScores[actualGroup]}`);
        console.log(`📊 Current Fallback Scores: LOW=${this.fallbackScores.LOW}, MEDIUM=${this.fallbackScores.MEDIUM}, HIGH=${this.fallbackScores.HIGH}`);
    }
    
    getHighestScoreGroup(scores) {
        let bestGroup = "MEDIUM";
        let bestScore = -1;
        
        for (let group of this.groups) {
            if (scores[group] > bestScore) {
                bestScore = scores[group];
                bestGroup = group;
            }
        }
        return bestGroup;
    }
    
    predict(currentGroup, previousGroup) {
        const immediatePattern = `${previousGroup}→${currentGroup}`;
        
        // Check if pattern matches any Stick pattern
        if (immediatePattern === "LOW→LOW" || immediatePattern === "MEDIUM→MEDIUM" || immediatePattern === "HIGH→HIGH") {
            let streakLength = (this.currentPatternKey === immediatePattern) ? this.currentStreak : 1;
            streakLength = Math.min(18, Math.max(1, streakLength));
            
            let mostCommonGroup = this.getMostlyGroupForPattern(immediatePattern, streakLength);
            const scores = this.patternScores[immediatePattern][streakLength];
            
            let predictedGroup = null;
            let confidence = 0;
            let hasSpecificData = false;
            
            if (mostCommonGroup) {
                hasSpecificData = true;
                predictedGroup = this.decidePredictionWithScores(mostCommonGroup, scores);
                const data = this.patterns[immediatePattern][streakLength];
                const count = data.nextGroups[predictedGroup] || 0;
                confidence = data.totalBreaks > 0 ? Math.round((count / data.totalBreaks) * 100) : 40;
            } else {
                predictedGroup = this.getHighestScoreGroup(scores);
                confidence = 40;
                hasSpecificData = false;
            }
            
            const predictionType = (predictedGroup === currentGroup) ? "STICK" : "SWITCH";
            
            this.lastPredictionInfo = {
                patternKey: immediatePattern,
                streakLength: streakLength,
                predictedGroup: predictedGroup,
                usedScores: true,
                isFallback: false
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
                breakProbability: 100 - confidence,
                hasSpecificData: hasSpecificData,
                reason: `After ${streakLength}x stick of ${currentGroup}, predicting ${predictedGroup}`,
                accuracy: this.accuracy,
                scores: scores
            };
        }
        
        // Pattern doesn't match - use Fallback Mode
        const fallbackResult = this.getFallbackPredictionWithScores();
        
        this.lastPredictionInfo = {
            patternKey: "FALLBACK",
            streakLength: 0,
            predictedGroup: fallbackResult.nextGroup,
            usedScores: true,
            isFallback: true
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
            breakProbability: 100 - fallbackResult.confidence,
            hasSpecificData: false,
            reason: fallbackResult.reason,
            accuracy: this.accuracy,
            fallbackScores: this.fallbackScores
        };
    }
    
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        // Update fallback scores for EVERY prediction
        if (this.lastPredictionInfo && this.lastPredictionInfo.predictedGroup) {
            const predicted = this.lastPredictionInfo.predictedGroup;
            this.updateFallbackScores(predicted, resultGroup);
            
            // Update pattern-specific scores if applicable
            if (this.lastPredictionInfo.usedScores && !this.lastPredictionInfo.isFallback) {
                this.updateScores(
                    this.lastPredictionInfo.patternKey,
                    this.lastPredictionInfo.streakLength,
                    predicted,
                    resultGroup
                );
            }
        }
        
        // Track for Fallback Mode
        const isStickPattern = (patternKey === "LOW→LOW" || patternKey === "MEDIUM→MEDIUM" || patternKey === "HIGH→HIGH");
        
        if (isStickPattern) {
            // Pattern matched - start new fallback tracking
            this.fallbackTracking = {
                active: false,
                lastPattern: patternKey,
                trackedGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        } else {
            // Pattern didn't match - track in fallback mode
            if (!this.fallbackTracking.active && this.fallbackTracking.lastPattern) {
                this.fallbackTracking.active = true;
            }
            if (this.fallbackTracking.active) {
                this.fallbackTracking.trackedGroups[resultGroup]++;
            }
        }
        
        // Update pattern streak tracking
        if (this.currentPatternKey === patternKey && isStickPattern) {
            this.currentStreak++;
        } else {
            if (isStickPattern) {
                this.currentPatternKey = patternKey;
                this.currentStreak = 1;
            } else {
                this.currentPatternKey = null;
                this.currentStreak = 0;
            }
        }
        
        this.lastPredictionInfo = null;
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
            this.patternScores = data.patternScores || this.patternScores;
            this.fallbackScores = data.fallbackScores || this.fallbackScores;
            this.globalFallbackStats = data.globalFallbackStats || this.globalFallbackStats;
            this.fallbackTracking = data.fallbackTracking || { active: false, lastPattern: null, trackedGroups: { LOW:0, MEDIUM:0, HIGH:0 } };
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
            patternScores: this.patternScores,
            fallbackScores: this.fallbackScores,
            globalFallbackStats: this.globalFallbackStats,
            fallbackTracking: this.fallbackTracking,
            currentPatternKey: this.currentPatternKey,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * AI-B: Extreme Switch Detector
 * Tracks alternating patterns: HIGH↔LOW
 */
class ServerAI_ExtremeSwitch {
    constructor() {
        this.name = "AI_ExtremeSwitch";
        this.groups = ['LOW', 'MEDIUM', 'HIGH'];
        
        this.patterns = {
            "HIGH→LOW": {},
            "LOW→HIGH": {}
        };
        
        this.patternScores = {
            "HIGH→LOW": {},
            "LOW→HIGH": {}
        };
        
        this.fallbackScores = {
            "LOW": 40,
            "MEDIUM": 40,
            "HIGH": 40
        };
        
        this.globalFallbackStats = {
            totalBreaks: 0,
            nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        this.fallbackTracking = {
            active: false,
            lastPattern: null,
            trackedGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        for (let len = 1; len <= 18; len++) {
            this.patterns["HIGH→LOW"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.patterns["LOW→HIGH"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            
            this.patternScores["HIGH→LOW"][len] = {
                "LOW": 40,
                "MEDIUM": 40,
                "HIGH": 40
            };
            this.patternScores["LOW→HIGH"][len] = {
                "LOW": 40,
                "MEDIUM": 40,
                "HIGH": 40
            };
        }
        
        this.currentPatternKey = null;
        this.currentStreak = 0;
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        this.lastPredictionInfo = null;
    }
    
    init() {
        console.log('🤖 AI-B (Extreme Switch) initialized with Dynamic Score System');
    }
    
    train(history) {
        if (!history || history.length < 3) return false;
        
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
        
        this.globalFallbackStats = {
            totalBreaks: 0,
            nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        let tempPattern = null;
        let tempStreak = 0;
        
        for (let i = 2; i < history.length; i++) {
            const prevPrev = history[i-2].group;
            const prev = history[i-1].group;
            const curr = history[i].group;
            
            const isExtreme1 = (prevPrev === 'HIGH' && prev === 'LOW') || (prevPrev === 'LOW' && prev === 'HIGH');
            
            if (isExtreme1) {
                const patternKey = `${prevPrev}→${prev}`;
                const expectedCurr = (patternKey === "HIGH→LOW") ? 'HIGH' : 'LOW';
                
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
        this.globalFallbackStats.totalBreaks++;
        this.globalFallbackStats.nextGroups[nextGroup]++;
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
    
    getMostCommonGroupFromGlobal() {
        let bestGroup = "MEDIUM";
        let bestCount = 0;
        
        for (let group of this.groups) {
            const count = this.globalFallbackStats.nextGroups[group] || 0;
            if (count > bestCount) {
                bestCount = count;
                bestGroup = group;
            }
        }
        return bestGroup;
    }
    
    decidePredictionWithScores(mostCommonGroup, scores) {
        for (let group of this.groups) {
            if (group !== mostCommonGroup) {
                const scoreDiff = scores[group] - scores[mostCommonGroup];
                if (scoreDiff >= 20) {
                    return group;
                }
            }
        }
        return mostCommonGroup;
    }
    
    updateScores(patternKey, streakLength, predictedGroup, actualGroup) {
        const scores = this.patternScores[patternKey][streakLength];
        
        if (predictedGroup !== actualGroup) {
            scores[predictedGroup] = Math.max(0, scores[predictedGroup] - 20);
        }
        scores[actualGroup] = Math.min(100, scores[actualGroup] + 20);
    }
    
    getFallbackPredictionWithScores() {
        let bestGroup = "MEDIUM";
        let bestCount = 0;
        
        if (this.fallbackTracking.active && this.fallbackTracking.trackedGroups) {
            for (let group of this.groups) {
                const count = this.fallbackTracking.trackedGroups[group] || 0;
                if (count > bestCount) {
                    bestCount = count;
                    bestGroup = group;
                }
            }
            
            if (bestCount > 0) {
                const predictedGroup = this.decidePredictionWithScores(bestGroup, this.fallbackScores);
                const confidence = Math.min(70, Math.max(35, Math.round((bestCount / (bestCount + 1)) * 100)));
                
                return {
                    nextGroup: predictedGroup,
                    confidence: confidence,
                    hasSpecificData: true,
                    reason: `Fallback Mode: After pattern ${this.fallbackTracking.lastPattern}, most common is ${bestGroup}, score-adjusted to ${predictedGroup}`
                };
            }
        }
        
        const mostCommonGroup = this.getMostCommonGroupFromGlobal();
        const predictedGroup = this.decidePredictionWithScores(mostCommonGroup, this.fallbackScores);
        
        const count = this.globalFallbackStats.nextGroups[predictedGroup] || 0;
        const total = this.globalFallbackStats.totalBreaks || 1;
        const confidence = Math.min(70, Math.max(35, Math.round((count / total) * 100)));
        
        return {
            nextGroup: predictedGroup,
            confidence: confidence,
            hasSpecificData: false,
            reason: `Fallback: Most common ${mostCommonGroup}, score-adjusted to ${predictedGroup}`
        };
    }
    
    updateFallbackScores(predictedGroup, actualGroup) {
        if (predictedGroup !== actualGroup) {
            this.fallbackScores[predictedGroup] = Math.max(0, this.fallbackScores[predictedGroup] - 20);
            console.log(`❌ FALLBACK SCORE: ${predictedGroup} -20 → ${this.fallbackScores[predictedGroup]}`);
        }
        this.fallbackScores[actualGroup] = Math.min(100, this.fallbackScores[actualGroup] + 20);
        console.log(`✅ FALLBACK SCORE: ${actualGroup} +20 → ${this.fallbackScores[actualGroup]}`);
        console.log(`📊 Current Fallback Scores: LOW=${this.fallbackScores.LOW}, MEDIUM=${this.fallbackScores.MEDIUM}, HIGH=${this.fallbackScores.HIGH}`);
    }
    
    getHighestScoreGroup(scores) {
        let bestGroup = "MEDIUM";
        let bestScore = -1;
        
        for (let group of this.groups) {
            if (scores[group] > bestScore) {
                bestScore = scores[group];
                bestGroup = group;
            }
        }
        return bestGroup;
    }
    
    predict(currentGroup, previousGroup) {
        const immediatePattern = `${previousGroup}→${currentGroup}`;
        
        if (immediatePattern === "HIGH→LOW" || immediatePattern === "LOW→HIGH") {
            let streakLength = (this.currentPatternKey === immediatePattern) ? this.currentStreak : 1;
            streakLength = Math.min(18, Math.max(1, streakLength));
            
            let mostCommonGroup = this.getMostlyGroupForPattern(immediatePattern, streakLength);
            const scores = this.patternScores[immediatePattern][streakLength];
            
            let predictedGroup = null;
            let confidence = 0;
            let hasSpecificData = false;
            
            if (mostCommonGroup) {
                hasSpecificData = true;
                predictedGroup = this.decidePredictionWithScores(mostCommonGroup, scores);
                const data = this.patterns[immediatePattern][streakLength];
                const count = data.nextGroups[predictedGroup] || 0;
                confidence = data.totalBreaks > 0 ? Math.round((count / data.totalBreaks) * 100) : 40;
            } else {
                predictedGroup = this.getHighestScoreGroup(scores);
                confidence = 40;
                hasSpecificData = false;
            }
            
            const predictionType = (predictedGroup === currentGroup) ? "CONTINUE" : "BREAK";
            
            this.lastPredictionInfo = {
                patternKey: immediatePattern,
                streakLength: streakLength,
                predictedGroup: predictedGroup,
                usedScores: true,
                isFallback: false
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
                breakProbability: 100 - confidence,
                hasSpecificData: hasSpecificData,
                reason: `After ${streakLength}x alternating ${immediatePattern}, predicting ${predictedGroup}`,
                accuracy: this.accuracy,
                scores: scores
            };
        }
        
        const fallbackResult = this.getFallbackPredictionWithScores();
        
        this.lastPredictionInfo = {
            patternKey: "FALLBACK",
            streakLength: 0,
            predictedGroup: fallbackResult.nextGroup,
            usedScores: true,
            isFallback: true
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
            breakProbability: 100 - fallbackResult.confidence,
            hasSpecificData: false,
            reason: fallbackResult.reason,
            accuracy: this.accuracy,
            fallbackScores: this.fallbackScores
        };
    }
    
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        if (this.lastPredictionInfo && this.lastPredictionInfo.predictedGroup) {
            const predicted = this.lastPredictionInfo.predictedGroup;
            this.updateFallbackScores(predicted, resultGroup);
            
            if (this.lastPredictionInfo.usedScores && !this.lastPredictionInfo.isFallback) {
                this.updateScores(
                    this.lastPredictionInfo.patternKey,
                    this.lastPredictionInfo.streakLength,
                    predicted,
                    resultGroup
                );
            }
        }
        
        const isExtremePattern = (patternKey === "HIGH→LOW" || patternKey === "LOW→HIGH");
        
        if (isExtremePattern) {
            this.fallbackTracking = {
                active: false,
                lastPattern: patternKey,
                trackedGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        } else {
            if (!this.fallbackTracking.active && this.fallbackTracking.lastPattern) {
                this.fallbackTracking.active = true;
            }
            if (this.fallbackTracking.active) {
                this.fallbackTracking.trackedGroups[resultGroup]++;
            }
        }
        
        if (this.currentPatternKey === "HIGH→LOW") {
            const expectedNext = (this.currentStreak % 2 === 1) ? 'HIGH' : 'LOW';
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
            if (patternKey === "HIGH→LOW" || patternKey === "LOW→HIGH") {
                this.currentPatternKey = patternKey;
                this.currentStreak = 1;
            } else {
                this.globalFallbackStats.totalBreaks++;
                this.globalFallbackStats.nextGroups[resultGroup]++;
            }
        }
        
        this.lastPredictionInfo = null;
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
            this.patternScores = data.patternScores || this.patternScores;
            this.fallbackScores = data.fallbackScores || this.fallbackScores;
            this.globalFallbackStats = data.globalFallbackStats || this.globalFallbackStats;
            this.fallbackTracking = data.fallbackTracking || { active: false, lastPattern: null, trackedGroups: { LOW:0, MEDIUM:0, HIGH:0 } };
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
            patternScores: this.patternScores,
            fallbackScores: this.fallbackScores,
            globalFallbackStats: this.globalFallbackStats,
            fallbackTracking: this.fallbackTracking,
            currentPatternKey: this.currentPatternKey,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * AI-C: Low-Mid Switch Detector
 * Tracks alternating patterns: LOW↔MEDIUM
 */
class ServerAI_LowMidSwitch {
    constructor() {
        this.name = "AI_LowMidSwitch";
        this.groups = ['LOW', 'MEDIUM', 'HIGH'];
        
        this.patterns = {
            "LOW→MEDIUM": {},
            "MEDIUM→LOW": {}
        };
        
        this.patternScores = {
            "LOW→MEDIUM": {},
            "MEDIUM→LOW": {}
        };
        
        this.fallbackScores = {
            "LOW": 40,
            "MEDIUM": 40,
            "HIGH": 40
        };
        
        this.globalFallbackStats = {
            totalBreaks: 0,
            nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        this.fallbackTracking = {
            active: false,
            lastPattern: null,
            trackedGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        for (let len = 1; len <= 18; len++) {
            this.patterns["LOW→MEDIUM"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.patterns["MEDIUM→LOW"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            
            this.patternScores["LOW→MEDIUM"][len] = {
                "LOW": 40,
                "MEDIUM": 40,
                "HIGH": 40
            };
            this.patternScores["MEDIUM→LOW"][len] = {
                "LOW": 40,
                "MEDIUM": 40,
                "HIGH": 40
            };
        }
        
        this.currentPatternKey = null;
        this.currentStreak = 0;
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        this.lastPredictionInfo = null;
    }
    
    init() {
        console.log('🤖 AI-C (Low-Mid Switch) initialized with Dynamic Score System');
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
        
        this.globalFallbackStats = {
            totalBreaks: 0,
            nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
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
        this.globalFallbackStats.totalBreaks++;
        this.globalFallbackStats.nextGroups[nextGroup]++;
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
    
    getMostCommonGroupFromGlobal() {
        let bestGroup = "HIGH";
        let bestCount = 0;
        
        for (let group of this.groups) {
            const count = this.globalFallbackStats.nextGroups[group] || 0;
            if (count > bestCount) {
                bestCount = count;
                bestGroup = group;
            }
        }
        return bestGroup;
    }
    
    decidePredictionWithScores(mostCommonGroup, scores) {
        for (let group of this.groups) {
            if (group !== mostCommonGroup) {
                const scoreDiff = scores[group] - scores[mostCommonGroup];
                if (scoreDiff >= 20) {
                    return group;
                }
            }
        }
        return mostCommonGroup;
    }
    
    updateScores(patternKey, streakLength, predictedGroup, actualGroup) {
        const scores = this.patternScores[patternKey][streakLength];
        
        if (predictedGroup !== actualGroup) {
            scores[predictedGroup] = Math.max(0, scores[predictedGroup] - 20);
        }
        scores[actualGroup] = Math.min(100, scores[actualGroup] + 20);
    }
    
    getFallbackPredictionWithScores() {
        let bestGroup = "HIGH";
        let bestCount = 0;
        
        if (this.fallbackTracking.active && this.fallbackTracking.trackedGroups) {
            for (let group of this.groups) {
                const count = this.fallbackTracking.trackedGroups[group] || 0;
                if (count > bestCount) {
                    bestCount = count;
                    bestGroup = group;
                }
            }
            
            if (bestCount > 0) {
                const predictedGroup = this.decidePredictionWithScores(bestGroup, this.fallbackScores);
                const confidence = Math.min(70, Math.max(35, Math.round((bestCount / (bestCount + 1)) * 100)));
                
                return {
                    nextGroup: predictedGroup,
                    confidence: confidence,
                    hasSpecificData: true,
                    reason: `Fallback Mode: After pattern ${this.fallbackTracking.lastPattern}, most common is ${bestGroup}, score-adjusted to ${predictedGroup}`
                };
            }
        }
        
        const mostCommonGroup = this.getMostCommonGroupFromGlobal();
        const predictedGroup = this.decidePredictionWithScores(mostCommonGroup, this.fallbackScores);
        
        const count = this.globalFallbackStats.nextGroups[predictedGroup] || 0;
        const total = this.globalFallbackStats.totalBreaks || 1;
        const confidence = Math.min(70, Math.max(35, Math.round((count / total) * 100)));
        
        return {
            nextGroup: predictedGroup,
            confidence: confidence,
            hasSpecificData: false,
            reason: `Fallback: Most common ${mostCommonGroup}, score-adjusted to ${predictedGroup}`
        };
    }
    
    updateFallbackScores(predictedGroup, actualGroup) {
        if (predictedGroup !== actualGroup) {
            this.fallbackScores[predictedGroup] = Math.max(0, this.fallbackScores[predictedGroup] - 20);
        }
        this.fallbackScores[actualGroup] = Math.min(100, this.fallbackScores[actualGroup] + 20);
    }
    
    getHighestScoreGroup(scores) {
        let bestGroup = "HIGH";
        let bestScore = -1;
        
        for (let group of this.groups) {
            if (scores[group] > bestScore) {
                bestScore = scores[group];
                bestGroup = group;
            }
        }
        return bestGroup;
    }
    
    predict(currentGroup, previousGroup) {
        const immediatePattern = `${previousGroup}→${currentGroup}`;
        
        if (immediatePattern === "LOW→MEDIUM" || immediatePattern === "MEDIUM→LOW") {
            let streakLength = (this.currentPatternKey === immediatePattern) ? this.currentStreak : 1;
            streakLength = Math.min(18, Math.max(1, streakLength));
            
            let mostCommonGroup = this.getMostlyGroupForPattern(immediatePattern, streakLength);
            const scores = this.patternScores[immediatePattern][streakLength];
            
            let predictedGroup = null;
            let confidence = 0;
            let hasSpecificData = false;
            
            if (mostCommonGroup) {
                hasSpecificData = true;
                predictedGroup = this.decidePredictionWithScores(mostCommonGroup, scores);
                const data = this.patterns[immediatePattern][streakLength];
                const count = data.nextGroups[predictedGroup] || 0;
                confidence = data.totalBreaks > 0 ? Math.round((count / data.totalBreaks) * 100) : 40;
            } else {
                predictedGroup = this.getHighestScoreGroup(scores);
                confidence = 40;
                hasSpecificData = false;
            }
            
            const predictionType = (predictedGroup === currentGroup) ? "CONTINUE" : "BREAK";
            
            this.lastPredictionInfo = {
                patternKey: immediatePattern,
                streakLength: streakLength,
                predictedGroup: predictedGroup,
                usedScores: true,
                isFallback: false
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
                breakProbability: 100 - confidence,
                hasSpecificData: hasSpecificData,
                reason: `After ${streakLength}x alternating ${immediatePattern}, predicting ${predictedGroup}`,
                accuracy: this.accuracy,
                scores: scores
            };
        }
        
        const fallbackResult = this.getFallbackPredictionWithScores();
        
        this.lastPredictionInfo = {
            patternKey: "FALLBACK",
            streakLength: 0,
            predictedGroup: fallbackResult.nextGroup,
            usedScores: true,
            isFallback: true
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
            breakProbability: 100 - fallbackResult.confidence,
            hasSpecificData: false,
            reason: fallbackResult.reason,
            accuracy: this.accuracy,
            fallbackScores: this.fallbackScores
        };
    }
    
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        if (this.lastPredictionInfo && this.lastPredictionInfo.predictedGroup) {
            const predicted = this.lastPredictionInfo.predictedGroup;
            this.updateFallbackScores(predicted, resultGroup);
            
            if (this.lastPredictionInfo.usedScores && !this.lastPredictionInfo.isFallback) {
                this.updateScores(
                    this.lastPredictionInfo.patternKey,
                    this.lastPredictionInfo.streakLength,
                    predicted,
                    resultGroup
                );
            }
        }
        
        const isLowMidPattern = (patternKey === "LOW→MEDIUM" || patternKey === "MEDIUM→LOW");
        
        if (isLowMidPattern) {
            this.fallbackTracking = {
                active: false,
                lastPattern: patternKey,
                trackedGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        } else {
            if (!this.fallbackTracking.active && this.fallbackTracking.lastPattern) {
                this.fallbackTracking.active = true;
            }
            if (this.fallbackTracking.active) {
                this.fallbackTracking.trackedGroups[resultGroup]++;
            }
        }
        
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
            } else {
                this.globalFallbackStats.totalBreaks++;
                this.globalFallbackStats.nextGroups[resultGroup]++;
            }
        }
        
        this.lastPredictionInfo = null;
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
            this.patternScores = data.patternScores || this.patternScores;
            this.fallbackScores = data.fallbackScores || this.fallbackScores;
            this.globalFallbackStats = data.globalFallbackStats || this.globalFallbackStats;
            this.fallbackTracking = data.fallbackTracking || { active: false, lastPattern: null, trackedGroups: { LOW:0, MEDIUM:0, HIGH:0 } };
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
            patternScores: this.patternScores,
            fallbackScores: this.fallbackScores,
            globalFallbackStats: this.globalFallbackStats,
            fallbackTracking: this.fallbackTracking,
            currentPatternKey: this.currentPatternKey,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * AI-D: Mid-High Switch Detector
 * Tracks alternating patterns: MEDIUM↔HIGH
 */
class ServerAI_MidHighSwitch {
    constructor() {
        this.name = "AI_MidHighSwitch";
        this.groups = ['LOW', 'MEDIUM', 'HIGH'];
        
        this.patterns = {
            "MEDIUM→HIGH": {},
            "HIGH→MEDIUM": {}
        };
        
        this.patternScores = {
            "MEDIUM→HIGH": {},
            "HIGH→MEDIUM": {}
        };
        
        this.fallbackScores = {
            "LOW": 40,
            "MEDIUM": 40,
            "HIGH": 40
        };
        
        this.globalFallbackStats = {
            totalBreaks: 0,
            nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        this.fallbackTracking = {
            active: false,
            lastPattern: null,
            trackedGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
        for (let len = 1; len <= 18; len++) {
            this.patterns["MEDIUM→HIGH"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            this.patterns["HIGH→MEDIUM"][len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
            
            this.patternScores["MEDIUM→HIGH"][len] = {
                "LOW": 40,
                "MEDIUM": 40,
                "HIGH": 40
            };
            this.patternScores["HIGH→MEDIUM"][len] = {
                "LOW": 40,
                "MEDIUM": 40,
                "HIGH": 40
            };
        }
        
        this.currentPatternKey = null;
        this.currentStreak = 0;
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        this.lastPredictionInfo = null;
    }
    
    init() {
        console.log('🤖 AI-D (Mid-High Switch) initialized with Dynamic Score System');
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
        
        this.globalFallbackStats = {
            totalBreaks: 0,
            nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
        };
        
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
        this.globalFallbackStats.totalBreaks++;
        this.globalFallbackStats.nextGroups[nextGroup]++;
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
    
    getMostCommonGroupFromGlobal() {
        let bestGroup = "LOW";
        let bestCount = 0;
        
        for (let group of this.groups) {
            const count = this.globalFallbackStats.nextGroups[group] || 0;
            if (count > bestCount) {
                bestCount = count;
                bestGroup = group;
            }
        }
        return bestGroup;
    }
    
    decidePredictionWithScores(mostCommonGroup, scores) {
        for (let group of this.groups) {
            if (group !== mostCommonGroup) {
                const scoreDiff = scores[group] - scores[mostCommonGroup];
                if (scoreDiff >= 20) {
                    return group;
                }
            }
        }
        return mostCommonGroup;
    }
    
    updateScores(patternKey, streakLength, predictedGroup, actualGroup) {
        const scores = this.patternScores[patternKey][streakLength];
        
        if (predictedGroup !== actualGroup) {
            scores[predictedGroup] = Math.max(0, scores[predictedGroup] - 20);
        }
        scores[actualGroup] = Math.min(100, scores[actualGroup] + 20);
    }
    
    getFallbackPredictionWithScores() {
        let bestGroup = "LOW";
        let bestCount = 0;
        
        if (this.fallbackTracking.active && this.fallbackTracking.trackedGroups) {
            for (let group of this.groups) {
                const count = this.fallbackTracking.trackedGroups[group] || 0;
                if (count > bestCount) {
                    bestCount = count;
                    bestGroup = group;
                }
            }
            
            if (bestCount > 0) {
                const predictedGroup = this.decidePredictionWithScores(bestGroup, this.fallbackScores);
                const confidence = Math.min(70, Math.max(35, Math.round((bestCount / (bestCount + 1)) * 100)));
                
                return {
                    nextGroup: predictedGroup,
                    confidence: confidence,
                    hasSpecificData: true,
                    reason: `Fallback Mode: After pattern ${this.fallbackTracking.lastPattern}, most common is ${bestGroup}, score-adjusted to ${predictedGroup}`
                };
            }
        }
        
        const mostCommonGroup = this.getMostCommonGroupFromGlobal();
        const predictedGroup = this.decidePredictionWithScores(mostCommonGroup, this.fallbackScores);
        
        const count = this.globalFallbackStats.nextGroups[predictedGroup] || 0;
        const total = this.globalFallbackStats.totalBreaks || 1;
        const confidence = Math.min(70, Math.max(35, Math.round((count / total) * 100)));
        
        return {
            nextGroup: predictedGroup,
            confidence: confidence,
            hasSpecificData: false,
            reason: `Fallback: Most common ${mostCommonGroup}, score-adjusted to ${predictedGroup}`
        };
    }
    
    updateFallbackScores(predictedGroup, actualGroup) {
        if (predictedGroup !== actualGroup) {
            this.fallbackScores[predictedGroup] = Math.max(0, this.fallbackScores[predictedGroup] - 20);
        }
        this.fallbackScores[actualGroup] = Math.min(100, this.fallbackScores[actualGroup] + 20);
    }
    
    getHighestScoreGroup(scores) {
        let bestGroup = "LOW";
        let bestScore = -1;
        
        for (let group of this.groups) {
            if (scores[group] > bestScore) {
                bestScore = scores[group];
                bestGroup = group;
            }
        }
        return bestGroup;
    }
    
    predict(currentGroup, previousGroup) {
        const immediatePattern = `${previousGroup}→${currentGroup}`;
        
        if (immediatePattern === "MEDIUM→HIGH" || immediatePattern === "HIGH→MEDIUM") {
            let streakLength = (this.currentPatternKey === immediatePattern) ? this.currentStreak : 1;
            streakLength = Math.min(18, Math.max(1, streakLength));
            
            let mostCommonGroup = this.getMostlyGroupForPattern(immediatePattern, streakLength);
            const scores = this.patternScores[immediatePattern][streakLength];
            
            let predictedGroup = null;
            let confidence = 0;
            let hasSpecificData = false;
            
            if (mostCommonGroup) {
                hasSpecificData = true;
                predictedGroup = this.decidePredictionWithScores(mostCommonGroup, scores);
                const data = this.patterns[immediatePattern][streakLength];
                const count = data.nextGroups[predictedGroup] || 0;
                confidence = data.totalBreaks > 0 ? Math.round((count / data.totalBreaks) * 100) : 40;
            } else {
                predictedGroup = this.getHighestScoreGroup(scores);
                confidence = 40;
                hasSpecificData = false;
            }
            
            const predictionType = (predictedGroup === currentGroup) ? "CONTINUE" : "BREAK";
            
            this.lastPredictionInfo = {
                patternKey: immediatePattern,
                streakLength: streakLength,
                predictedGroup: predictedGroup,
                usedScores: true,
                isFallback: false
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
                breakProbability: 100 - confidence,
                hasSpecificData: hasSpecificData,
                reason: `After ${streakLength}x alternating ${immediatePattern}, predicting ${predictedGroup}`,
                accuracy: this.accuracy,
                scores: scores
            };
        }
        
        const fallbackResult = this.getFallbackPredictionWithScores();
        
        this.lastPredictionInfo = {
            patternKey: "FALLBACK",
            streakLength: 0,
            predictedGroup: fallbackResult.nextGroup,
            usedScores: true,
            isFallback: true
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
            breakProbability: 100 - fallbackResult.confidence,
            hasSpecificData: false,
            reason: fallbackResult.reason,
            accuracy: this.accuracy,
            fallbackScores: this.fallbackScores
        };
    }
    
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        if (this.lastPredictionInfo && this.lastPredictionInfo.predictedGroup) {
            const predicted = this.lastPredictionInfo.predictedGroup;
            this.updateFallbackScores(predicted, resultGroup);
            
            if (this.lastPredictionInfo.usedScores && !this.lastPredictionInfo.isFallback) {
                this.updateScores(
                    this.lastPredictionInfo.patternKey,
                    this.lastPredictionInfo.streakLength,
                    predicted,
                    resultGroup
                );
            }
        }
        
        const isMidHighPattern = (patternKey === "MEDIUM→HIGH" || patternKey === "HIGH→MEDIUM");
        
        if (isMidHighPattern) {
            this.fallbackTracking = {
                active: false,
                lastPattern: patternKey,
                trackedGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        } else {
            if (!this.fallbackTracking.active && this.fallbackTracking.lastPattern) {
                this.fallbackTracking.active = true;
            }
            if (this.fallbackTracking.active) {
                this.fallbackTracking.trackedGroups[resultGroup]++;
            }
        }
        
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
            } else {
                this.globalFallbackStats.totalBreaks++;
                this.globalFallbackStats.nextGroups[resultGroup]++;
            }
        }
        
        this.lastPredictionInfo = null;
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
            this.patternScores = data.patternScores || this.patternScores;
            this.fallbackScores = data.fallbackScores || this.fallbackScores;
            this.globalFallbackStats = data.globalFallbackStats || this.globalFallbackStats;
            this.fallbackTracking = data.fallbackTracking || { active: false, lastPattern: null, trackedGroups: { LOW:0, MEDIUM:0, HIGH:0 } };
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
            patternScores: this.patternScores,
            fallbackScores: this.fallbackScores,
            globalFallbackStats: this.globalFallbackStats,
            fallbackTracking: this.fallbackTracking,
            currentPatternKey: this.currentPatternKey,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * Server Ensemble Voter
 */
class ServerEnsembleVoter {
    constructor() {
        this.name = "EnsembleVoter";
        this.version = "5.0";
        
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
        const safeAccStick = isNaN(accStick) ? 0 : accStick;
        const safeAccExtreme = isNaN(accExtreme) ? 0 : accExtreme;
        const safeAccLowMid = isNaN(accLowMid) ? 0 : accLowMid;
        const safeAccMidHigh = isNaN(accMidHigh) ? 0 : accMidHigh;
        
        const total = safeAccStick + safeAccExtreme + safeAccLowMid + safeAccMidHigh;
        if (total > 0) {
            this.weights.stick = Math.min(this.maxWeight, Math.max(this.minWeight, safeAccStick / total));
            this.weights.extremeSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, safeAccExtreme / total));
            this.weights.lowMidSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, safeAccLowMid / total));
            this.weights.midHighSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, safeAccMidHigh / total));
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


// ========== EXPORT ALL CLASSES ==========
module.exports = {
    ServerAI_Stick,
    ServerAI_ExtremeSwitch,
    ServerAI_LowMidSwitch,
    ServerAI_MidHighSwitch,
    ServerEnsembleVoter
};
