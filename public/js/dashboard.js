const elements = {
  notificationContainer: document.querySelector('.pushNotifications'),
  sidebar: document.querySelector('.sidebar'),
  convo: document.querySelector('.convo'),
  userList: document.querySelector('.user-list'),
  messagesContainer: document.querySelector('.messages'),
  loadingIndicator: document.querySelector('.loading'),
  newChatButton: document.querySelector('.newChat'),
  chatSearch: document.querySelector('.chatSearch'),
  searchInput: document.getElementById('searchInput'),
  searchButton: document.getElementById('searchButton'),
  searchResults: document.querySelector('.searchResults'),
  notificationContainer: document.querySelector('.pushNotifications'),
};

const state = {
  page: 1,
  limit: 50,
  loading: false,
  hasMore: true,
  messagesPage: 1,
  hasMoreMessages: true,
  isLoading: false,
  globalConversationId: null,
  globalDecryptedKey: null,
  globalMyId: null,
  publicKeyPem: null,
  privateKeyPem: null,
};

const reactions = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😠',
};

const socket = io();

socket.on('connect', () => {
  console.log('Connected to the server');
});

socket.emit('register', () => {
  console.log('Registered with the server');
});

elements.notificationContainer.style.display = 'block';

function toggleSidebar() {
  const sidebar = elements.sidebar;
  sidebar.classList.toggle('open');
}

async function generateRSAKeys() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );

  state.publicKeyPem = await arrayBufferToPem(
    await window.crypto.subtle.exportKey('spki', keyPair.publicKey),
    'PUBLIC KEY',
  );
  state.privateKeyPem = await arrayBufferToPem(
    await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
    'PRIVATE KEY',
  );
}

