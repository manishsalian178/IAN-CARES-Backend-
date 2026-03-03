const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    livesTouched: { type: String, default: "2,10,000" },
    clientRating: { type: String, default: "4.8" }
});

module.exports = mongoose.model('Settings', settingsSchema);
