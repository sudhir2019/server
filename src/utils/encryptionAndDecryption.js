const CryptoJS = require("crypto-js"); // Import CryptoJS for encryption and decrypti
// Utility functions for encryption and decryption
const encrypt = (text) => {
  const secretKey = process.env.ENCRYPTION_KEY; // Store this in an environment variable for security
  return CryptoJS.AES.encrypt(text, secretKey).toString();
};

const decrypt = (ciphertext) => {
  const secretKey = process.env.ENCRYPTION_KEY; // Same key as encryption
  const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};

module.exports = { encrypt, decrypt }; // Export the encryption and decryption functions for use in other parts of the application
