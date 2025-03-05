function appendTextarea(conversationId) {
  const convo = document.querySelector('.convo');
  const inputArea = document.createElement('div');
  inputArea.classList.add('input-area');
  inputArea.innerHTML = `
      <input type="text" onkeydown="handleEnter(event, '${conversationId}')" id="messageInput" placeholder="Type a message..." />
      <button onclick="sendMessage('${conversationId}')">Send</button>
    `;
  if (!convo.querySelector('.input-area')) {
    convo.appendChild(inputArea);
  }
}

function handleEnter(event, conversationId) {
  if (event.key === 'Enter') {
    sendMessage(conversationId);
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

newChatButton.addEventListener('click', () => {
  chatSearch.style.display =
    chatSearch.style.display === 'none' ? 'block' : 'none';
  searchInput.focus();
});

// Search users from the backend (only on button click)
searchButton.addEventListener('click', () => {
  const query = searchInput.value.trim();
  if (query) {
    searchUsers(query);
  } else {
    searchResults.innerHTML = '<div>Please enter a username to search.</div>';
  }
});

// Fetch users from the server
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

// Start chat when a user is clicked
searchResults.addEventListener('click', (e) => {
  if (e.target.dataset.id) {
    const userId = e.target.dataset.id;
    const username = e.target.innerText;

    startChat(userId, username);
    chatSearch.style.display = 'none';
    searchInput.value = '';
  }
});

async function sendMessage(conversationId) {
  const messageInput = document.getElementById('messageInput');

  if (!messageInput) {
    console.error('Message input field not found!');
    return;
  }

  const message = messageInput.value.trim();
  console.log('Sending message:', message);

  if (!message) {
    alert('Message cannot be empty!');
    return;
  }

  try {
    const res = await fetch(`/api/users/send-message/${conversationId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      throw new Error('Failed to send message');
    }

    const newMessage = await res.json();

    messageInput.value = '';

    const messagesContainer = document.querySelector('.messages');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'sent');
    messageDiv.textContent = newMessage.text;
    messagesContainer.appendChild(messageDiv);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message. Please try again.');
  }
}