function arrayBufferToPem(buffer, label) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const formattedKey = base64.match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${label}-----\n${formattedKey}\n-----END ${label}-----`;
}

async function initializeKeysAndLoadConversations() {
  await generateRSAKeys();

  loadConversations();
}

async function encryptWithRSA(data) {
  if (!state.publicKeyPem) {
    throw new Error('Public key is not generated. Call generateRSAKeys first.');
  }

  const publicKey = await importPublicKey(state.publicKeyPem);
  const encodedData = new TextEncoder().encode(data);

  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    encodedData,
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
    ['encrypt'],
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
  const conversationId = state.globalConversationId;
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

function appendTextarea(conversationId) {
  const convo = elements.convo;
  const inputArea = document.createElement('div');
  inputArea.classList.add('input-area');
  inputArea.innerHTML = `
    <div style="display: flex; align-items: center; width: 100%; gap: 10px">
      <input type="text" onkeydown="handleEnter(event)" id="messageInput" placeholder="Type a message..." oninput="toggleSendButton()" />
      <button id="sendMessageBtn" onclick="sendMessage()" style="display: none;"><i class='bx bxs-send sendIcons'></i></button>
      <button id="sendVoiceMessageBtn" onclick="toggleVoiceRecording('${conversationId}')"><i class='bx bxs-microphone-alt sendIcons' style='color:#ffffff' ></i></button>
      <button onclick="sendMedia()"><i class='bx bx-images sendIcons'></i></button>
    </div>
  `;

  if (!convo.querySelector('.input-area')) {
    convo.appendChild(inputArea);
  }

  inputArea.addEventListener('input', () => {
    socket.emit('typing', { conversationId, userId: socket.id });
  });
}

socket.on('typing', ({ conversationId, userId }) => {
  if (conversationId !== state.globalConversationId) return; // Ignore if not in the same conversation

  const typingIndicator = document.getElementById('typingIndicator');
  if (!typingIndicator) {
    const indicator = document.createElement('div');
    indicator.id = 'typingIndicator';
    indicator.innerHTML = '<span>.</span><span>.</span><span>.</span>';
    indicator.style.fontWeight = '800';
    indicator.style.height = '25px';
    indicator.style.width = '30px';
    indicator.style.padding = '10px';
    indicator.style.borderRadius = '8px 8px 8px 0';
    indicator.style.textAlign = 'center';
    indicator.style.backgroundColor = 'white';

    indicator.style.color = 'black';
    indicator.style.marginTop = '5px';
    const spans = indicator.querySelectorAll('span');
    spans.forEach((dot, index) => {
      dot.style.animation = `jump 1.5s infinite`;
      dot.style.animationDelay = `${index * 0.2}s`; // Staggered animation
    });
    elements.messagesContainer.scrollTop =
      elements.messagesContainer.scrollHeight;
    document.querySelector('.messages').appendChild(indicator);
  }

  // Remove typing indicator after 3 seconds of no typing activity
  clearTimeout(window.typingTimeout);
  window.typingTimeout = setTimeout(() => {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
  }, 500);
});

function sendMedia() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*, video/*'; // Accept images and videos

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];

    if (!file) {
      console.warn('No file selected');
      return;
    }

    console.log('Selected file:', file);

    // Prepare form data to send to the server
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'your_upload_preset'); // Cloudinary preset (set this in Cloudinary)

    try {
      // Send the file to your server (which will then upload it to Cloudinary)
      const response = await fetch(
        `/api/users/conversations/${state.globalConversationId}/upload-media`,
        {
          method: 'POST',
          body: formData,
        },
      );

      const data = await response.json();

      if (data.secure_url) {
        console.log('Media uploaded successfully:', data.secure_url);
        const replyingTo = document.querySelector('.reply-preview');
        const messageId = replyingTo?.dataset.id;
        // Notify other users via WebSocket
        socket.emit('sendMessage', {
          conversationId: state.globalConversationId,
          replyingTo: messageId || undefined,
          message: data.secure_url,
          type: 'image',
        });

        console.log('Media sent via socket.');
      } else {
        console.error('Error uploading media:', data);
      }
    } catch (error) {
      console.error('Error sending media:', error);
    }
  });

  fileInput.click(); // Trigger the file picker
}

function toggleSendButton() {
  const messageInput = document.getElementById('messageInput');
  const sendMessageBtn = document.getElementById('sendMessageBtn');
  const sendVoiceMessageBtn = document.getElementById('sendVoiceMessageBtn');

  if (messageInput.value.trim() === '') {
    sendMessageBtn.style.display = 'none';
    sendVoiceMessageBtn.style.display = 'inline-block';
  } else {
    sendMessageBtn.style.display = 'inline-block';
    sendVoiceMessageBtn.style.display = 'none';
  }
}

function handleEnter(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
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
  if (state.loading || !state.hasMore) return;

  state.loading = true;
  elements.loadingIndicator.style.display = 'block';

  try {
    const response = await fetch(
      `/convos?page=${state.page}&limit=${state.limit}`,
    );
    const data = await response.json();

    elements.loadingIndicator.style.display = 'none';

    if (data.length === 0) {
      hasMore = false;
      return;
    }

    await Promise.all(
      data.map(async (convo) => {
        const userDiv = await createUserDiv(convo);
        console.log(convo);
        elements.userList.appendChild(userDiv);
      }),
    );

    state.page++;
  } catch (error) {
    console.error('Error loading conversations:', error);
  } finally {
    loading = false;
  }
}

async function createUserDiv(convo) {
  const userDiv = document.createElement('div');
  userDiv.classList.add('user');
  userDiv.dataset.id = convo.conversationId;

  let lastMessageText = 'Unknown Message Type';

  const key = await fetchConversationKey(
    convo.conversationId,
    state.publicKeyPem,
  );
  console.log(key);

  if (convo.lastMessage?.type === 'text') {
    lastMessageText = decryptMessage(convo.lastMessage.text, key);
  } else if (convo.lastMessage?.type === 'voice') {
    lastMessageText = 'Voice Message';
  } else if (convo.lastMessage?.type === 'image') {
    lastMessageText = 'Image';
  }

  fetchConversationKey(convo.conversationId, state.publicKeyPem).then((key) => {
    userDiv.innerHTML = `
  <div class="horiFlex">
    <div class="nameAndImage">
      <img class="userImg" src="${convo.otherUserImage}" alt="User Image" />
      <div class="lastMessageAndName">
        <span class="username">@${convo.otherUsername}</span>
        <p class="lastMessage">${lastMessageText}</p>
      </div>
    </div>
  </div>
  <div class="ago">
    <span class="time" data-timestamp="${convo.lastMessageTime}">
      ${formatTime(convo.lastMessageTime)}
    </span>
  </div>
