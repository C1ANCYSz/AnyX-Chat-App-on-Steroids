// Voice and Video Call Logic (Separated)

// Create elements for video and audio
const localVideo = document.createElement('video');
localVideo.id = 'localVideo';
localVideo.autoplay = true;
localVideo.muted = true;
localVideo.style.border = '1px solid red';
document.body.appendChild(localVideo);

const remoteVideo = document.createElement('video');
remoteVideo.id = 'remoteVideo';
remoteVideo.autoplay = true;
remoteVideo.controls = true;
document.body.appendChild(remoteVideo);

const remoteAudio = document.createElement('audio');
remoteAudio.id = 'remoteAudio';
remoteAudio.autoplay = true;
remoteAudio.controls = true;
document.body.appendChild(remoteAudio);

// Peer connection setup
const peerConnection = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});

let localStream;
let currentTargetUserId;

async function startStream(isVideo) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideo,
    });
    localVideo.srcObject = localStream;
    console.log(`Local ${isVideo ? 'video' : 'voice'} stream ready:`);
  } catch (error) {
    console.error('Failed to start local stream:', error);
  }
}

async function callUser(userId, isVideo) {
  try {
    currentTargetUserId = userId;
    await startStream(isVideo);
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { offer, targetUserId: userId, isVideo });

    console.log(`Calling user: ${userId} (${isVideo ? 'Video' : 'Voice'})`);
  } catch (error) {
    console.error('Error starting call:', error);
  }
}

// Handle incoming call offer
socket.on('incomingCall', async ({ offer, senderId, isVideo }) => {
  console.log(`Incoming ${isVideo ? 'video' : 'voice'} call from ${senderId}`);
  const accept = confirm(`Accept ${isVideo ? 'video' : 'voice'} call?`);

  if (accept) {
    await acceptCall(offer, senderId, isVideo);
  } else {
    socket.emit('callDeclined', { targetUserId: senderId });
  }
});

async function acceptCall(offer, senderId, isVideo) {
  try {
    currentTargetUserId = senderId;
    await startStream(isVideo);
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { answer, targetUserId: senderId });
    console.log('Call accepted, answer sent!');
  } catch (error) {
    console.error('Error accepting call:', error);
  }
}

peerConnection.ontrack = (event) => {
  console.log('Received remote track event:', event.streams[0]);

  event.streams[0].getTracks().forEach((track) => {
    if (track.kind === 'video') {
      remoteVideo.srcObject = event.streams[0];
    } else if (track.kind === 'audio') {
      remoteAudio.srcObject = event.streams[0];
    }
  });
};

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

console.log('WebRTC voice & video call script loaded! 🎧📹');

// Use these functions to start a call
// callUser('targetUserId', true) -> Video Call
// callUser('targetUserId', false) -> Voice Call
