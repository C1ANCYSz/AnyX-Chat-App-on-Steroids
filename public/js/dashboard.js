/*async function getPrivateKey() {
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
 */

const peerConnection = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});

let localStream;
let currentTargetUserId;
const audio =
  document.getElementById('remoteAudio') || document.createElement('audio');

audio.id = 'remoteAudio';
audio.autoplay = true;
audio.controls = true;
document.body.appendChild(audio);

async function callUser(userId) {
  try {
    currentTargetUserId = userId;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', { offer, targetUserId: userId });
    console.log('Calling user:', userId);
  } catch (error) {
    console.error('Error starting call:', error);
    alert('Failed to start call. Please check your microphone permissions.');
  }
}

// Handle incoming call offer
socket.on('offer', async ({ offer, senderId }) => {
  try {
    currentTargetUserId = senderId;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', { answer, targetUserId: senderId });
  } catch (error) {
    console.error('Error handling offer:', error);
  }
});

// Handle incoming call answer
socket.on('answer', async (answer) => {
  try {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(answer)
    );
    console.log('Call connected!');
  } catch (error) {
    console.error('Error setting remote description:', error);
  }
});

// Handle ICE candidates
peerConnection.onicecandidate = (event) => {
  if (event.candidate && currentTargetUserId) {
    socket.emit('candidate', {
      candidate: event.candidate,
      targetUserId: currentTargetUserId,
    });
  }
};

socket.on('candidate', (candidate) => {
  peerConnection
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch((error) => {
      console.error('Error adding ICE candidate:', error);
    });
});

peerConnection.ontrack = (event) => {
  console.log('Received track event:', event.streams[0]);

  audio.srcObject = event.streams[0];
  audio.muted = false;
  audio.volume = 1.0;

  audio.play().catch((error) => {
    console.error('Audio playback failed:', error);
  });
};

socket.on('incomingCall', ({ offer, senderId }) => {
  const acceptOrReject = document.createElement('div');
  acceptOrReject.innerHTML = `
    <div class="incoming-call">
      <p>You have an incoming call.</p>
      <button id="acceptCall">Accept</button>
      <button id="rejectCall">Reject</button>
    </div>
  `;
  document.body.appendChild(acceptOrReject);

  document.getElementById('acceptCall').addEventListener('click', () => {
    acceptCall(offer, senderId);
    acceptOrReject.remove();
  });

  document.getElementById('rejectCall').addEventListener('click', () => {
    socket.emit('callDeclined', { targetUserId: senderId });
    acceptOrReject.remove();
  });
});

async function acceptCall(offer, senderId) {
  try {
    currentTargetUserId = senderId;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', { answer, targetUserId: senderId });
    console.log('Call accepted!');
  } catch (error) {
    console.error('Error accepting call:', error);
  }
}

socket.on('disconnect', () => {
  peerConnection.close();
  console.warn('Disconnected from server');
});

peerConnection.oniceconnectionstatechange = () => {
  console.log('ICE connection state:', peerConnection.iceConnectionState);
};

peerConnection.onconnectionstatechange = () => {
  console.log('Peer connection state:', peerConnection.connectionState);
};

console.log('WebRTC voice call script loaded! 🎧');
