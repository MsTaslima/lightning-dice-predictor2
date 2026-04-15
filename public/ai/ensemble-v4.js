/**
 * Ensemble Voter v4.0
 * Combines predictions from all 4 AI models
 * With Server Sync Support
 */

class EnsembleVoterV4 {
    constructor() {
        this.name = "EnsembleVoterV4";
        this.version = "4.0";
        
        // Dynamic weights based on accuracy
        this.weights = {
            stick: 0.25,
            extremeSwitch: 0.25,
            lowMidSwitch: 0.25,
            midHighSwitch: 0.25
        };
        
        this.defaultWeights = { ...this.weights };
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        
        this.init();
    }
    
    init() {
        console.log('🏆 Ensemble Voter v4.0 Initializing...');
        this.loadWeights();
        this.loadAccuracy();
    }
    
    combine(predStick, predExtreme, predLowMid, predMidHigh, currentGroup, previousGroup) {
        // Extract group predictions from each AI
        const predictions = {
            LOW: 0,
            MEDIUM: 0,
            HIGH: 0
        };
        
        // AI-A (Stick) - gives nextGroup if stick continues
        if (predStick && predStick.prediction === "STICK") {
            if (predStick.nextGroup) predictions[predStick.nextGroup] += predStick.confidence * this.weights.stick;
        } else if (predStick && predStick.prediction === "SWITCH") {
            if (predStick.nextGroup) predictions[predStick.nextGroup] += (predStick.nextGroupConfidence || 50) * this.weights.stick;
        }
        
        // AI-B (Extreme Switch)
        if (predExtreme && predExtreme.prediction === "CONTINUE" && predExtreme.pattern) {
            const targetGroup = predExtreme.pattern.split("→")[1];
            if (targetGroup) predictions[targetGroup] += predExtreme.confidence * this.weights.extremeSwitch;
        } else if (predExtreme && predExtreme.prediction === "BREAK" && predExtreme.nextGroup) {
            predictions[predExtreme.nextGroup] += (predExtreme.nextGroupConfidence || 50) * this.weights.extremeSwitch;
        }
        
        // AI-C (Low-Mid Switch)
        if (predLowMid && predLowMid.prediction === "CONTINUE" && predLowMid.pattern) {
            const targetGroup = predLowMid.pattern.split("→")[1];
            if (targetGroup) predictions[targetGroup] += predLowMid.confidence * this.weights.lowMidSwitch;
        } else if (predLowMid && predLowMid.prediction === "BREAK" && predLowMid.nextGroup) {
            predictions[predLowMid.nextGroup] += (predLowMid.nextGroupConfidence || 50) * this.weights.lowMidSwitch;
        }
        
        // AI-D (Mid-High Switch)
        if (predMidHigh && predMidHigh.prediction === "CONTINUE" && predMidHigh.pattern) {
            const targetGroup = predMidHigh.pattern.split("→")[1];
            if (targetGroup) predictions[targetGroup] += predMidHigh.confidence * this.weights.midHighSwitch;
        } else if (predMidHigh && predMidHigh.prediction === "BREAK" && predMidHigh.nextGroup) {
            predictions[predMidHigh.nextGroup] += (predMidHigh.nextGroupConfidence || 50) * this.weights.midHighSwitch;
        }
        
        // Find winner
        let finalGroup = "MEDIUM";
        let finalScore = 0;
        let voteCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        
        for (let [group, score] of Object.entries(predictions)) {
            if (score > finalScore) {
                finalScore = score;
                finalGroup = group;
            }
        }
        
        // Count votes
        if (predStick && predStick.nextGroup) voteCount[predStick.nextGroup]++;
        if (predExtreme && predExtreme.prediction === "CONTINUE" && predExtreme.pattern) {
            const target = predExtreme.pattern.split("→")[1];
            if (target) voteCount[target]++;
        }
        if (predExtreme && predExtreme.prediction === "BREAK" && predExtreme.nextGroup) voteCount[predExtreme.nextGroup]++;
        if (predLowMid && predLowMid.prediction === "CONTINUE" && predLowMid.pattern) {
            const target = predLowMid.pattern.split("→")[1];
            if (target) voteCount[target]++;
        }
        if (predLowMid && predLowMid.prediction === "BREAK" && predLowMid.nextGroup) voteCount[predLowMid.nextGroup]++;
        if (predMidHigh && predMidHigh.prediction === "CONTINUE" && predMidHigh.pattern) {
            const target = predMidHigh.pattern.split("→")[1];
            if (target) voteCount[target]++;
        }
        if (predMidHigh && predMidHigh.prediction === "BREAK" && predMidHigh.nextGroup) voteCount[predMidHigh.nextGroup]++;
        
        const agreement = Math.max(...Object.values(voteCount));
        const finalConfidence = Math.min(95, Math.round(finalScore));
        
        // Generate explanation
        let explanation = this.generateExplanation(finalGroup, agreement, voteCount);
        
        return {
            final: {
                group: finalGroup,
                confidence: finalConfidence,
                scores: predictions,
                voteCount: voteCount,
                agreement: agreement
            },
            details: {
                ai_stick: predStick,
                ai_extreme_switch: predExtreme,
                ai_low_mid_switch: predLowMid,
                ai_mid_high_switch: predMidHigh
            },
            explanation: explanation,
            weights: this.weights
        };
    }
    
