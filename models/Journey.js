const mongoose = require('mongoose');

const journeySchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required: true },
    shortDescription: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Journey', journeySchema);
