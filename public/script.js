// server.js - এই endpoint টি অন্যান্য endpoint এর সাথে যোগ করুন (app.get('/api/health') এর আগে)

app.post('/api/save-prediction', async (req, res) => {
    const { result_id, ai_stick_group, ai_extreme_group, ai_low_mid_group, ai_mid_high_group, ensemble_group, correct } = req.body;
    
    if (!result_id) {
        return res.status(400).json({ error: 'result_id required' });
    }
    
    // Check if prediction already exists
    db.get(`SELECT id FROM predictions WHERE result_id = ?`, [result_id], async (err, existing) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (existing) {
            return res.json({ success: true, message: 'Prediction already exists', exists: true });
        }
        
        db.run(`INSERT INTO predictions (result_id, ai_stick_group, ai_extreme_group, ai_low_mid_group, ai_mid_high_group, ensemble_group,
                correct_stick, correct_extreme, correct_low_mid, correct_mid_high, correct_ensemble, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [result_id, ai_stick_group, ai_extreme_group, ai_low_mid_group, ai_mid_high_group, ensemble_group,
             correct?.stick ? 1 : 0, correct?.extreme ? 1 : 0, correct?.low_mid ? 1 : 0, correct?.mid_high ? 1 : 0, correct?.ensemble ? 1 : 0, new Date().toISOString()],
            async (err) => {
                if (err) {
                    console.error('Error saving prediction:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                await updateAIStatsTable('AI_Stick', correct?.stick || false);
                await updateAIStatsTable('AI_ExtremeSwitch', correct?.extreme || false);
                await updateAIStatsTable('AI_LowMidSwitch', correct?.low_mid || false);
                await updateAIStatsTable('AI_MidHighSwitch', correct?.mid_high || false);
                await updateAIStatsTable('EnsembleVoter', correct?.ensemble || false);
                
                res.json({ success: true });
            }
        );
    });
});
