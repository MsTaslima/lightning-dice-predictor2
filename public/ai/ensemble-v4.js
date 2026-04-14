/**
 * Ensemble Voter v4.0
 * Combines predictions from all 4 AI models
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
            predictions[predStick.nextGroup] += predStick.confidence * this.weights.stick;
        } else if (predStick && predStick.prediction === "SWITCH") {
            predictions[predStick.nextGroup] += predStick.nextGroupConfidence * this.weights.stick;
        }
        
        // AI-B (Extreme Switch)
        if (predExtreme && predExtreme.prediction === "CONTINUE") {
            const targetGroup = predExtreme.pattern.split("→")[1];
            predictions[targetGroup] += predExtreme.confidence * this.weights.extremeSwitch;
        } else if (predExtreme && predExtreme.prediction === "BREAK") {
            predictions[predExtreme.nextGroup] += predExtreme.nextGroupConfidence * this.weights.extremeSwitch;
        }
        
        // AI-C (Low-Mid Switch)
        if (predLowMid && predLowMid.prediction === "CONTINUE") {
            const targetGroup = predLowMid.pattern.split("→")[1];
            predictions[targetGroup] += predLowMid.confidence * this.weights.lowMidSwitch;
        } else if (predLowMid && predLowMid.prediction === "BREAK") {
            predictions[predLowMid.nextGroup] += predLowMid.nextGroupConfidence * this.weights.lowMidSwitch;
        }
        
        // AI-D (Mid-High Switch)
        if (predMidHigh && predMidHigh.prediction === "CONTINUE") {
            const targetGroup = predMidHigh.pattern.split("→")[1];
            predictions[targetGroup] += predMidHigh.confidence * this.weights.midHighSwitch;
        } else if (predMidHigh && predMidHigh.prediction === "BREAK") {
            predictions[predMidHigh.nextGroup] += predMidHigh.nextGroupConfidence * this.weights.midHighSwitch;
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
        
        // Count votes (simplified - which AI predicted which group)
        if (predStick && predStick.prediction === "STICK") voteCount[predStick.nextGroup]++;
        if (predStick && predStick.prediction === "SWITCH") voteCount[predStick.nextGroup]++;
        if (predExtreme && predExtreme.prediction === "CONTINUE") {
            const target = predExtreme.pattern.split("→")[1];
            voteCount[target]++;
        }
        if (predExtreme && predExtreme.prediction === "BREAK") voteCount[predExtreme.nextGroup]++;
        if (predLowMid && predLowMid.prediction === "CONTINUE") {
            const target = predLowMid.pattern.split("→")[1];
            voteCount[target]++;
        }
        if (predLowMid && predLowMid.prediction === "BREAK") voteCount[predLowMid.nextGroup]++;
        if (predMidHigh && predMidHigh.prediction === "CONTINUE") {
            const target = predMidHigh.pattern.split("→")[1];
            voteCount[target]++;
        }
        if (predMidHigh && predMidHigh.prediction === "BREAK") voteCount[predMidHigh.nextGroup]++;
        
        const agreement = Math.max(...Object.values(voteCount));
        const finalConfidence = Math.min(95, Math.round(finalScore));
        
        // Generate explanation
        let explanation = this.generateExplanation(finalGroup, agreement, voteCount, predStick, predExtreme, predLowMid, predMidHigh);
        
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
    
    generateExplanation(finalGroup, agreement, voteCount, predStick, predExtreme, predLowMid, predMidHigh) {
        let explanation = `🎯 ${agreement} out of 4 AI models predict ${finalGroup}. `;
        
        if (agreement === 4) {
            explanation = `🎯 All 4 AI models unanimously agree on ${finalGroup}! Very high confidence prediction.`;
        } else if (agreement === 3) {
            explanation = `⚡ Strong consensus: ${agreement} AI models predict ${finalGroup}. `;
        } else if (agreement === 2) {
            explanation = `⚖️ Split decision: ${agreement} AI models favor ${finalGroup}. `;
        } else {
            explanation = `🔄 All AI models disagree. Weighted voting selects ${finalGroup}. `;
        }
        
        // Add specific AI recommendations
        if (predStick && predStick.prediction === "STICK") {
            explanation += ` AI-A suggests ${predStick.nextGroup} will stick.`;
        } else if (predStick && predStick.prediction === "SWITCH") {
            explanation += ` AI-A predicts switch to ${predStick.nextGroup}.`;
        }
        
        return explanation;
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
    }
    
    saveWeights() {
        localStorage.setItem('ensemble_v4_weights', JSON.stringify(this.weights));
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
    
    getAccuracy() {
        return this.accuracy;
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
}

window.EnsembleVoterV4 = new EnsembleVoterV4();
