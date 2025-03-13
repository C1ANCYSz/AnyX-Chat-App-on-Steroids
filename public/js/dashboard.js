const peerConnection = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});

let localStream;
let currentTargetUserId;
const remoteVideo =
  document.getElementById('remoteVideo') || document.createElement('video');
const localVideo =
  document.getElementById('localVideo') || document.createElement('video');

remoteVideo.id = 'remoteVideo';
remoteVideo.autoplay = true;
remoteVideo.controls = false;

localVideo.id = 'localVideo';
localVideo.autoplay = true;
localVideo.muted = true; // Mute local video to avoid feedback

document.body.appendChild(remoteVideo);
document.body.appendChild(localVideo);

async function callUser(userId) {
  try {
    currentTargetUserId = userId;
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    localVideo.srcObject = localStream;

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', { offer, targetUserId: userId });
    console.log('Calling user:', userId);
  } catch (error) {
    console.error('Error starting video call:', error);
    alert(
      'Failed to start video call. Please check your camera and microphone permissions.'
    );
  }
}

socket.on('offer', async ({ offer, senderId }) => {
  try {
    currentTargetUserId = senderId;
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    localVideo.srcObject = localStream;
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', { answer, targetUserId: senderId });
    console.log('Answered video call from:', senderId);
  } catch (error) {
    console.error('Error handling incoming video call:', error);
  }
});

socket.on('answer', async (answer) => {
  try {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(answer)
    );
    console.log('Video call connected!');
  } catch (error) {
    console.error('Error setting remote description:', error);
  }
});

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
  console.log('Received remote track:', event.streams[0]);
  remoteVideo.srcObject = event.streams[0];
};

socket.on('incomingCall', ({ offer, senderId, username, image }) => {
  const acceptOrReject = document.createElement('div');
  acceptOrReject.innerHTML = `
    <div class="incoming-call">
      <p>Incoming video call...</p>
      <img src="${image}" alt="${username}" style="width: 50px; height: 50px">
      <h2>${username}</h2>
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
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    localVideo.srcObject = localStream;
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', { answer, targetUserId: senderId });
    console.log('Accepted video call!');
  } catch (error) {
    console.error('Error accepting video call:', error);
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

console.log('WebRTC video call script loaded! 📹');
