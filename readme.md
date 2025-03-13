# Chat Application Documentation

## 🚀 Project Overview

This is a **secure chat application** built with the **MEN stack** (MongoDB, Express.js, Node.js) and **Socket.IO** for real-time communication. It supports encrypted messaging using **RSA** for key exchange and **AES** for message encryption.

## 🛠️ Features

- **User Authentication:** Signup, login, logout, and email verification.
- **Password Recovery:** Forgot and reset password functionality.
- **Real-Time Messaging:** Send and receive messages instantly with **Socket.IO**.
- **End-to-End Encryption:** AES encryption for messages, with RSA key exchange.
- **Conversations:** Users can join, leave, and switch between conversations.
- **Reactions & Replies:** React to messages and reply inline.
- **Search & Notifications:** Search for users and receive live message notifications.
- **Audio Calls:** Peer-to-peer call functionality using WebRTC.

## 🏗️ Project Structure

```
├── controllers
│   ├── authControllers.js    # Handles authentication logic
│   └── userControllers.js    # Manages user and conversation operations
├── models
│   ├── User.js               # User schema
│   ├── Message.js            # Message schema
│   └── Conversation.js       # Conversation schema
├── routes
│   └── userRoutes.js         # User and conversation routes
├── views
│   └── dashboard.ejs         # Chat app frontend (UI)
├── ssl                      # SSL certificates for HTTPS
├── .env                     # Environment variables
└── server.js                # Main server file
```

## 📜 API Routes

### Auth Routes

- `POST /signup`: Register a new user.
- `POST /login`: Authenticate and log in a user.
- `POST /logout`: Log out the current user.
- `POST /verify-email`: Verify user email.
- `POST /forgot-password`: Send a password reset link.
- `POST /reset-password/:token`: Reset password with token.

### Conversation & Message Routes

- `GET /search-users`: Search for users (requires login & verification).
- `GET /conversations/:id`: Get messages in a conversation.
- `POST /send-message/:id`: Send a message in a conversation.
- `POST /get-conversation-key/:id`: Retrieve the conversation key (for decryption).

## ⚡ WebSocket Events

- `register`: Register a user’s socket connection.
- `joinConversation`: Join a chat room.
- `leaveConversation`: Leave a chat room.
- `sendMessage`: Send a new message.
- `receiveMessage`: Receive a new message in real time.
- `notification`: Receive live notifications.
- `offer`, `answer`, `candidate`: Handle WebRTC calls.

## 🛠️ Setup and Installation

1. **Clone the repository:**

```bash
git clone https://github.com/your-repo/chat-app.git
cd chat-app
```

2. **Install dependencies:**

```bash
npm install
```

3. **Generate SSL certificates (for HTTPS):**

```bash
mkdir ssl
cd ssl
openssl req -nodes -new -x509 -keyout server.key -out server.cert
```

4. **Set up environment variables:** (create a `.env` file)

```
PORT=3000
MONGO_URI=your-mongodb-uri
JWT_SECRET=your-jwt-secret
```

5. **Run the server:**

```bash
npm start
```

6. **Access the app:**
   Go to `https://localhost:3000` in your browser.

## 📚 How It Works

- On login, users generate an RSA key pair.
- When starting a conversation, the server encrypts a unique AES key with each user’s public key.
- Messages are encrypted with AES on the client side and sent to the server.
- The server broadcasts encrypted messages to the recipient(s).
- Recipients use their private key to decrypt the AES key, then decrypt the message.

## 🛡️ Security

- **JWT Authentication:** Secure session management.
- **SSL (HTTPS):** Encrypts traffic between client and server.
- **RSA & AES Encryption:** Combines asymmetric and symmetric encryption for secure messaging.

## 🚀 Future Enhancements

- **Group Chats:** Support for multi-user conversations.
- **File Sharing:** Secure file uploads and sharing.
- **Read Receipts:** Track message delivery and read status.
- **Push Notifications:** Real-time notifications even when offline.
