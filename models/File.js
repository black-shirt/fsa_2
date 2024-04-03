const mongoose = require("mongoose")

const File = mongoose.Schema({
    path: {
        type: [String],
        required: true
    },
    originalName: {
        type: [String],
        required: true
    },
    password: String,
    downloadCount: {
        type: Number,
        required: true,
        default: 0
    },
    maxDownloads: {
        type: Number,
        default: 1  // 1 download
    },
    expirationDate: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 *60 * 1000) // 1 day
    }
})

module.exports = mongoose.model("File", File)