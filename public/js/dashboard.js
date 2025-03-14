const notificationContainer = document.querySelector('.pushNotifications');
notificationContainer.style.display = 'block';

function toggleSidebar() {
  const convo = document.querySelector('.convo');

  const sidebar = document.querySelector('.sidebar');
  sidebar.style.display = sidebar.style.display === 'block' ? 'none' : 'block';
}

const socket = io();

socket.on('connect', () => {
  console.log('Connected to the server');
});

socket.emit('register', () => {
  console.log('Registered with the server');
});

let publicKeyPem;
let privateKeyPem;

async function generateRSAKeys() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  publicKeyPem = await arrayBufferToPem(
    await window.crypto.subtle.exportKey('spki', keyPair.publicKey),
    'PUBLIC KEY'
  );
  privateKeyPem = await arrayBufferToPem(
    await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
    'PRIVATE KEY'
  );
}
if (!window.crypto || !window.crypto.subtle) {
  alert('Web Crypto API not supported');
}

function arrayBufferToPem(buffer, label) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const formattedKey = base64.match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${label}-----\n${formattedKey}\n-----END ${label}-----`;
}

async function initializeKeysAndLoadConversations() {
  await generateRSAKeys();

  const publicKey = publicKeyPem;
  const privateKey = privateKeyPem;

  loadConversations();
}

async function encryptWithRSA(data) {
  if (!publicKeyPem) {
    throw new Error('Public key is not generated. Call generateRSAKeys first.');
  }

  const publicKey = await importPublicKey(publicKeyPem);
  const encodedData = new TextEncoder().encode(data);

  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    encodedData
  );

  return arrayBufferToBase64(encryptedData);
}

async function importPublicKey(pem) {
  const binaryDer = pemToArrayBuffer(pem);
  return await window.crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
}

function pemToArrayBuffer(pem) {
  const base64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}

function arrayBufferToBase64(buffer) {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  return btoa(binary);
}

initializeKeysAndLoadConversations();

/*
                function generateRSAKeys() {
                  const key = new NodeRSA({ b: 2048 });

                  return {
                    publicKey: key.exportKey('pkcs8-public-pem'),
                    privateKey: key.exportKey('pkcs8-private-pem'),
                  };
                }


                const { publicKey, privateKey } = generateRSAKeys();
               */

function joinConversation() {
  const conversationId = globalConversationId;
  if (!conversationId) {
    alert('Please enter a conversation ID!');
    return;
  }

  socket.emit('joinConversation', conversationId);
  console.log(`Joined conversation: ${conversationId}`);
}

function encryptMessage(message, key) {
  return CryptoJS.AES.encrypt(message, key).toString();
}

function decryptMessage(cipherText, key) {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    return '[Decryption failed]';
  }
}

function decryptWithRSA(encryptedData, privateKey) {
  try {
    const key = new NodeRSA(privateKey, 'pkcs8-private-pem');
    return key.decrypt(encryptedData, 'utf8');
  } catch (err) {
    console.error('RSA decryption failed:', err.message);
    return null;
  }
}

const users = document.querySelectorAll('.user');
const newChatButton = document.querySelector('.newChat');
const chatSearch = document.querySelector('.chatSearch');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const searchResults = document.querySelector('.searchResults');
const userList = document.querySelector('.user-list');
const loadingIndicator = document.querySelector('.loading');
const messagesContainer = document.querySelector('.messages');
const convo = document.querySelector('.convo');

let page = 1;
const limit = 50;
let loading = false;
let hasMore = true;

let messagesPage = 1;
let hasMoreMessages = true;
let isLoading = false;

let globalDecryptedKey;
let globalMyId;
let globalConversationId;

function appendTextarea(conversationId) {
  const convo = document.querySelector('.convo');
  const inputArea = document.createElement('div');
  inputArea.classList.add('input-area');
  inputArea.innerHTML = `
                     <div style="display: flex; align-items: center; width: 100%; gap: 10px">
                      <input type="text" onkeydown="handleEnter(event)" id="messageInput" placeholder="Type a message..." />
                      <button onclick="sendMessage()">Send</button>
                     </div>
                    `;
  if (!convo.querySelector('.input-area')) {
    convo.appendChild(inputArea);
  }
}

function handleEnter(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

function formatTime(timestamp) {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffMs = now - messageTime;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'NOW';
  if (diffMinutes < 60)
    return `${diffMinutes} min${diffMinutes > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return messageTime.toLocaleDateString(); // Show full date for older messages
}

