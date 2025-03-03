const socket = io();
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

const secretKey = process.env.SECRET_KEY;

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value) {
    const encryptedMsg = CryptoJS.AES.encrypt(
      input.value,
      secretKey
    ).toString();
    socket.emit('chat message', encryptedMsg);
    input.value = '';
  }
});

socket.on('chat message', (encryptedMsg) => {
  const decryptedMsg = CryptoJS.AES.decrypt(encryptedMsg, secretKey).toString(
    CryptoJS.enc.Utf8
  );
  const item = document.createElement('li');
  item.textContent = decryptedMsg || '[Decryption failed]';
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
});
