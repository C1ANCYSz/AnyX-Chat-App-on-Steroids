async function getPrivateKey() {
  try {
    const response = await fetch('/api/users/get-private-key');
    const data = await response.json();
    return data.key;
  } catch (err) {
    console.error('Failed to fetch private key:', err);
  }
}

async function fetchConversationKey(convoId, privateKey) {
  try {
    const response = await fetch(`/api/users/get-conversation-key/${convoId}`);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch conversation key: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log('Fetched conversation key:', data);

    if (data.key) {
      const decryptor = new JSEncrypt();
      decryptor.setPrivateKey(privateKey.trim());

      const decryptedKey = decryptor.decrypt(data.key);

      if (decryptedKey) {
        console.log('Decrypted key:', decryptedKey);
        return decryptedKey;
      } else {
        console.error(
          'Decryption failed — possibly due to incorrect key format or encryption issues'
        );
      }
    } else {
      console.warn('No key returned from API');
    }
  } catch (err) {
    console.error('Failed to fetch or decrypt conversation key:', err);
  }
}

function encryptMessage(message) {
  return CryptoJS.AES.encrypt(message, secretKey).toString();
}

// Function to decrypt message
function decryptMessage(cipherText) {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    return '[Decryption failed]';
  }
}