async function loadConversations() {
  console.log('Loading conversations...');
  if (loading || !hasMore) return;

  loading = true;
  loadingIndicator.style.display = 'block';

  try {
    const response = await fetch(`/convos?page=${page}&limit=${limit}`);
    const data = await response.json();

    loadingIndicator.style.display = 'none';

    if (data.length === 0) {
      hasMore = false;
      return;
    }

    await Promise.all(
      data.map(async (convo) => {
        const userDiv = createUserDiv(convo);
        userList.appendChild(userDiv);
      })
    );

    page++;
  } catch (error) {
    console.error('Error loading conversations:', error);
  } finally {
    loading = false;
  }
}

function createUserDiv(convo) {
  const userDiv = document.createElement('div');
  userDiv.classList.add('user');
  userDiv.dataset.id = convo.conversationId;

  fetchConversationKey(convo.conversationId, publicKeyPem).then((key) => {
    userDiv.innerHTML = `
        <div class="horiFlex">
          <div class="nameAndImage">
            <img class="userImg" src="${
              convo.otherUserImage
            }" alt="User Image" />
            <div class="lastMessageAndName">
              <span class="username">@${convo.otherUsername}</span>
              <p class="lastMessage">${decryptMessage(
                convo.lastMessage,
                key
              )}</p>
            </div>
          </div>
        </div>
        <div class="ago">
          <span class="time">${formatTime(convo.lastMessageTime)}</span>
        </div>
      `;

    userDiv.addEventListener('click', () => handleUserClick(userDiv, convo));
  });

  return userDiv;
}

function handleUserClick(userDiv, convo) {
  if (userDiv.classList.contains('active')) return;

  if (globalConversationId) {
    leaveConversation();
  }

  document
    .querySelectorAll('.user')
    .forEach((u) => u.classList.remove('active'));
  userDiv.classList.add('active');

  document.querySelector('.chat-header').innerHTML = `
    <div style="display:flex; align-items:center; gap:10px" >  <img src="${convo.otherUserImage}" alt="User Image" />
      <span class="username">@${convo.otherUsername}</span></div>
     <div style="display:flex; align-items:center; gap:10px"; flex-direction:row>  <p class="call" onClick="callUser('${convo.otherUserId}',false) ">📞</p>
      <p class="call" onClick="callUser('${convo.otherUserId}',true) ">🎥</p></div>
      
    `;

  globalConversationId = convo.conversationId;
  console.log('Switching to conversation:', globalConversationId);

  switchConversation(globalConversationId);
  joinConversation();
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  console.log(convo.otherUserId);
  appendTextarea(convo.conversationId);
}

function leaveConversation() {
  socket.emit('leaveConversation', globalConversationId);
  console.log(`Left conversation: ${globalConversationId}`);
}

// Scroll to load more conversations
userList.addEventListener('scroll', () => {
  if (
    userList.scrollTop + userList.clientHeight >=
    userList.scrollHeight - 50
  ) {
    loadConversations();
  }
});

const reactions = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😠',
};

function createActionButtons(msg, key) {
  const actionsDiv = document.createElement('div');
  actionsDiv.classList.add('message-actions');

  // Reply Button
  const replyBtn = document.createElement('div');
  replyBtn.classList.add('action-btn');
  replyBtn.textContent = '↩';

  replyBtn.addEventListener('click', () => {
    const messageInput = document.getElementById('messageInput');
    const inputArea = document.querySelector('.input-area');
    const existingPreview = document.querySelector('.reply-preview');

    if (existingPreview && existingPreview.dataset.id === msg._id) return;
    if (existingPreview) existingPreview.remove();

    const replyPreview = document.createElement('div');
    replyPreview.classList.add('reply-preview');
    replyPreview.dataset.id = msg._id;
    replyPreview.innerHTML = `
  <div class="replyFlex">
    <span class="username">@${msg.sender.username}</span>
    <span class="close-reply">❌</span>
  </div>
  <p>${decryptMessage(msg.text, key)}</p>
`;

    replyPreview.querySelector('.close-reply').addEventListener('click', () => {
      replyPreview.remove();
    });

    inputArea.prepend(replyPreview);
    messageInput.focus();
  });

  // Reaction Button
  const reactBtn = document.createElement('div');
  reactBtn.classList.add('action-btn');
  reactBtn.textContent = '☺';

  const reactionsContainer = document.createElement('div');
  reactionsContainer.classList.add('reactions-container');

  // Example reactions

  // Create reaction buttons
  for (const reaction in reactions) {
    const reactionBtn = document.createElement('div');
    reactionBtn.classList.add('reaction-btn');
    reactionBtn.textContent = reactions[reaction];

    // Handle reaction click
    // Handle reaction click
    reactionBtn.addEventListener('click', () => {
      reactBtn.textContent = reactions[reaction]; // Show emoji on button
      reactionsContainer.style.display = 'none'; // Hide container

      // Emit reaction name
      console.log('Selected reaction:', reaction); // Emit the reaction name
      console.log('Message ID:', msg._id);

      // Example: Emit through WebSocket or API
      socket.emit('reaction', { messageId: msg._id, reaction: reaction });
    });

    reactionsContainer.appendChild(reactionBtn);
  }

  // Toggle reactions visibility on click
  reactBtn.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent click from bubbling
    reactionsContainer.style.display =
      reactionsContainer.style.display === 'flex' ? 'none' : 'flex';
  });

  // Hide reactions container when clicking outside
  document.addEventListener('click', (event) => {
    if (
      !reactBtn.contains(event.target) &&
      !reactionsContainer.contains(event.target)
    ) {
      reactionsContainer.style.display = 'none';
    }
  });

  // Append elements
  actionsDiv.appendChild(replyBtn);
  actionsDiv.appendChild(reactBtn);
  actionsDiv.appendChild(reactionsContainer);

  return actionsDiv;
}

