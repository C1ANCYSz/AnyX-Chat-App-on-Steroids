let localStream;
let peerConnection;
let callRoom;
let currentTargetUserId;
let isScreenSharing = false;
let cameraStream = null;
let isMuted = false;
let isCameraOn = true;

const voiceCallContainer = document.querySelector('#voiceCallContainer');
const videosContainer = document.querySelector('#videosContainer');

function makeDraggable(element) {
  let offsetX = 0,
    offsetY = 0,
    initialX = 0,
    initialY = 0;

  element.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e.preventDefault();
    initialX = e.clientX;
    initialY = e.clientY;
    document.onmousemove = dragElement;
    document.onmouseup = stopDragElement;
  }

  function dragElement(e) {
    e.preventDefault();
    offsetX = initialX - e.clientX;
    offsetY = initialY - e.clientY;
    initialX = e.clientX;
    initialY = e.clientY;

    element.style.top = element.offsetTop - offsetY + 'px';
    element.style.left = element.offsetLeft - offsetX + 'px';
  }

  function stopDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

makeDraggable(voiceCallContainer);

async function startCall(conversationId, myId, isVideoCall = false) {
  try {
    console.log('myId', myId);
    console.log(`Starting call in conversation ${conversationId}`);

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideoCall,
    });

    localVideo.srcObject = localStream;
    callRoom = conversationId;

    setupPeerConnection(conversationId);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('startCall', { conversationId, isVideoCall, offer });

    if (isVideoCall) {
      videosContainer.style.display = 'block';
    } else {
      voiceCallContainer.style.display = 'block';
    }
  } catch (error) {
    console.error('Error starting call:', error);
  }
}

async function acceptCall(conversationId, isVideoCall, offer, callerId) {
  try {
    console.log(`Joining call in conversation ${conversationId}`);
    callRoom = conversationId;

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideoCall,
    });

    document.querySelector('#localVideo').srcObject = localStream;
    setupPeerConnection(conversationId);

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('acceptCall', { conversationId, answer, callerId });
    isVideoCall
      ? (videosContainer.style.display = 'block')
      : (voiceCallContainer.style.display = 'block');
  } catch (error) {
    console.error('Error accepting call:', error);
  }
}

socket.on('callAccepted', ({ answer }) => {
  console.log('Answer received. Setting remote description.');
  peerConnection
    .setRemoteDescription(new RTCSessionDescription(answer))
    .catch(console.error);
  if (window.pendingCandidates) {
    console.log(
      `Processing ${window.pendingCandidates.length} pending ICE candidates...`,
    );
    window.pendingCandidates.forEach(async (c) => {
      await peerConnection.addIceCandidate(new RTCIceCandidate(c));
    });
    window.pendingCandidates = [];
  }
});

socket.on(
  'incomingCall',
  ({ conversationId, callerId, callerName, isVideoCall, offer }) => {
    console.log(`Incoming call from ${callerName}`);

    const callUI = document.createElement('div');
    callUI.innerHTML = `
      <div class="incoming-call">
        <h2>${callerName} is calling...</h2>
        <button id="acceptCall">Accept</button>
        <button id="rejectCall">Reject</button>
      </div>
    `;
    document.body.appendChild(callUI);

    document.getElementById('acceptCall').addEventListener('click', () => {
      acceptCall(conversationId, isVideoCall, offer, callerId);
      callUI.remove();
    });

    document.getElementById('rejectCall').addEventListener('click', () => {
      socket.emit('callRejected', { conversationId });
      callUI.remove();
    });
  },
);

socket.on('candidate', async (candidate) => {
  if (!peerConnection || !peerConnection.remoteDescription) {
    console.warn(
      'ICE candidate received before remote description was set. Storing...',
    );

    if (!window.pendingCandidates) {
      window.pendingCandidates = [];
    }
    window.pendingCandidates.push(candidate);

    return;
  }

  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('ICE candidate added successfully.');
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
});

socket.on('userJoined', ({ userId, conversationId }) => {
  console.log(`User ${userId} joined call in ${conversationId}`);
});

socket.on('userLeft', ({ userId }) => {
  console.log(`User ${userId} left the call`);

  const remoteVideo = document.querySelector(`#remoteVideo-${userId}`);
  if (remoteVideo) {
    remoteVideo.remove();
  }
});

function setupPeerConnection(conversationId) {
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('candidate', { candidate: event.candidate, conversationId });
    }
  };

  peerConnection.ontrack = (event) => {
    console.log('Received remote track');

    let remoteVideo = document.querySelector(
      `#remoteVideo-${event.streams[0].id}`,
    );
    if (!remoteVideo) {
      remoteVideo = document.createElement('video');
      remoteVideo.id = `remoteVideo-${event.streams[0].id}`;
      remoteVideo.className = 'video remote-video';
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;
      remoteVideo.srcObject = event.streams[0];

      document.querySelector('.videos').appendChild(remoteVideo);
    }
  };

  console.log(`Peer connection set up for conversation ${conversationId}`);
}

document.getElementById('endVideoCall').addEventListener('click', endCall);

document.getElementById('shareScreen').addEventListener('click', async () => {
  if (!isScreenSharing) {
    startScreenShare();
  } else {
    stopScreenShare();
  }
});

async function startScreenShare() {
  try {
    if (!cameraStream) {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    }

    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    const screenTrack = screenStream.getVideoTracks()[0];
    const sender = peerConnection
      .getSenders()
      .find((s) => s.track.kind === 'video');

    if (sender) {
      sender.replaceTrack(screenTrack);
    }

    document.getElementById('localVideo').srcObject = screenStream;

    document.getElementById('shareScreen').style.backgroundColor =
      'rebeccapurple';

    isScreenSharing = true;

    screenTrack.onended = () => {
      stopScreenShare();
    };
  } catch (error) {
    console.error('Error sharing screen:', error);
  }
}

async function stopScreenShare() {
  try {
    if (!cameraStream) {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    }

    const cameraTrack = cameraStream.getVideoTracks()[0];
    const sender = peerConnection
      .getSenders()
      .find((s) => s.track.kind === 'video');

    if (sender) {
      sender.replaceTrack(cameraTrack);
    }

    document.getElementById('localVideo').srcObject = cameraStream;

    document.getElementById('shareScreen').style.backgroundColor = '#333';

    isScreenSharing = false;
  } catch (error) {
    console.error('Error switching back to camera:', error);
  }
}

function endCall() {
  console.log('Ending call...');

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  socket.emit('endCall', { conversationId: callRoom, userId: socket.id });

  videosContainer.style.display = 'none';
  voiceCallContainer.style.display = 'none';

  document.querySelectorAll('.remote-video').forEach((video) => video.remove());

  document.querySelector('#localVideo').srcObject = null;
}

document.getElementById('muteVIdeoCall').addEventListener('click', () => {
  const localStream = document.getElementById('localVideo').srcObject;

  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];

    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;

      document.getElementById('muteVIdeoCall').style.backgroundColor =
        audioTrack.enabled ? '#333' : 'rebeccapurple';
      isMuted = !audioTrack.enabled;
    }
  }
});

function toggleCamera() {
  const localStream = document.getElementById('localVideo').srcObject;

  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];

    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isCameraOn = videoTrack.enabled;

      document.getElementById('switchToVoice').style.backgroundColor =
        isCameraOn ? '#333' : 'rebeccapurple';
    }
  }
}

document
  .getElementById('switchToVoice')
  .addEventListener('click', toggleCamera);