`;

    userDiv.addEventListener('click', () => handleUserClick(userDiv, convo));
  });

  return userDiv;
}

function handleUserClick(userDiv, convo) {
  if (userDiv.classList.contains('active')) return;

  if (state.globalConversationId) {
    leaveConversation();
  }

  document
    .querySelectorAll('.user')
    .forEach((u) => u.classList.remove('active'));
  userDiv.classList.add('active');
  const chatHeader = document.querySelector('.chat-header');
  chatHeader.style.display = 'flex';
  chatHeader.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-left:40px" >
      <img src="${convo.otherUserImage}" alt="User Image" />
      <span class="username">@${convo.otherUsername}</span></div>
     <div style="display:flex; align-items:center; gap:10px"; flex-direction:row>
       <p class="call" onClick="startCall('${convo.conversationId}',false) "><i class='bx bxs-phone-call sendIcons callIcons'  style='color:#fff'></i></p>
      <p class="call" onClick="startCall('${convo.conversationId}',true) "><i class='bx bxs-video sendIcons callIcons' style='color:#fff' ></i></p>
      </div>
      
    `;

  state.globalConversationId = convo.conversationId;
  console.log('Switching to conversation:', state.globalConversationId);

  switchConversation(state.globalConversationId);
  joinConversation();
  elements.messagesContainer.scrollTop =
    elements.messagesContainer.scrollHeight;
  console.log(convo.otherUserId);
  appendTextarea(convo.conversationId);
}

function leaveConversation() {
  socket.emit('leaveConversation', state.globalConversationId);
  console.log(`Left conversation: ${state.globalConversationId}`);
}

// Scroll to load more conversations
elements.userList.addEventListener('scroll', () => {
  if (
    elements.userList.scrollTop + elements.userList.clientHeight >=
    elements.userList.scrollHeight - 50
  ) {
    loadConversations();
  }
});

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
  <p>${msg.type === 'text' ? decryptMessage(msg.text, key) : msg.type === 'image' ? 'Image' : 'Voice Message'}</p>
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
  if (!elements.messagesContainer) {
    console.error('messagesContainer not found!');
    return;
  }

  const messageDiv = document.createElement('div');
  messageDiv.classList.add(
    'message',
    msg.sender?._id === myId ? 'sent' : 'received',
  );
  messageDiv.dataset.id = msg._id;

  const actionAndMessage = document.createElement('div');
  actionAndMessage.classList.add('actionAndMessage');

  const actionsDiv = createActionButtons(msg, key);

  // Handle replies
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

  // Handle different message types
  let messageContent;
  if (msg.type === 'text') {
    messageContent = document.createElement('p');
    messageContent.textContent =
      fetching || rece ? decryptMessage(msg.text, key) : msg.text;
  } else if (msg.type === 'voice') {
    messageContent = createCustomVoiceMessageElement(
      msg,
      msg.sender?._id === myId,
    );
  } else if (msg.type === 'image') {
    messageContent = document.createElement('img');
    messageContent.src = msg.text; // Assuming `msg.text` is a Base64 or URL
    messageContent.style.maxWidth = '250px'; // Adjust size
    messageContent.style.borderRadius = '8px';
    messageContent.style.border =
      msg.sender?._id === myId
        ? '1px solid rebeccapurple'
        : '1px solid lightgray';
    messageContent.alt = 'Image Message';
    messageContent.style.cursor = 'pointer';
    messageContent.addEventListener('click', () => showImagePreview(msg.text));
  } else {
    messageContent = document.createElement('p');
    messageContent.textContent = '[Unsupported message type]';
  }

  // Append message content and actions
  if (messageDiv.classList.contains('sent')) {
    actionAndMessage.appendChild(actionsDiv);
    actionAndMessage.appendChild(messageContent);
  } else {
    actionAndMessage.appendChild(messageContent);
    actionAndMessage.appendChild(actionsDiv);
  }

  messageDiv.appendChild(actionAndMessage);

  // Add message to the container
  if (rece) {
    elements.messagesContainer.appendChild(messageDiv);
  } else {
    fetching
      ? elements.messagesContainer.prepend(messageDiv)
      : elements.messagesContainer.appendChild(messageDiv);
  }
}
function showImagePreview(imageSrc) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; // Dark background
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '1000';

  // Create full-screen image
  const image = document.createElement('img');
  image.src = imageSrc;
  image.style.maxWidth = '90vw';
  image.style.maxHeight = '90vh';
  image.style.borderRadius = '10px';
  image.style.boxShadow = '0px 0px 20px rgba(255, 255, 255, 0.3)';

  // Close image on click
  overlay.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  overlay.appendChild(image);
  document.body.appendChild(overlay);
}