function addMessageToUI(msg, myId, key, fetching = true, rece = false) {
  if (!messagesContainer) {
    console.error('messagesContainer not found!');
    return;
  }

  const messageDiv = document.createElement('div');
  const messageContent = document.createElement('p');
  const actionsDiv = createActionButtons(msg, key);

  messageDiv.classList.add(
    'message',
    msg.sender?._id === myId ? 'sent' : 'received'
  );
  messageDiv.dataset.id = msg._id;

  messageContent.textContent =
    fetching || rece ? decryptMessage(msg.text, key) : msg.text;

  const actionAndMessage = document.createElement('div');
  actionAndMessage.classList.add('actionAndMessage');

  if (msg.replyingTo) {
    const replyPreviewDiv = document.createElement('div');
    replyPreviewDiv.classList.add('reply-preview-box');
    replyPreviewDiv.innerHTML = msg.replyingTo
      ? `<div class="reply-preview-content">
            <strong>${
              msg.replyingTo.sender?._id === myId
                ? 'You'
                : msg.replyingTo.sender?.username || 'Unknown'
            }</strong>
            ${decryptMessage(msg.replyingTo.text, key)}
          </div>`
      : `<div class="reply-preview-content"><strong>Replying to</strong>: [Message not found]</div>`;

    messageDiv.prepend(replyPreviewDiv);
  }

  if (messageDiv.classList.contains('sent')) {
    actionAndMessage.appendChild(actionsDiv);
    actionAndMessage.appendChild(messageContent);
  } else {
    actionAndMessage.appendChild(messageContent);
    actionAndMessage.appendChild(actionsDiv);
  }

  messageDiv.appendChild(actionAndMessage);

  if (rece) {
    messagesContainer.appendChild(messageDiv); // Append new messages
  } else {
    fetching
      ? messagesContainer.prepend(messageDiv) // Prepend fetched messages
      : messagesContainer.appendChild(messageDiv);
  }
}

async function fetchMessages(conversationId) {
  if (!hasMoreMessages || isLoading) return;

  isLoading = true;

  try {
    const key = await fetchConversationKey(conversationId, publicKeyPem);
    globalDecryptedKey = key;

    const res = await fetch(
      `/api/users/conversations/${conversationId}?page=${messagesPage}&limit=${limit}`
    );

    if (!res.ok) throw new Error(`Failed to fetch messages: ${res.statusText}`);

    const data = await res.json();
    const { conversation, myId, hasMoreMessages: more } = data;
    hasMoreMessages = more;
    globalMyId = myId;

    conversation.messages.forEach((msg) => addMessageToUI(msg, myId, key));

    messagesContainer.scrollTop =
      messagesPage === 1
        ? messagesContainer.scrollHeight
        : messagesContainer.scrollTop;
    messagesPage++;
  } catch (error) {
    console.error('Error fetching messages:', error);
  } finally {
    isLoading = false;
  }
}

socket.on('notification', async ({ sender, conversationId, message }) => {
  const key = await fetchConversationKey(conversationId, publicKeyPem);

  let nuMsg = decryptMessage(message, key);

  console.log(nuMsg);
  showNotification(sender, nuMsg, conversationId);
  updateConversationLastMessage(conversationId, nuMsg);
});

async function showNotification(sender, message, conversationId) {
  console.log(message);
  const notificationContainer = document.querySelector('.pushNotifications');

  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.innerHTML = `
      <div class="notification-content">
          <div class="notification-icon">
              <i class="fas fa-bell"></i>
          </div>
          <div class="notification-sender">${sender}</div>
          <div class="notification-text">
              <span class="notification-title">New Message</span>
              <span class="notification-message">${message}</span>
          </div>
      </div>
  `;

  // Show the notification
  notificationContainer.appendChild(notification);
  notificationContainer.style.display = 'block';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    notification.remove();
    if (notificationContainer.children.length === 0) {
      notificationContainer.style.display = 'none';
    }
  }, 3000);
}

