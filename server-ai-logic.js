// server-ai-logic.js
// Server-side AI Logic - Duplicate of client-side AI models for offline prediction

/**
 * AI-A: Stick Pattern Detector (Server Version)
 * Tracks: LOW→LOW, MEDIUM→MEDIUM, HIGH→HIGH
 */
class ServerAI_Stick {
    constructor() {
        this.name = "AI_Stick";
        this.patternStreaks = {
            "LOW→LOW": 0,
            "MEDIUM→MEDIUM": 0,
            "HIGH→HIGH": 0
        };
        this.patternHistory = {
            "LOW→LOW": { maxStreak: 0, breaks: [], nextAfterBreak: {} },
            "MEDIUM→MEDIUM": { maxStreak: 0, breaks: [], nextAfterBreak: {} },
            "HIGH→HIGH": { maxStreak: 0, breaks: [], nextAfterBreak: {} }
        };
        this.defaultMaxStreak = {
            "LOW→LOW": 20,
            "MEDIUM→MEDIUM": 17,
            "HIGH→HIGH": 18
        };
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }

    train(history) {
        if (!history || history.length < 3) return false;
        
        // Reset streaks
        for (let pattern in this.patternStreaks) {
            this.patternStreaks[pattern] = 0;
        }
        
        for (let i = 1; i < history.length; i++) {
            const prevGroup = history[i-1].group;
            const currGroup = history[i].group;
            const patternKey = `${prevGroup}→${currGroup}`;
            
            if (this.patternStreaks.hasOwnProperty(patternKey)) {
                if (prevGroup === currGroup) {
                    this.patternStreaks[patternKey]++;
                } else {
                    const streakValue = this.patternStreaks[patternKey];
                    if (streakValue > 0) {
                        this.recordBreak(patternKey, streakValue, currGroup);
                    }
                    this.patternStreaks[patternKey] = 0;
                }
            }
        }
        
        this.calculateStats();
        return true;
    }

    recordBreak(pattern, streakLength, nextGroup) {
        const history = this.patternHistory[pattern];
        if (history) {
            history.breaks.push(streakLength);
            if (streakLength > history.maxStreak) {
                history.maxStreak = streakLength;
            }
            history.nextAfterBreak[nextGroup] = (history.nextAfterBreak[nextGroup] || 0) + 1;
        }
    }

    calculateStats() {
        for (let pattern in this.patternHistory) {
            const history = this.patternHistory[pattern];
            if (history.breaks.length > 0) {
                const sum = history.breaks.reduce((a, b) => a + b, 0);
                history.avgStreak = sum / history.breaks.length;
            }
        }
    }

    predict(currentGroup, previousGroup) {
        if (currentGroup !== previousGroup) {
            return this.getDefaultPrediction(currentGroup);
        }
        
        const patternKey = `${previousGroup}→${currentGroup}`;
        const currentStreak = (this.patternStreaks[patternKey] || 0) + 1;
        const history = this.patternHistory[patternKey];
        const maxStreak = history.maxStreak > 0 ? history.maxStreak : this.defaultMaxStreak[patternKey];
        
        let breakProbability = 0;
        let willBreak = false;
        
        if (currentStreak >= maxStreak - 3) {
            breakProbability = 60 + ((currentStreak - (maxStreak - 3)) * 10);
            if (breakProbability > 95) breakProbability = 95;
            willBreak = breakProbability > 70;
        } else if (currentStreak >= maxStreak - 6) {
            breakProbability = 40 + ((currentStreak - (maxStreak - 6)) * 7);
        } else {
            breakProbability = 10 + (currentStreak * 2);
            if (breakProbability > 35) breakProbability = 35;
        }
        
        let nextGroup = currentGroup;
        if (willBreak && history.nextAfterBreak) {
            let maxCount = 0;
            for (let [group, count] of Object.entries(history.nextAfterBreak)) {
                if (count > maxCount) {
                    maxCount = count;
                    nextGroup = group;
                }
            }
        }
        
        return {
            model: this.name,
            prediction: willBreak ? "SWITCH" : "STICK",
            currentGroup: currentGroup,
            currentStreak: currentStreak,
            maxStreak: maxStreak,
            breakProbability: Math.round(breakProbability),
            nextGroup: nextGroup,
            confidence: Math.round(100 - breakProbability),
            accuracy: this.accuracy
        };
    }