function createCustomVoiceMessageElement(msg, isMine) {
  const messageWrapper = document.createElement('div');
  messageWrapper.classList.add('voice-message');

  // Styling for sender vs receiver
  messageWrapper.style.backgroundColor = isMine ? 'rebeccapurple' : 'white';
  messageWrapper.style.color = isMine ? 'white' : 'black';
  messageWrapper.style.padding = '10px';
  messageWrapper.style.borderRadius = '10px';
  messageWrapper.style.margin = '5px 0';
  messageWrapper.style.display = 'flex';
  messageWrapper.style.alignItems = 'center';
  messageWrapper.style.maxWidth = '250px';
  messageWrapper.style.gap = '10px';

  // Play/Pause Button
  const playPauseButton = document.createElement('button');
  playPauseButton.innerHTML = `<i class='bx bx-play'></i>`; // Play icon
  playPauseButton.style.border = 'none';
  playPauseButton.style.background = 'transparent';
  playPauseButton.style.cursor = 'pointer';
  playPauseButton.style.fontSize = '20px';

  // Progress Bar
  const progressBar = document.createElement('div');
  progressBar.style.height = '5px';
  progressBar.style.width = '100px';
  progressBar.style.backgroundColor = isMine ? 'white' : 'lightgray';
  progressBar.style.borderRadius = '3px';
  progressBar.style.position = 'relative';

  // Progress Indicator
  const progressIndicator = document.createElement('div');
  progressIndicator.style.height = '100%';
  progressIndicator.style.width = '0%';
  progressIndicator.style.backgroundColor = isMine ? 'blue' : 'black';
  progressIndicator.style.borderRadius = '3px';
  progressIndicator.style.position = 'absolute';

  progressBar.appendChild(progressIndicator);

  // Timer
  const timer = document.createElement('span');
  timer.textContent = '0:00';
  timer.style.fontSize = '12px';

  // Hidden Audio Element
  const audio = new Audio();
  audio.src = `data:audio/webm;base64,${msg.text}`;

  // Event Listeners for Play/Pause
  playPauseButton.addEventListener('click', () => {
    if (audio.paused) {
      audio.play();
      playPauseButton.innerHTML = `<i class='bx bx-pause' style='color:#ffffff' ></i>`; // Pause icon
    } else {
      audio.pause();
      playPauseButton.innerHTML = `<i class='bx bx-play'></i>`;
    }
  });

  // Update Progress Bar
  audio.addEventListener('timeupdate', () => {
    const progress = (audio.currentTime / audio.duration) * 100;
    progressIndicator.style.width = `${progress}%`;
    timer.textContent = formatTime(audio.currentTime);
  });

  // Reset when audio ends
  audio.addEventListener('ended', () => {
    playPauseButton.innerHTML = `<i class='bx bx-play'></i>`;
    progressIndicator.style.width = '0%';
    timer.textContent = '0:00';
  });

  // Format Time (Helper Function)
  function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  messageWrapper.appendChild(playPauseButton);
  messageWrapper.appendChild(progressBar);
  messageWrapper.appendChild(timer);

  return messageWrapper;
}