    generateExplanation(finalGroup, agreement, voteCount) {
        if (agreement === 4) {
            return `🎯 All 4 AI models unanimously agree on ${finalGroup}! Very high confidence prediction.`;
        } else if (agreement === 3) {
            return `⚡ Strong consensus: ${agreement} AI models predict ${finalGroup}.`;
        } else if (agreement === 2) {
            return `⚖️ Split decision: ${agreement} AI models favor ${finalGroup}.`;
        } else {
            return `🔄 All AI models disagree. Weighted voting selects ${finalGroup}.`;
        }
    }
    
    updateWeights(accStick, accExtreme, accLowMid, accMidHigh) {
        const total = accStick + accExtreme + accLowMid + accMidHigh;
        if (total > 0) {
            this.weights.stick = accStick / total;
            this.weights.extremeSwitch = accExtreme / total;
            this.weights.lowMidSwitch = accLowMid / total;
            this.weights.midHighSwitch = accMidHigh / total;
            
            this.saveWeights();
            console.log(`📊 Ensemble weights updated: Stick:${(this.weights.stick*100).toFixed(0)}%, Extreme:${(this.weights.extremeSwitch*100).toFixed(0)}%, LowMid:${(this.weights.lowMidSwitch*100).toFixed(0)}%, MidHigh:${(this.weights.midHighSwitch*100).toFixed(0)}%`);
        }
    }
    
    resetWeights() {
        this.weights = { ...this.defaultWeights };
        this.saveWeights();
        console.log('🔄 Ensemble weights reset to default');
    }
    
    recordPredictionResult(correct) {
        this.totalPredictions++;
        if (correct) this.correctPredictions++;
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
        this.saveAccuracy();
    }
    
    setAccuracy(accuracy) {
        this.accuracy = accuracy;
    }
    
    getAccuracy() {
        return this.accuracy || 0;
    }
    
    getTotalPredictions() {
        return this.totalPredictions;
    }
    
    getCorrectPredictions() {
        return this.correctPredictions;
    }
    
    saveWeights() {
        try {
            localStorage.setItem('ensemble_v4_weights', JSON.stringify(this.weights));
        } catch(e) { console.warn('Save weights failed:', e); }
    }
    
    loadWeights() {
        try {
            const saved = localStorage.getItem('ensemble_v4_weights');
            if (saved) {
                this.weights = JSON.parse(saved);
                console.log('✅ Ensemble v4 weights loaded from storage');
            }
        } catch(e) { console.warn('Load weights failed:', e); }
    }
    
    saveAccuracy() {
        try {
            localStorage.setItem('ensemble_v4_accuracy', JSON.stringify({
                totalPredictions: this.totalPredictions,
                correctPredictions: this.correctPredictions,
                accuracy: this.accuracy
            }));
        } catch(e) { console.warn('Save accuracy failed:', e); }
    }
    
    loadAccuracy() {
        try {
            const saved = localStorage.getItem('ensemble_v4_accuracy');
            if (saved) {
                const data = JSON.parse(saved);
                this.totalPredictions = data.totalPredictions || 0;
                this.correctPredictions = data.correctPredictions || 0;
                this.accuracy = data.accuracy || 0;
                console.log(`✅ Ensemble v4 accuracy loaded: ${this.accuracy.toFixed(1)}%`);
            }
        } catch(e) { console.warn('Load accuracy failed:', e); }
    }
    
    loadFromServer(data) {
        if (data) {
            this.weights = data.weights || this.weights;
            this.totalPredictions = data.totalPredictions || 0;
            this.correctPredictions = data.correctPredictions || 0;
            this.accuracy = data.accuracy || 0;
            console.log(`✅ Ensemble v4: Loaded from server (${this.accuracy.toFixed(1)}% accuracy)`);
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
    
    getGroupIcon(group) {
        if (group === 'LOW') return '🔴';
        if (group === 'MEDIUM') return '🟡';
        return '🟢';
    }
    
    getGroupRange(group) {
        if (group === 'LOW') return '3-9';
        if (group === 'MEDIUM') return '10-11';
        return '12-18';
    }
    
    getStats() {
        return {
            name: this.name,
            version: this.version,
            accuracy: this.accuracy,
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            weights: this.weights
        };
    }
}

window.EnsembleVoterV4 = new EnsembleVoterV4();
