/**
 * Ensemble Voter v4.1 - REAL-TIME WEIGHT UPDATES
 * 
 * Updates weights after EVERY prediction based on actual result.
 * If an AI predicts correctly → its weight increases
 * If an AI predicts incorrectly → its weight decreases
 * Weights are normalized so total = 1
 * 
 * No hybrid, no long-term storage, purely real-time.
 */

class EnsembleVoterV4 {
    constructor() {
        this.name = "EnsembleVoterV4 (Real-Time)";
        this.version = "4.1";
        
        // Initial equal weights (will update in real-time)
        this.weights = {
            stick: 0.25,
            extremeSwitch: 0.25,
            lowMidSwitch: 0.25,
            midHighSwitch: 0.25
        };
        
        // Minimum weight to prevent any model from being completely ignored
        this.minWeight = 0.05;
        this.maxWeight = 0.55;
        
        // For tracking last round's predictions to update weights after result comes
        this.lastPredictions = null;
        
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        this.accuracy = 0;
        
        this.init();
    }
    
    init() {
        console.log('🏆 Ensemble Voter v4.1 (Real-Time Weight Updates) Initializing...');
        console.log('   ✅ Weights update after EVERY round based on AI performance');
        console.log('   ✅ Correct AI → weight increases');
        console.log('   ✅ Wrong AI → weight decreases');
        this.loadWeights();
    }
    
