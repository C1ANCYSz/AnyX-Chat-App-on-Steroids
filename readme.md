# 📖 Chat Application Documentation

## 🚀 Project Overview

This is a **secure chat application** built using the **MEN stack** (MongoDB, Express.js, Node.js) along with **Socket.IO** for real-time communication. The application ensures **end-to-end encryption** using **RSA** for key exchange and **AES** for secure messaging.

## 🔥 Features

- **User Authentication** – Signup, login, logout, and email verification.
- **Password Recovery** – Forgot and reset password functionality.
- **Real-Time Messaging** – Instant messaging with **Socket.IO**.
- **End-to-End Encryption** – AES encryption for messages, with RSA key exchange.
- **Conversations** – Users can join, leave, and switch between conversations.
- **Reactions & Replies** – React to messages and reply inline.
- **Search & Notifications** – Search for users and receive live message notifications.
- **Audio & Video Calls** – Peer-to-peer communication using **WebRTC**.
- **Voice Messages & Media Sharing** – Securely send audio and multimedia files.
- **Push Notifications** – Get real-time updates on messages and calls.

## 🏗️ Project Structure

```
├── controllers
│   ├── authControllers.js        # Handles authentication logic
│   ├── userControllers.js        # Manages user and conversation operations
│   ├── errorControllers.js       # Handles operational errors
├── models
│   ├── User.js                   # User schema
│   ├── Message.js                # Message schema
│   ├── Reaction.js               # Message reaction schema
│   └── Conversation.js           # Conversation schema
├── routes
│   ├── userRoutes.js             # User and conversation routes
│   └── viewRoutes.js             # EJS template rendering routes
├── views
│   ├── dashboard.ejs
│   ├── login.ejs
│   ├── signup.ejs
│   ├── home.ejs
│   ├── resetPassword.ejs
│   └── verifyEmail.ejs
├── public
│   ├── js
│   │   ├── dashboard.js          # Handles frontend chat logic
│   │   ├── VoiceAndVideoCalls.js # Manages RSA & AES encryption
│   │   ├── voiceNotesAndMedia.js
│   └── css
│       └── styles.css            # Main stylesheet
├── .env                          # Environment variables
├── package.json                  # Project dependencies
├── app.js
└── server.js                      # Main server file
```

## 📜 API Endpoints

### 🔑 Authentication Routes

- `POST /signup` – Register a new user.
- `POST /login` – Authenticate and log in a user.
- `POST /logout` – Log out the current user.
- `POST /verify-email` – Verify user email.
- `POST /forgot-password` – Send a password reset link.
- `POST /reset-password/:token` – Reset password with token.

### 💬 Conversation & Messaging Routes

- `GET /search-users` – Search for users (requires login & verification).
- `GET /conversations/:id` – Retrieve messages in a conversation.
- `POST /send-message/:id` – Send a message in a conversation.
- `POST /get-conversation-key/:id` – Retrieve conversation encryption key.
- `POST /upload-media` – Upload and send media files securely.

## ⚡ WebSocket Events

- `register` – Registers a user’s socket connection.
- `joinConversation` – Joins a chat room.
- `leaveConversation` – Leaves a chat room.
- `sendMessage` – Sends a new message.
- `receiveMessage` – Receives a message in real-time.
- `notification` – Receives live notifications.
- `offer`, `answer`, `candidate` – Handle WebRTC calls.
- `typing` – Indicates when a user is typing.

## 🛠️ Setup & Installation

1. **Clone the Repository:**

```bash
git https://github.com/C1ANCYSz/Chat-App-on-Steroids.git
cd Chat-App-on-Steroids
```

2. **Install Dependencies:**

```bash
npm install
```

3. **Generate SSL Certificates (for HTTPS):** #optional

```bash
mkdir ssl
cd ssl
openssl req -nodes -new -x509 -keyout server.key -out server.cert
```

4. **Set Up Environment Variables:**

Create a `.env` file and add:

```
PORT=3000
MONGO_URI=your-mongodb-uri
JWT_SECRET=your-jwt-secret
```

5. **Run the Server:**

```bash
npm start
```

6. **Access the App:**

Visit `https://localhost:3000` in your browser.

## 🔒 How Encryption Works

- Users generate an **RSA key pair** upon login.
- The server encrypts a **unique AES key** with each user’s **public key** at the start of a conversation.
- Messages are **encrypted with AES** on the client side and sent to the server.
- The server **broadcasts encrypted messages** to recipients.
- Recipients **decrypt the AES key** with their **private key** and then decrypt the message.
- can use other techniques like **(DH, SRP, SPAKE2,...)**

## 🛡️ Security Features

- **JWT Authentication** – Secure user session management.
- **SSL (HTTPS)** – Encrypts traffic between client and server.
- **RSA & AES Encryption** – Ensures secure messaging and data protection.
- **Redis Caching** – Optimizes key exchange performance.

## 🎯 Future Enhancements

- **Group Chats** – Support for multiple users in a conversation.
- **File Sharing** – Securely upload and share files.
- **Read Receipts** – Track message delivery and read status.
- **Push Notifications** – Get real-time updates even when offline.

## 📦 Dependencies

- **Backend:** `express`, `mongoose`, `jsonwebtoken`, `bcryptjs`
- **Security & Encryption:** `crypto-js`, `node-rsa`, `validator`
- **WebSockets & Realtime:** `socket.io`
- **Email Handling:** `mailtrap`
- **File Uploads:** `multer`, `cloudinary`
- **Development Tools:** `eslint`, `nodemon`, `prettier`