async function fetchMessages(conversationId) {
  if (!state.hasMoreMessages || state.isLoading) return;

  state.isLoading = true;

  try {
    const key = await fetchConversationKey(conversationId, state.publicKeyPem);
    state.globalDecryptedKey = key;

    const res = await fetch(
      `/api/users/conversations/${conversationId}?page=${state.messagesPage}&limit=${state.limit}`,
    );

    if (!res.ok) throw new Error(`Failed to fetch messages: ${res.statusText}`);

    const data = await res.json();
    const { conversation, myId, hasMoreMessages: more } = data;
    state.hasMoreMessages = more;
    state.globalMyId = myId;

    conversation.messages.forEach((msg) => addMessageToUI(msg, myId, key));

    elements.messagesContainer.scrollTop =
      state.messagesPage === 1
        ? elements.messagesContainer.scrollHeight
        : elements.messagesContainer.scrollTop;
    state.messagesPage++;
  } catch (error) {
    console.error('Error fetching messages:', error);
  } finally {
    state.isLoading = false;
  }
}

socket.on('notification', async ({ sender, conversationId, message }) => {
  const key = await fetchConversationKey(conversationId, state.publicKeyPem);

  if (state.globalConversationId !== conversationId) {
    showNotification(sender, message, conversationId);
  }
  updateConversationLastMessage(conversationId, message);
});

async function showNotification(sender, message, conversationId) {
  console.log(message);
  const notificationContainer = elements.notificationContainer;
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
             <span class="notification-message">
  ${
    message.type === 'text'
      ? decryptMessage(message.text, state.globalDecryptedKey)
      : message.type === 'image'
        ? 'Image'
        : message.type === 'voice'
          ? 'Voice Message'
          : ''
  }
</span>

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
    const encryptedMessage = encryptMessage(
      rawMessage,
      state.globalDecryptedKey,
    );
    const replyingTo = document.querySelector('.reply-preview');
    const messageId = replyingTo?.dataset.id;

    socket.emit('sendMessage', {
      conversationId: state.globalConversationId,
      message: encryptedMessage,
      replyingTo: messageId || undefined,
      type: 'text',
    });

    messageInput.value = '';
    toggleSendButton();
    if (replyingTo) replyingTo.remove();
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message. Please try again.');
  }
}

socket.on('messageSent', ({ newMessage, conversationId }) => {
  if (conversationId === state.globalConversationId) {
    addMessageToUI(
      newMessage,
      state.globalMyId,
      state.globalDecryptedKey,
      false,
      true,
    );
    elements.messagesContainer.scrollTop =
      elements.messagesContainer.scrollHeight;
  }
});

socket.on('receiveMessage', ({ newMessage, conversationId }) => {
  updateConversationLastMessage(conversationId, newMessage);
  if (conversationId === state.globalConversationId) {
    addMessageToUI(
      newMessage,
      state.globalMyId,
      state.globalDecryptedKey,
      false,
      true,
    );
    elements.messagesContainer.scrollTop =
      elements.messagesContainer.scrollHeight;
  }
  if (document.getElementById('typingIndicator')) {
    document.getElementById('typingIndicator').remove();
  }
});

function switchConversation(conversationId) {
  elements.messagesContainer.innerHTML = '';
  state.messagesPage = 1;
  state.hasMoreMessages = true;
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

    const decryptedKey = decryptWithRSA(data.encryptedKey, state.privateKeyPem);
    state.globalDecryptedKey = decryptedKey;
    console.log('active convo' + state.globalConversationId);
    return decryptedKey;
  } catch (err) {
    console.error('Error fetching conversation key:', err);
  }
}

elements.messagesContainer.addEventListener('scroll', () => {
  if (
    elements.messagesContainer.scrollTop === 0 &&
    state.hasMoreMessages &&
    !state.isLoading
  ) {
    fetchMessages(document.querySelector('.user.active')?.dataset.id);
  }
});