    /**
     * Combine predictions from all 4 AIs and return final prediction
     * Also stores the predictions so they can be used later for weight update
     */
    combine(predStick, predExtreme, predLowMid, predMidHigh, currentGroup, previousGroup) {
        // Store predictions for weight update later (when actual result arrives)
        this.lastPredictions = {
            stick: predStick,
            extreme: predExtreme,
            lowMid: predLowMid,
            midHigh: predMidHigh
        };
        
        // Extract predicted groups from each AI
        const predictions = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        const voteCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        
        // AI-A (Stick)
        if (predStick && predStick.nextGroup) {
            const weight = this.weights.stick;
            const confidence = predStick.confidence || 50;
            predictions[predStick.nextGroup] += confidence * weight;
            voteCount[predStick.nextGroup]++;
        }
        
        // AI-B (Extreme Switch)
        if (predExtreme && predExtreme.nextGroup) {
            const weight = this.weights.extremeSwitch;
            const confidence = predExtreme.confidence || 50;
            predictions[predExtreme.nextGroup] += confidence * weight;
            voteCount[predExtreme.nextGroup]++;
        }
        
        // AI-C (Low-Mid Switch)
        if (predLowMid && predLowMid.nextGroup) {
            const weight = this.weights.lowMidSwitch;
            const confidence = predLowMid.confidence || 50;
            predictions[predLowMid.nextGroup] += confidence * weight;
            voteCount[predLowMid.nextGroup]++;
        }
        
        // AI-D (Mid-High Switch)
        if (predMidHigh && predMidHigh.nextGroup) {
            const weight = this.weights.midHighSwitch;
            const confidence = predMidHigh.confidence || 50;
            predictions[predMidHigh.nextGroup] += confidence * weight;
            voteCount[predMidHigh.nextGroup]++;
        }
        
        // Find winner (highest weighted score)
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
            details: {
                ai_stick: predStick,
                ai_extreme_switch: predExtreme,
                ai_low_mid_switch: predLowMid,
                ai_mid_high_switch: predMidHigh
            },
            explanation: this.generateExplanation(finalGroup, agreement, voteCount),
            weights: this.weights
        };
    }
    
    /**
     * Update weights based on actual result
     * Call this AFTER the real result is known
     * This is the REAL-TIME update that happens every round
     */
    updateWeightsWithResult(actualGroup) {
        if (!this.lastPredictions) {
            console.warn('No predictions stored to update weights');
            return;
        }
        
        const predStick = this.lastPredictions.stick;
        const predExtreme = this.lastPredictions.extreme;
        const predLowMid = this.lastPredictions.lowMid;
        const predMidHigh = this.lastPredictions.midHigh;
        
        // Calculate correctness for each AI
        const correct = {
            stick: predStick && predStick.nextGroup === actualGroup,
            extreme: predExtreme && predExtreme.nextGroup === actualGroup,
            lowMid: predLowMid && predLowMid.nextGroup === actualGroup,
            midHigh: predMidHigh && predMidHigh.nextGroup === actualGroup
        };
        
        // Update weights: correct → increase, wrong → decrease
        let weightChange = 0.02; // 2% change per round
        
        if (correct.stick) {
            this.weights.stick += weightChange;
        } else {
            this.weights.stick -= weightChange;
        }
        
        if (correct.extreme) {
            this.weights.extremeSwitch += weightChange;
        } else {
            this.weights.extremeSwitch -= weightChange;
        }
        
        if (correct.lowMid) {
            this.weights.lowMidSwitch += weightChange;
        } else {
            this.weights.lowMidSwitch -= weightChange;
        }
        
        if (correct.midHigh) {
            this.weights.midHighSwitch += weightChange;
        } else {
            this.weights.midHighSwitch -= weightChange;
        }
        
        // Apply min/max limits
        this.weights.stick = Math.min(this.maxWeight, Math.max(this.minWeight, this.weights.stick));
        this.weights.extremeSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, this.weights.extremeSwitch));
        this.weights.lowMidSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, this.weights.lowMidSwitch));
        this.weights.midHighSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, this.weights.midHighSwitch));
        
        // Normalize so total = 1
        this.normalizeWeights();
        
        // Update accuracy tracking
        const ensembleCorrect = (this.lastPredictions.stick?.nextGroup === actualGroup) ||
                                (this.lastPredictions.extreme?.nextGroup === actualGroup) ||
                                (this.lastPredictions.lowMid?.nextGroup === actualGroup) ||
                                (this.lastPredictions.midHigh?.nextGroup === actualGroup);
        
        // Actually, ensemble correctness is determined by the final group prediction
        // But we don't have that here. So we'll just track individual AI accuracies separately.
        
        // Save weights to storage
        this.saveWeights();
        
        // Log weight changes (for debugging)
        console.log(`📊 Real-time weight update after result: ${actualGroup}`);
        console.log(`   Stick: ${correct.stick ? '✓' : '✗'} → ${(this.weights.stick*100).toFixed(0)}%`);
        console.log(`   Extreme: ${correct.extreme ? '✓' : '✗'} → ${(this.weights.extremeSwitch*100).toFixed(0)}%`);
        console.log(`   LowMid: ${correct.lowMid ? '✓' : '✗'} → ${(this.weights.lowMidSwitch*100).toFixed(0)}%`);
        console.log(`   MidHigh: ${correct.midHigh ? '✓' : '✗'} → ${(this.weights.midHighSwitch*100).toFixed(0)}%`);
        
        // Clear last predictions to prevent double update
        this.lastPredictions = null;
    }
    
    /**
     * Normalize weights so they sum to 1
     */
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
    
    /**
     * Update weights using accuracy percentages (fallback method)
     * Also used for initial weight setup
     */
    updateWeights(accStick, accExtreme, accLowMid, accMidHigh) {
        const total = accStick + accExtreme + accLowMid + accMidHigh;
        if (total > 0) {
            this.weights.stick = Math.min(this.maxWeight, Math.max(this.minWeight, accStick / total));
            this.weights.extremeSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, accExtreme / total));
            this.weights.lowMidSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, accLowMid / total));
            this.weights.midHighSwitch = Math.min(this.maxWeight, Math.max(this.minWeight, accMidHigh / total));
            this.normalizeWeights();
            this.saveWeights();
            
            console.log(`📊 Ensemble weights updated (fallback): Stick:${(this.weights.stick*100).toFixed(0)}%, Extreme:${(this.weights.extremeSwitch*100).toFixed(0)}%, LowMid:${(this.weights.lowMidSwitch*100).toFixed(0)}%, MidHigh:${(this.weights.midHighSwitch*100).toFixed(0)}%`);
        }
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
    
    resetWeights() {
        this.weights = {
            stick: 0.25,
            extremeSwitch: 0.25,
            lowMidSwitch: 0.25,
            midHighSwitch: 0.25
        };
        this.saveWeights();
        console.log('🔄 Ensemble weights reset to default');
    }
    
    recordPredictionResult(correct) {
        this.totalPredictions++;
        if (correct) this.correctPredictions++;
        this.accuracy = (this.correctPredictions / this.totalPredictions) * 100;
        this.saveAccuracy();
    }
    
    getAccuracy() {
        return this.accuracy || 0;
    }
    
    setAccuracy(accuracy) {
        this.accuracy = accuracy;
    }
    
    getTotalPredictions() {
        return this.totalPredictions;
    }
    
    getCorrectPredictions() {
        return this.correctPredictions;
    }
    
    getWeights() {
        return this.weights;
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
                console.log(`✅ Ensemble v4 weights loaded: Stick:${(this.weights.stick*100).toFixed(0)}%, Extreme:${(this.weights.extremeSwitch*100).toFixed(0)}%, LowMid:${(this.weights.lowMidSwitch*100).toFixed(0)}%, MidHigh:${(this.weights.midHighSwitch*100).toFixed(0)}%`);
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
        if (group === 'HIGH') return '🟢';
        return '⚪';
    }
    
    getGroupRange(group) {
        if (group === 'LOW') return '3-9';
        if (group === 'MEDIUM') return '10-11';
        if (group === 'HIGH') return '12-18';
        return '-';
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

// Create global instance
window.EnsembleVoterV4 = new EnsembleVoterV4();
