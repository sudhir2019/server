// utils/loadJson.js
const fs = require('fs');
const path = require('path');

/**
 * Utility function to load and parse JSON file.
 * @param {string} filePath - The path to the JSON file.
 * @returns {object[]} - Parsed JSON data.
 */
const loadJson = (filePath) => {
  try {
    const data = fs.readFileSync(path.join(filePath), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error loading JSON file:", err.message);
    throw err;
  }
};

module.exports = loadJson;