async function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const rawMessage = messageInput.value.trim();

  if (!messageInput || !rawMessage) {
    alert('Message cannot be empty!');
    return;
  }

  try {
    const encryptedMessage = encryptMessage(rawMessage, globalDecryptedKey);
    const replyingTo = document.querySelector('.reply-preview');
    const messageId = replyingTo?.dataset.id;

    socket.emit('sendMessage', {
      conversationId: globalConversationId,
      message: encryptedMessage,
      replyingTo: messageId || undefined,
    });

    messageInput.value = '';
    if (replyingTo) replyingTo.remove();
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message. Please try again.');
  }
}

socket.on('messageSent', ({ newMessage, conversationId }) => {
  if (conversationId === globalConversationId) {
    addMessageToUI(newMessage, globalMyId, globalDecryptedKey, false, true);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
});

socket.on('receiveMessage', ({ newMessage, conversationId }) => {
  updateConversationLastMessage(
    conversationId,
    decryptMessage(newMessage.text, globalDecryptedKey)
  );
  if (conversationId === globalConversationId) {
    addMessageToUI(newMessage, globalMyId, globalDecryptedKey, false, true);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
});

function switchConversation(conversationId) {
  messagesContainer.innerHTML = '';
  messagesPage = 1;
  hasMoreMessages = true;
  fetchMessages(conversationId);
}

async function fetchConversationKey(convoId, publicKey) {
  try {
    const response = await fetch(`/api/users/get-conversation-key/${convoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch key: ${response.status}`);
    }

    const data = await response.json();

    console.log('Fetched conversation key:', data.encryptedKey);

    const decryptedKey = decryptWithRSA(data.encryptedKey, privateKeyPem);
    globalDecryptedKey = decryptedKey;
    console.log('active convo' + globalConversationId);
    return decryptedKey;
  } catch (err) {
    console.error('Error fetching conversation key:', err);
  }
}

messagesContainer.addEventListener('scroll', () => {
  if (messagesContainer.scrollTop === 0 && hasMoreMessages && !isLoading) {
    fetchMessages(document.querySelector('.user.active')?.dataset.id);
  }
});

function getActiveConversationId() {
  const activeUser = document.querySelector('.user.active');
  return activeUser ? activeUser.dataset.id : null;
}

messagesContainer.addEventListener('scroll', () => {
  if (messagesContainer.scrollTop === 0) {
    const conversationId = getActiveConversationId();

    // Save the current scroll position and height
    const oldScrollTop = messagesContainer.scrollTop;
    const oldHeight = messagesContainer.scrollHeight;

    // Disable scrolling

    fetchMessages(conversationId).then(() => {
      // Use setTimeout to wait for the rendering to finish
      setTimeout(() => {
        const newHeight = messagesContainer.scrollHeight;

        // Restore scroll position without any flicker
        messagesContainer.scrollTop = newHeight - oldHeight;

        // Re-enable scrolling
        messagesContainer.style.overflow = '';
      }, 0);
    });
  }
});

function updateConversationLastMessage(conversationId, message) {
  const userDiv = document.querySelector(`.user[data-id="${conversationId}"]`);
  if (userDiv) {
    userDiv.querySelector('.lastMessage').textContent = message;
  }
}

newChatButton.addEventListener('click', () => {
  chatSearch.style.display =
    chatSearch.style.display === 'none' ? 'block' : 'none';
  searchInput.focus();
});

searchButton.addEventListener('click', () => {
  const query = searchInput.value.trim();
  if (query) {
    searchUsers(query);
  } else {
    searchResults.innerHTML = '<div>Please enter a username to search.</div>';
  }
});

async function searchUsers(query) {
  try {
    const response = await fetch(`/api/users/search-users?query=${query}`);
    const users = await response.json();

    if (users.length === 0) {
      searchResults.innerHTML = '<div>No users found.</div>';
      return;
    }

    searchResults.innerHTML = users
      .map(
        (user) => `
                  <div data-id="${user.id}">
                    ${user.username}
                    <img src="${user.image}" alt="User Image" />
                  </div>
                `
      )
      .join('');
  } catch (error) {
    console.error('Error searching users:', error);
    searchResults.innerHTML =
      '<div>Error searching users. Try again later.</div>';
  }
}

searchResults.addEventListener('click', (e) => {
  if (e.target.dataset.id) {
    const userId = e.target.dataset.id;
    const username = e.target.innerText;

    startChat(userId, username);
    chatSearch.style.display = 'none';
    searchInput.value = '';
  }
});
