const mongoose = require('mongoose');
const crypto = require('crypto');
const NodeRSA = require('node-rsa');
const fs = require('fs');
const publicKey = fs.readFileSync('./keys/public.pem', 'utf8');

const conversationSchema = new mongoose.Schema({
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  key: { type: String },
});

function decryptWithRSA(encryptedData, privateKey) {
  try {
    const key = new NodeRSA(privateKey, 'pkcs8-private-pem');
    return key.decrypt(encryptedData, 'utf8');
  } catch (err) {
    console.error('RSA decryption failed:', err.message);
    return null;
  }
}

// RSA encryption
function encryptWithRSA(data, publicKey) {
  try {
    const key = new NodeRSA(publicKey, 'pkcs8-public-pem');
    return key.encrypt(data, 'base64');
  } catch (err) {
    console.error('RSA encryption failed:', err.message);
    return null;
  }
}
conversationSchema.pre('save', function (next) {
  if (this.isNew && !this.key) {
    const aesKey = crypto.randomBytes(32).toString('base64');

    this.key = encryptWithRSA(aesKey, publicKey);
  }
  next();
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