function getActiveConversationId() {
  const activeUser = document.querySelector('.user.active');
  return activeUser ? activeUser.dataset.id : null;
}

elements.messagesContainer.addEventListener('scroll', () => {
  if (elements.messagesContainer.scrollTop === 0) {
    const conversationId = getActiveConversationId();

    // Save the current scroll position and height
    const oldScrollTop = elements.messagesContainer.scrollTop;
    const oldHeight = elements.messagesContainer.scrollHeight;

    // Disable scrolling

    fetchMessages(conversationId).then(() => {
      // Use setTimeout to wait for the rendering to finish
      setTimeout(() => {
        const newHeight = elements.messagesContainer.scrollHeight;

        // Restore scroll position without any flicker
        elements.messagesContainer.scrollTop = newHeight - oldHeight;

        // Re-enable scrolling
        elements.messagesContainer.style.overflow = '';
      }, 0);
    });
  }
});

function updateConversationLastMessage(conversationId, message) {
  const userDiv = document.querySelector(`.user[data-id="${conversationId}"]`);
  if (userDiv) {
    if (message.type === 'text') {
      userDiv.querySelector('.lastMessage').textContent = decryptMessage(
        message.text,
        state.globalDecryptedKey,
      );
    } else if (message.type === 'voice') {
      userDiv.querySelector('.lastMessage').textContent = 'Voice Message';
    } else if (message.type === 'image') {
      userDiv.querySelector('.lastMessage').textContent = 'Image';
    }

    const timeElement = userDiv.querySelector('.ago .time');
    const messageTime = timeElement?.dataset.timestamp;
    if (timeElement) {
      const formattedTimestamp = new Date(messageTime).toISOString(); // Ensure correct ISO 8601 format
      timeElement.dataset.timestamp = formattedTimestamp; // Store as ISO 8601
      timeElement.textContent = formatTime(
        Date.now() - new Date(messageTime).getTime(),
      );
    }
  }
}

function updateTimeAgo() {
  document.querySelectorAll('.ago .time').forEach((timeElement) => {
    const timestampStr = timeElement.dataset.timestamp;
    if (!timestampStr) return;

    const timestampMs = new Date(timestampStr).getTime(); // Convert ISO 8601 to milliseconds
    if (isNaN(timestampMs)) return; // Prevent invalid timestamps

    const elapsedTime = Date.now() - timestampMs;
    timeElement.textContent = formatTime(elapsedTime);
  });
}

setInterval(updateTimeAgo, 60000); // Update every minute

elements.newChatButton.addEventListener('click', () => {
  elements.chatSearch.style.display =
    elements.chatSearch.style.display === 'none' ? 'block' : 'none';
  elements.searchInput.focus();
});

elements.searchButton.addEventListener('click', () => {
  const query = elements.searchInput.value.trim();
  if (query) {
    searchUsers(query);
  } else {
    elements.searchResults.innerHTML =
      '<div>Please enter a username to search.</div>';
  }
});

async function searchUsers(query) {
  try {
    const response = await fetch(`/api/users/search-users?query=${query}`);
    const users = await response.json();

    if (users.length === 0) {
      elements.searchResults.innerHTML = '<div>No users found.</div>';
      return;
    }

    elements.searchResults.innerHTML = users
      .map(
        (user) => `
                  <div data-id="${user.id}">
                    ${user.username}
                    <img src="${user.image}" alt="User Image" />
                  </div>
                `,
      )
      .join('');
  } catch (error) {
    console.error('Error searching users:', error);
    elements.searchResults.innerHTML =
      '<div>Error searching users. Try again later.</div>';
  }
}

elements.searchResults.addEventListener('click', (e) => {
  if (e.target.dataset.id) {
    const userId = e.target.dataset.id;
    const username = e.target.innerText;

    startChat(userId, username);
    chatSearch.style.display = 'none';
    searchInput.value = '';
  }
});
