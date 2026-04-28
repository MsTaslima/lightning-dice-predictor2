// ============================================================
// server-ai-logic.js (COMPLETE FINAL VERSION - FALLBACK SCORE FIXED)
// Four AI Pattern Recognition System - Server Side
// ALL AI HAVE FALLBACK PREDICTION SYSTEM + SCORE SYSTEM
// ============================================================

/**
 * AI-A: Stick Pattern Detector (Server Version)
 * Tracks: LOW→LOW, MEDIUM→MEDIUM, HIGH→HIGH
 */
class ServerAI_Stick {
    constructor() {
        this.name = "AI_Stick";
        this.groups = ['LOW', 'MEDIUM', 'HIGH'];
        
        this.currentStreak = 0;
        this.currentStreakGroup = null;
        
        this.streakLengthData = {};
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
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }
    
    init() {
        console.log('🤖 Server AI-A (Stick) initialized');
    }
    
    train(history) {
        if (!history || history.length < 3) return false;
        
        for (let len = 2; len <= 18; len++) {
            this.streakLengthData[len] = {
                totalBreaks: 0,
                nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 }
            };
        }
        this.globalFallback = { totalBreaks: 0, nextGroups: { "LOW": 0, "MEDIUM": 0, "HIGH": 0 } };
        
        let tempStreak = 1;
        let tempStreakGroup = null;
        