    getDefaultPrediction(group) {
        return {
            model: this.name,
            prediction: "STICK",
            currentGroup: group,
            currentStreak: 1,
            maxStreak: 20,
            breakProbability: 5,
            nextGroup: group,
            confidence: 70,
            accuracy: this.accuracy
        };
    }

    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        if (previousGroup === resultGroup) {
            this.patternStreaks[patternKey] = (this.patternStreaks[patternKey] || 0) + 1;
        } else {
            const streakValue = this.patternStreaks[patternKey] || 0;
            if (streakValue > 0) {
                this.recordBreak(patternKey, streakValue, resultGroup);
                this.calculateStats();
            }
            this.patternStreaks[patternKey] = 0;
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
            this.patternStreaks = data.patternStreaks || this.patternStreaks;
            this.patternHistory = data.patternHistory || this.patternHistory;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
            this.calculateStats();
        }
    }
    
    exportForServer() {
        return {
            patternStreaks: this.patternStreaks,
            patternHistory: this.patternHistory,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}

/**
 * AI-B: Extreme Switch Detector (Server Version)
 * Tracks: LOW→HIGH, HIGH→LOW
 */
class ServerAI_ExtremeSwitch {
    constructor() {
        this.name = "AI_ExtremeSwitch";
        this.patternStreaks = {
            "LOW→HIGH": 0,
            "HIGH→LOW": 0
        };
        this.patternHistory = {
            "LOW→HIGH": { maxStreak: 0, breaks: [], nextAfterBreak: {} },
            "HIGH→LOW": { maxStreak: 0, breaks: [], nextAfterBreak: {} }
        };
        this.defaultMaxStreak = {
            "LOW→HIGH": 20,
            "HIGH→LOW": 20
        };
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }

    train(history) {
        if (!history || history.length < 3) return false;
        
        for (let pattern in this.patternStreaks) {
            this.patternStreaks[pattern] = 0;
        }
        
        for (let i = 1; i < history.length; i++) {
            const prevGroup = history[i-1].group;
            const currGroup = history[i].group;
            const patternKey = `${prevGroup}→${currGroup}`;
            
            if (this.patternStreaks.hasOwnProperty(patternKey)) {
                if ((prevGroup === "LOW" && currGroup === "HIGH") || 
                    (prevGroup === "HIGH" && currGroup === "LOW")) {
                    this.patternStreaks[patternKey]++;
                } else {
                    const streakValue = this.patternStreaks[patternKey];
                    if (streakValue > 0) {
                        this.recordBreak(patternKey, streakValue, currGroup);
                    }
                    this.patternStreaks[patternKey] = 0;
                }
            }
        }
        
        this.calculateStats();
        return true;
    }

    recordBreak(pattern, streakLength, nextGroup) {
        const history = this.patternHistory[pattern];
        if (history) {
            history.breaks.push(streakLength);
            if (streakLength > history.maxStreak) {
                history.maxStreak = streakLength;
            }
            history.nextAfterBreak[nextGroup] = (history.nextAfterBreak[nextGroup] || 0) + 1;
        }
    }

    calculateStats() {
        for (let pattern in this.patternHistory) {
            const history = this.patternHistory[pattern];
            if (history.breaks.length > 0) {
                const sum = history.breaks.reduce((a, b) => a + b, 0);
                history.avgStreak = sum / history.breaks.length;
            }
        }
    }

    predict(currentGroup, previousGroup) {
        const patternKey = `${previousGroup}→${currentGroup}`;
        
        if (!this.patternStreaks.hasOwnProperty(patternKey)) {
            return this.getDefaultPrediction();
        }
        
        const currentStreak = this.patternStreaks[patternKey] + 1;
        const history = this.patternHistory[patternKey];
        const maxStreak = history.maxStreak > 0 ? history.maxStreak : this.defaultMaxStreak[patternKey];
        
        let breakProbability = 0;
        let willBreak = false;
        
        if (currentStreak >= maxStreak - 3) {
            breakProbability = 60 + ((currentStreak - (maxStreak - 3)) * 10);
            if (breakProbability > 95) breakProbability = 95;
            willBreak = breakProbability > 70;
        } else if (currentStreak >= maxStreak - 6) {
            breakProbability = 40 + ((currentStreak - (maxStreak - 6)) * 7);
        } else {
            breakProbability = 10 + (currentStreak * 2);
            if (breakProbability > 35) breakProbability = 35;
        }
        
        let nextGroup = "MEDIUM";
        if (willBreak && history.nextAfterBreak) {
            let maxCount = 0;
            for (let [group, count] of Object.entries(history.nextAfterBreak)) {
                if (count > maxCount) {
                    maxCount = count;
                    nextGroup = group;
                }
            }
        }
        
        return {
            model: this.name,
            prediction: willBreak ? "BREAK" : "CONTINUE",
            pattern: patternKey,
            currentStreak: currentStreak,
            maxStreak: maxStreak,
            breakProbability: Math.round(breakProbability),
            nextGroup: nextGroup,
            confidence: Math.round(100 - breakProbability),
            accuracy: this.accuracy
        };
    }

    getDefaultPrediction() {
        return {
            model: this.name,
            prediction: "CONTINUE",
            pattern: "LOW→HIGH",
            currentStreak: 1,
            maxStreak: 20,
            breakProbability: 5,
            nextGroup: "MEDIUM",
            confidence: 70,
            accuracy: this.accuracy
        };
    }

    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        if (this.patternStreaks.hasOwnProperty(patternKey)) {
            this.patternStreaks[patternKey]++;
        } else {
            for (let p in this.patternStreaks) {
                const streakValue = this.patternStreaks[p];
                if (streakValue > 0) {
                    this.recordBreak(p, streakValue, resultGroup);
                    this.calculateStats();
                }
                this.patternStreaks[p] = 0;
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
            this.patternStreaks = data.patternStreaks || this.patternStreaks;
            this.patternHistory = data.patternHistory || this.patternHistory;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
            this.calculateStats();
        }
    }
    
    exportForServer() {
        return {
            patternStreaks: this.patternStreaks,
            patternHistory: this.patternHistory,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}

/**
 * AI-C: Low-Mid Switch Detector (Server Version)
 * Tracks: LOW→MEDIUM, MEDIUM→LOW
 */
class ServerAI_LowMidSwitch {
    constructor() {
        this.name = "AI_LowMidSwitch";
        this.patternStreaks = {
            "LOW→MEDIUM": 0,
            "MEDIUM→LOW": 0
        };
        this.patternHistory = {
            "LOW→MEDIUM": { maxStreak: 0, breaks: [], nextAfterBreak: {} },
            "MEDIUM→LOW": { maxStreak: 0, breaks: [], nextAfterBreak: {} }
        };
        this.defaultMaxStreak = {
            "LOW→MEDIUM": 18,
            "MEDIUM→LOW": 18
        };
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }

    train(history) {
        if (!history || history.length < 3) return false;
        
        for (let pattern in this.patternStreaks) {
            this.patternStreaks[pattern] = 0;
        }
        
        for (let i = 1; i < history.length; i++) {
            const prevGroup = history[i-1].group;
            const currGroup = history[i].group;
            const patternKey = `${prevGroup}→${currGroup}`;
            
            if (this.patternStreaks.hasOwnProperty(patternKey)) {
                if ((prevGroup === "LOW" && currGroup === "MEDIUM") || 
                    (prevGroup === "MEDIUM" && currGroup === "LOW")) {
                    this.patternStreaks[patternKey]++;
                } else {
                    const streakValue = this.patternStreaks[patternKey];
                    if (streakValue > 0) {
                        this.recordBreak(patternKey, streakValue, currGroup);
                    }
                    this.patternStreaks[patternKey] = 0;
                }
            }
        }
        
        this.calculateStats();
        return true;
    }

    recordBreak(pattern, streakLength, nextGroup) {
        const history = this.patternHistory[pattern];
        if (history) {
            history.breaks.push(streakLength);
            if (streakLength > history.maxStreak) {
                history.maxStreak = streakLength;
            }
            history.nextAfterBreak[nextGroup] = (history.nextAfterBreak[nextGroup] || 0) + 1;
        }
    }

    calculateStats() {
        for (let pattern in this.patternHistory) {
            const history = this.patternHistory[pattern];
            if (history.breaks.length > 0) {
                const sum = history.breaks.reduce((a, b) => a + b, 0);
                history.avgStreak = sum / history.breaks.length;
            }
        }
    }

    predict(currentGroup, previousGroup) {
        const patternKey = `${previousGroup}→${currentGroup}`;
        
        if (!this.patternStreaks.hasOwnProperty(patternKey)) {
            return this.getDefaultPrediction();
        }
        
        const currentStreak = this.patternStreaks[patternKey] + 1;
        const history = this.patternHistory[patternKey];
        const maxStreak = history.maxStreak > 0 ? history.maxStreak : this.defaultMaxStreak[patternKey];
        
        let breakProbability = 0;
        let willBreak = false;
        
        if (currentStreak >= maxStreak - 3) {
            breakProbability = 60 + ((currentStreak - (maxStreak - 3)) * 10);
            if (breakProbability > 95) breakProbability = 95;
            willBreak = breakProbability > 70;
        } else if (currentStreak >= maxStreak - 6) {
            breakProbability = 40 + ((currentStreak - (maxStreak - 6)) * 7);
        } else {
            breakProbability = 10 + (currentStreak * 2);
            if (breakProbability > 35) breakProbability = 35;
        }
        
        let nextGroup = "HIGH";
        if (willBreak && history.nextAfterBreak) {
            let maxCount = 0;
            for (let [group, count] of Object.entries(history.nextAfterBreak)) {
                if (count > maxCount) {
                    maxCount = count;
                    nextGroup = group;
                }
            }
        }
        
        return {
            model: this.name,
            prediction: willBreak ? "BREAK" : "CONTINUE",
            pattern: patternKey,
            currentStreak: currentStreak,
            maxStreak: maxStreak,
            breakProbability: Math.round(breakProbability),
            nextGroup: nextGroup,
            confidence: Math.round(100 - breakProbability),
            accuracy: this.accuracy
        };
    }

    getDefaultPrediction() {
        return {
            model: this.name,
            prediction: "CONTINUE",
            pattern: "LOW→MEDIUM",
            currentStreak: 1,
            maxStreak: 18,
            breakProbability: 5,
            nextGroup: "HIGH",
            confidence: 70,
            accuracy: this.accuracy
        };
    }

    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        if (this.patternStreaks.hasOwnProperty(patternKey)) {
            this.patternStreaks[patternKey]++;
        } else {
            for (let p in this.patternStreaks) {
                const streakValue = this.patternStreaks[p];
                if (streakValue > 0) {
                    this.recordBreak(p, streakValue, resultGroup);
                    this.calculateStats();
                }
                this.patternStreaks[p] = 0;
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
            this.patternStreaks = data.patternStreaks || this.patternStreaks;
            this.patternHistory = data.patternHistory || this.patternHistory;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
            this.calculateStats();
        }
    }
    
    exportForServer() {
        return {
            patternStreaks: this.patternStreaks,
            patternHistory: this.patternHistory,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.accuracy
        };
    }
}

/**
 * AI-D: Mid-High Switch Detector (Server Version)
 * Tracks: MEDIUM→HIGH, HIGH→MEDIUM
 */
class ServerAI_MidHighSwitch {
    constructor() {
        this.name = "AI_MidHighSwitch";
        this.patternStreaks = {
            "MEDIUM→HIGH": 0,
            "HIGH→MEDIUM": 0
        };
        this.patternHistory = {
            "MEDIUM→HIGH": { maxStreak: 0, breaks: [], nextAfterBreak: {} },
            "HIGH→MEDIUM": { maxStreak: 0, breaks: [], nextAfterBreak: {} }
        };
        this.defaultMaxStreak = {
            "MEDIUM→HIGH": 17,
            "HIGH→MEDIUM": 17
        };
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }

    train(history) {
        if (!history || history.length < 3) return false;
        
        for (let pattern in this.patternStreaks) {
            this.patternStreaks[pattern] = 0;
        }
        
        for (let i = 1; i < history.length; i++) {
            const prevGroup = history[i-1].group;
            const currGroup = history[i].group;
            const patternKey = `${prevGroup}→${currGroup}`;
            
            if (this.patternStreaks.hasOwnProperty(patternKey)) {
                if ((prevGroup === "MEDIUM" && currGroup === "HIGH") || 
                    (prevGroup === "HIGH" && currGroup === "MEDIUM")) {
                    this.patternStreaks[patternKey]++;
                } else {
                    const streakValue = this.patternStreaks[patternKey];
                    if (streakValue > 0) {
                        this.recordBreak(patternKey, streakValue, currGroup);
                    }
                    this.patternStreaks[patternKey] = 0;
                }
            }
        }
        
        this.calculateStats();
        return true;
    }

    recordBreak(pattern, streakLength, nextGroup) {
        const history = this.patternHistory[pattern];
        if (history) {
            history.breaks.push(streakLength);
            if (streakLength > history.maxStreak) {
                history.maxStreak = streakLength;
            }
            history.nextAfterBreak[nextGroup] = (history.nextAfterBreak[nextGroup] || 0) + 1;
        }
    }

    calculateStats() {
        for (let pattern in this.patternHistory) {
            const history = this.patternHistory[pattern];
            if (history.breaks.length > 0) {
                const sum = history.breaks.reduce((a, b) => a + b, 0);
                history.avgStreak = sum / history.breaks.length;
            }
        }
    }

    predict(currentGroup, previousGroup) {
        const patternKey = `${previousGroup}→${currentGroup}`;
        
        if (!this.patternStreaks.hasOwnProperty(patternKey)) {
            return this.getDefaultPrediction();
        }
        
        const currentStreak = this.patternStreaks[patternKey] + 1;
        const history = this.patternHistory[patternKey];
        const maxStreak = history.maxStreak > 0 ? history.maxStreak : this.defaultMaxStreak[patternKey];
        
        let breakProbability = 0;
        let willBreak = false;
        
        if (currentStreak >= maxStreak - 3) {
            breakProbability = 60 + ((currentStreak - (maxStreak - 3)) * 10);
            if (breakProbability > 95) breakProbability = 95;
            willBreak = breakProbability > 70;
        } else if (currentStreak >= maxStreak - 6) {
            breakProbability = 40 + ((currentStreak - (maxStreak - 6)) * 7);
        } else {
            breakProbability = 10 + (currentStreak * 2);
            if (breakProbability > 35) breakProbability = 35;
        }
        
        let nextGroup = "LOW";
        if (willBreak && history.nextAfterBreak) {
            let maxCount = 0;
            for (let [group, count] of Object.entries(history.nextAfterBreak)) {
                if (count > maxCount) {
                    maxCount = count;
                    nextGroup = group;
                }
            }
        }
        
        return {
            model: this.name,
            prediction: willBreak ? "BREAK" : "CONTINUE",
            pattern: patternKey,
            currentStreak: currentStreak,
            maxStreak: maxStreak,
            breakProbability: Math.round(breakProbability),
            nextGroup: nextGroup,
            confidence: Math.round(100 - breakProbability),
            accuracy: this.accuracy
        };
    }

    getDefaultPrediction() {
        return {
            model: this.name,
            prediction: "CONTINUE",
            pattern: "MEDIUM→HIGH",
            currentStreak: 1,
            maxStreak: 17,
            breakProbability: 5,
            nextGroup: "LOW",
            confidence: 70,
            accuracy: this.accuracy
        };
    }

    updateWithResult(resultGroup, previousGroup) {
        const patternKey = `${previousGroup}→${resultGroup}`;
        
        if (this.patternStreaks.hasOwnProperty(patternKey)) {
            this.patternStreaks[patternKey]++;
        } else {
            for (let p in this.patternStreaks) {
                const streakValue = this.patternStreaks[p];
                if (streakValue > 0) {
                    this.recordBreak(p, streakValue, resultGroup);
                    this.calculateStats();
                }
                this.patternStreaks[p] = 0;
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
            this.patternStreaks = data.patternStreaks || this.patternStreaks;
            this.patternHistory = data.patternHistory || this.patternHistory;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
            this.calculateStats();
        }
    }
    
    exportForServer() {
        return {
            patternStreaks: this.patternStreaks,
            patternHistory: this.patternHistory,
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
        this.weights = {
            stick: 0.25,
            extremeSwitch: 0.25,
            lowMidSwitch: 0.25,
            midHighSwitch: 0.25
        };
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
    }

    combine(predStick, predExtreme, predLowMid, predMidHigh) {
        const predictions = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        const voteCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        
        // AI-A (Stick)
        if (predStick) {
            if (predStick.prediction === "STICK" && predStick.nextGroup) {
                predictions[predStick.nextGroup] += predStick.confidence * this.weights.stick;
                voteCount[predStick.nextGroup]++;
            } else if (predStick.prediction === "SWITCH" && predStick.nextGroup) {
                predictions[predStick.nextGroup] += 50 * this.weights.stick;
                voteCount[predStick.nextGroup]++;
            }
        }
        
        // AI-B (Extreme Switch)
        if (predExtreme) {
            if (predExtreme.prediction === "CONTINUE" && predExtreme.pattern) {
                const targetGroup = predExtreme.pattern.split("→")[1];
                if (targetGroup && predictions[targetGroup] !== undefined) {
                    predictions[targetGroup] += predExtreme.confidence * this.weights.extremeSwitch;
                    voteCount[targetGroup]++;
                }
            } else if (predExtreme.prediction === "BREAK" && predExtreme.nextGroup) {
                predictions[predExtreme.nextGroup] += 50 * this.weights.extremeSwitch;
                voteCount[predExtreme.nextGroup]++;
            }
        }
        
        // AI-C (Low-Mid Switch)
        if (predLowMid) {
            if (predLowMid.prediction === "CONTINUE" && predLowMid.pattern) {
                const targetGroup = predLowMid.pattern.split("→")[1];
                if (targetGroup && predictions[targetGroup] !== undefined) {
                    predictions[targetGroup] += predLowMid.confidence * this.weights.lowMidSwitch;
                    voteCount[targetGroup]++;
                }
            } else if (predLowMid.prediction === "BREAK" && predLowMid.nextGroup) {
                predictions[predLowMid.nextGroup] += 50 * this.weights.lowMidSwitch;
                voteCount[predLowMid.nextGroup]++;
            }
        }
        
        // AI-D (Mid-High Switch)
        if (predMidHigh) {
            if (predMidHigh.prediction === "CONTINUE" && predMidHigh.pattern) {
                const targetGroup = predMidHigh.pattern.split("→")[1];
                if (targetGroup && predictions[targetGroup] !== undefined) {
                    predictions[targetGroup] += predMidHigh.confidence * this.weights.midHighSwitch;
                    voteCount[targetGroup]++;
                }
            } else if (predMidHigh.prediction === "BREAK" && predMidHigh.nextGroup) {
                predictions[predMidHigh.nextGroup] += 50 * this.weights.midHighSwitch;
                voteCount[predMidHigh.nextGroup]++;
            }
        }
        
        // Find winner
        let finalGroup = "MEDIUM";
        let finalScore = 0;
        for (let [group, score] of Object.entries(predictions)) {
            if (score > finalScore) {
                finalScore = score;
                finalGroup = group;
            }
        }
        
        const agreement = Math.max(...Object.values(voteCount));
        
        return {
            final: {
                group: finalGroup,
                confidence: Math.min(95, Math.round(finalScore)),
                agreement: agreement
            },
            voteCount: voteCount
        };
    }

    updateWeights(accStick, accExtreme, accLowMid, accMidHigh) {
        const total = accStick + accExtreme + accLowMid + accMidHigh;
        if (total > 0) {
            this.weights.stick = accStick / total;
            this.weights.extremeSwitch = accExtreme / total;
            this.weights.lowMidSwitch = accLowMid / total;
            this.weights.midHighSwitch = accMidHigh / total;
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
