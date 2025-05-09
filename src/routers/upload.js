const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));  // Timestamp as filename
    }
});

// Function to dynamically handle file fields
const upload = (nodigit) => {
    const fields = [];

    // Dynamically create file fields based on nodigit value
    for (let i = 1; i <= nodigit; i++) {
        fields.push({ name: `file${i}`, maxCount: 1 });
    }

    return multer({
        storage: storage,
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB per file
        },
        fileFilter: (req, file, cb) => {
            const filetypes = /jpeg|jpg|png/;
            const mimetype = filetypes.test(file.mimetype);
            if (mimetype) {
                return cb(null, true);
            }
            cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
        }
    }).fields(fields);  // Use dynamically created fields
};

module.exports = upload;