        for (let i = 1; i < history.length; i++) {
            const prevGroup = history[i-1].group;
            const currGroup = history[i].group;
            
            if (tempStreakGroup === null) tempStreakGroup = prevGroup;
            
            if (prevGroup === currGroup && tempStreakGroup === prevGroup) {
                tempStreak++;
            } else {
                if (tempStreak >= 2 && tempStreak <= 18) {
                    this.recordBreak(tempStreak, currGroup);
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
        
        let maxCount = 0, mostlyGroup = null;
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
        let maxCount = 0, mostlyGroup = "MEDIUM";
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
        if (this.currentStreakGroup !== previousGroup) return 1;
        return this.currentStreak;
    }
    
    getFallbackPrediction() {
        let bestGroup = "MEDIUM";
        let bestCount = 0;
        let totalBreaks = 0;
        
        for (let len = 2; len <= 18; len++) {
            const data = this.streakLengthData[len];
            if (data && data.nextGroups) {
                for (let group of this.groups) {
                    const count = data.nextGroups[group] || 0;
                    totalBreaks += count;
                    if (count > bestCount) {
                        bestCount = count;
                        bestGroup = group;
                    }
                }
            }
        }
        
        let confidence = 35;
        if (totalBreaks > 0) {
            const percentage = (bestCount / totalBreaks) * 100;
            confidence = Math.min(70, Math.max(35, Math.round(percentage)));
        }
        
        return {
            nextGroup: bestGroup,
            confidence: confidence,
            hasSpecificData: false,
            reason: `Fallback: Most common outcome from ${totalBreaks} breaks is ${bestGroup} (${confidence}%)`
        };
    }
    
    predict(currentGroup, previousGroup) {
        if (currentGroup !== previousGroup) {
            const fallback = this.getFallbackPrediction();
            return {
                model: this.name,
                prediction: "FALLBACK",
                currentGroup: currentGroup,
                previousGroup: previousGroup,
                currentStreak: 0,
                nextGroup: fallback.nextGroup,
                nextGroupConfidence: fallback.confidence,
                confidence: fallback.confidence,
                breakProbability: 100 - fallback.confidence,
                reason: fallback.reason,
                accuracy: this.accuracy
            };
        }
        
        let currentStreak = this.getCurrentStreakFromMemory(previousGroup, currentGroup);
        if (currentStreak === 0) currentStreak = 1;
        
        const streakLength = currentStreak;
        let predictedGroup = null;
        let confidence = 0;
        let hasSpecificData = false;
        
        if (streakLength >= 2 && streakLength <= 18) {
            predictedGroup = this.getMostlyGroupForStreak(streakLength);
            if (predictedGroup) {
                hasSpecificData = true;
                confidence = this.getConfidenceForStreak(streakLength, predictedGroup);
            }
        }
        
        if (!predictedGroup) {
            predictedGroup = this.getGlobalMostlyGroup();
            confidence = this.getGlobalConfidence(predictedGroup);
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
            hasSpecificData: hasSpecificData,
            reason: hasSpecificData 
                ? `After ${streakLength} stick(s), mostly ${predictedGroup} (${confidence}% confidence)`
                : `No data for ${streakLength} sticks, using global → ${predictedGroup}`,
            accuracy: this.accuracy
        };
    }
    
    updateWithResult(resultGroup, previousGroup) {
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
 * AI-B: Extreme Switch Detector (UPDATED WITH DYNAMIC SCORE SYSTEM)
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
        const mostCommonGroup = this.getMostCommonGroupFromGlobal();
        
        if (this.globalFallbackStats.totalBreaks === 0) {
            return {
                nextGroup: "MEDIUM",
                confidence: 35,
                hasSpecificData: false,
                reason: "Fallback: No global data available, default MEDIUM"
            };
        }
        
        const predictedGroup = this.decidePredictionWithScores(mostCommonGroup, this.fallbackScores);
        
        const count = this.globalFallbackStats.nextGroups[predictedGroup] || 0;
        const total = this.globalFallbackStats.totalBreaks;
        const confidence = total > 0 ? Math.round((count / total) * 100) : 35;
        
        return {
            nextGroup: predictedGroup,
            confidence: Math.min(70, Math.max(35, confidence)),
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
                mostCommonGroup = this.getMostlyGroupForPattern(immediatePattern, 1);
                if (mostCommonGroup) {
                    predictedGroup = this.decidePredictionWithScores(mostCommonGroup, scores);
                    const data = this.patterns[immediatePattern][1];
                    const count = data.nextGroups[predictedGroup] || 0;
                    confidence = data.totalBreaks > 0 ? Math.round((count / data.totalBreaks) * 100) : 40;
                    hasSpecificData = true;
                } else {
                    predictedGroup = this.getHighestScoreGroup(scores);
                    confidence = 40;
                    hasSpecificData = false;
                }
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
    
    // ========== FIXED: updateWithResult with proper fallback score update ==========
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        // CRITICAL FIX: Update fallback scores for EVERY prediction (including pattern matches)
        if (this.lastPredictionInfo && this.lastPredictionInfo.predictedGroup) {
            const predicted = this.lastPredictionInfo.predictedGroup;
            
            // Update fallback scores (always, for all predictions)
            if (predicted !== resultGroup) {
                this.fallbackScores[predicted] = Math.max(0, this.fallbackScores[predicted] - 20);
                console.log(`❌ FALLBACK SCORE: ${predicted} -20 → ${this.fallbackScores[predicted]}`);
            }
            this.fallbackScores[resultGroup] = Math.min(100, this.fallbackScores[resultGroup] + 20);
            console.log(`✅ FALLBACK SCORE: ${resultGroup} +20 → ${this.fallbackScores[resultGroup]}`);
            console.log(`📊 Current Fallback Scores: LOW=${this.fallbackScores.LOW}, MEDIUM=${this.fallbackScores.MEDIUM}, HIGH=${this.fallbackScores.HIGH}`);
        }
        
        // Update pattern-specific scores if applicable
        if (this.lastPredictionInfo && this.lastPredictionInfo.usedScores && !this.lastPredictionInfo.isFallback) {
            this.updateScores(
                this.lastPredictionInfo.patternKey,
                this.lastPredictionInfo.streakLength,
                this.lastPredictionInfo.predictedGroup,
                resultGroup
            );
        }
        
        // Update pattern streak tracking
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
            currentPatternKey: this.currentPatternKey,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * AI-C: Low-Mid Switch Detector (UPDATED WITH DYNAMIC SCORE SYSTEM)
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
        const mostCommonGroup = this.getMostCommonGroupFromGlobal();
        
        if (this.globalFallbackStats.totalBreaks === 0) {
            return {
                nextGroup: "HIGH",
                confidence: 35,
                hasSpecificData: false,
                reason: "Fallback: No global data available, default HIGH"
            };
        }
        
        const predictedGroup = this.decidePredictionWithScores(mostCommonGroup, this.fallbackScores);
        
        const count = this.globalFallbackStats.nextGroups[predictedGroup] || 0;
        const total = this.globalFallbackStats.totalBreaks;
        const confidence = total > 0 ? Math.round((count / total) * 100) : 35;
        
        return {
            nextGroup: predictedGroup,
            confidence: Math.min(70, Math.max(35, confidence)),
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
                mostCommonGroup = this.getMostlyGroupForPattern(immediatePattern, 1);
                if (mostCommonGroup) {
                    predictedGroup = this.decidePredictionWithScores(mostCommonGroup, scores);
                    const data = this.patterns[immediatePattern][1];
                    const count = data.nextGroups[predictedGroup] || 0;
                    confidence = data.totalBreaks > 0 ? Math.round((count / data.totalBreaks) * 100) : 40;
                    hasSpecificData = true;
                } else {
                    predictedGroup = this.getHighestScoreGroup(scores);
                    confidence = 40;
                    hasSpecificData = false;
                }
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
    
    // ========== FIXED: updateWithResult with proper fallback score update ==========
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        // CRITICAL FIX: Update fallback scores for EVERY prediction
        if (this.lastPredictionInfo && this.lastPredictionInfo.predictedGroup) {
            const predicted = this.lastPredictionInfo.predictedGroup;
            
            if (predicted !== resultGroup) {
                this.fallbackScores[predicted] = Math.max(0, this.fallbackScores[predicted] - 20);
                console.log(`❌ FALLBACK SCORE: ${predicted} -20 → ${this.fallbackScores[predicted]}`);
            }
            this.fallbackScores[resultGroup] = Math.min(100, this.fallbackScores[resultGroup] + 20);
            console.log(`✅ FALLBACK SCORE: ${resultGroup} +20 → ${this.fallbackScores[resultGroup]}`);
            console.log(`📊 Current Fallback Scores: LOW=${this.fallbackScores.LOW}, MEDIUM=${this.fallbackScores.MEDIUM}, HIGH=${this.fallbackScores.HIGH}`);
        }
        
        if (this.lastPredictionInfo && this.lastPredictionInfo.usedScores && !this.lastPredictionInfo.isFallback) {
            this.updateScores(
                this.lastPredictionInfo.patternKey,
                this.lastPredictionInfo.streakLength,
                this.lastPredictionInfo.predictedGroup,
                resultGroup
            );
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
            currentPatternKey: this.currentPatternKey,
            currentStreak: this.currentStreak,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}


/**
 * AI-D: Mid-High Switch Detector (UPDATED WITH DYNAMIC SCORE SYSTEM)
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
        const mostCommonGroup = this.getMostCommonGroupFromGlobal();
        
        if (this.globalFallbackStats.totalBreaks === 0) {
            return {
                nextGroup: "LOW",
                confidence: 35,
                hasSpecificData: false,
                reason: "Fallback: No global data available, default LOW"
            };
        }
        
        const predictedGroup = this.decidePredictionWithScores(mostCommonGroup, this.fallbackScores);
        
        const count = this.globalFallbackStats.nextGroups[predictedGroup] || 0;
        const total = this.globalFallbackStats.totalBreaks;
        const confidence = total > 0 ? Math.round((count / total) * 100) : 35;
        
        return {
            nextGroup: predictedGroup,
            confidence: Math.min(70, Math.max(35, confidence)),
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
                mostCommonGroup = this.getMostlyGroupForPattern(immediatePattern, 1);
                if (mostCommonGroup) {
                    predictedGroup = this.decidePredictionWithScores(mostCommonGroup, scores);
                    const data = this.patterns[immediatePattern][1];
                    const count = data.nextGroups[predictedGroup] || 0;
                    confidence = data.totalBreaks > 0 ? Math.round((count / data.totalBreaks) * 100) : 40;
                    hasSpecificData = true;
                } else {
                    predictedGroup = this.getHighestScoreGroup(scores);
                    confidence = 40;
                    hasSpecificData = false;
                }
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
    
    // ========== FIXED: updateWithResult with proper fallback score update ==========
    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        // CRITICAL FIX: Update fallback scores for EVERY prediction
        if (this.lastPredictionInfo && this.lastPredictionInfo.predictedGroup) {
            const predicted = this.lastPredictionInfo.predictedGroup;
            
            if (predicted !== resultGroup) {
                this.fallbackScores[predicted] = Math.max(0, this.fallbackScores[predicted] - 20);
                console.log(`❌ FALLBACK SCORE: ${predicted} -20 → ${this.fallbackScores[predicted]}`);
            }
            this.fallbackScores[resultGroup] = Math.min(100, this.fallbackScores[resultGroup] + 20);
            console.log(`✅ FALLBACK SCORE: ${resultGroup} +20 → ${this.fallbackScores[resultGroup]}`);
            console.log(`📊 Current Fallback Scores: LOW=${this.fallbackScores.LOW}, MEDIUM=${this.fallbackScores.MEDIUM}, HIGH=${this.fallbackScores.HIGH}`);
        }
        
        if (this.lastPredictionInfo && this.lastPredictionInfo.usedScores && !this.lastPredictionInfo.isFallback) {
            this.updateScores(
                this.lastPredictionInfo.patternKey,
                this.lastPredictionInfo.streakLength,
                this.lastPredictionInfo.predictedGroup,
                resultGroup
            );
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


// ========== EXPORT ALL CLASSES ==========
module.exports = {
    ServerAI_Stick,
    ServerAI_ExtremeSwitch,
    ServerAI_LowMidSwitch,
    ServerAI_MidHighSwitch,
    ServerEnsembleVoter
};
