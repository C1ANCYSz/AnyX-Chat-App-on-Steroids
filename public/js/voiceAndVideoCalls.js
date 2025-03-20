let localStream;
let peerConnection;
let callRoom;
let currentTargetUserId;
let isScreenSharing = false;
let cameraStream = null;
let isMuted = false;
let isCameraOn = true;
let callTimerInterval;
let incomingCallerName;
let incomingCallerImage;
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

async function startCall(conversationId, isVideoCall = false) {
  try {
    const callingUser = document.querySelector(
      '.chat-header .username',
    ).innerText;

    console.log(`Calling user: ${callingUser}`);
    console.log(`Starting call in conversation ${conversationId}`);

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideoCall,
    });

    voiceCallContainer.innerHTML = `
    <h1 class="caller-name">${callingUser}</h1>
    <h2 style="color:white;">Ringing...</h2>
    `;

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

async function acceptCall(
  conversationId,
  isVideoCall,
  offer,
  callerId,
  callerName,
  callerImageSrc,
) {
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
    socket.emit('acceptCall', { conversationId, answer, myId: socket.id });

    setupCallUI(callerName, incomingCallerImage);
    startCallTimer();

    isVideoCall
      ? (videosContainer.style.display = 'block')
      : (voiceCallContainer.style.display = 'block');
  } catch (error) {
    console.error('Error accepting call:', error);
  }
}

socket.on('callAccepted', ({ answer, username, image }) => {
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

  setupCallUI(username, image);
  startCallTimer();
});

function setupCallUI(callerName, callerImageSrc) {
  voiceCallContainer.innerHTML = `
  <div class="voice-call-container">
  <div class="call-info-container">
    <img src="${callerImageSrc}" class="caller-image">
    <div class="caller-details">
      <h1 class="caller-name">${callerName}</h1>
      <h2 id="callTimer" class="call-timer">00:12</h2>
    </div>
  </div>

  <div class="voice-controls">
    <div id="endVoiceCall" onclick="endCall()" class="control-btn end-call">
      <i class="bx bxs-phone-call"></i>
    </div>
    <div id="muteVoiceCall" onclick="toggleMute()" class="control-btn">
      <i class="bx bxs-microphone-off"></i>
    </div>
    <div id="switchToVideo" onclick="toggleCamera()" class="control-btn">
      <i class="bx bxs-camera-off"></i>
    </div>
  </div>
</div>

  `;
}

function startCallTimer() {
  let timer = 0;

  if (callTimerInterval) {
    clearInterval(callTimerInterval);
  }

  callTimerInterval = setInterval(() => {
    timer++;
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('callTimer').textContent = formattedTime;
  }, 1000);
}

socket.on(
  'incomingCall',
  ({
    conversationId,
    callerId,
    callerName,
    callerImage,
    isVideoCall,
    offer,
  }) => {
    console.log(`Incoming call from ${callerName}`);
    incomingCallerImage = callerImage;
    incomingCallerName = callerName;
    callUI = document.createElement('div');
    callUI.innerHTML = `
      <div class="incoming-call">
        <img src="${callerImage}" alt="${callerName}" style="width: 50px; height: 50px;" />
        <h2>${callerName} is calling...</h2>
        <button id="acceptCall">Accept</button>
        <button id="rejectCall">Reject</button>
      </div>
    `;
    document.body.appendChild(callUI);

    document.getElementById('acceptCall').addEventListener('click', () => {
      acceptCall(conversationId, isVideoCall, offer, callerId, callerName);
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

async function terminateScreenShare() {
  try {
    if (!isScreenSharing) return;

    const screenStream = document.getElementById('localVideo').srcObject;
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }

    const sender = peerConnection
      ?.getSenders()
      .find((s) => s.track?.kind === 'video');
    if (sender) {
      sender.replaceTrack(null);
    }

    document.getElementById('shareScreen').style.backgroundColor = '#333';

    isScreenSharing = false;

    console.log('Screen sharing terminated successfully.');
  } catch (error) {
    console.error('Error terminating screen share:', error);
  }
}

async function endCall() {
  console.log('Ending call...');

  try {
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
      });
      localStream = null;
    }

    if (isScreenSharing) {
      await terminateScreenShare();
    }

    if (peerConnection) {
      peerConnection.getSenders().forEach((sender) => sender.track?.stop());
      peerConnection.close();
      peerConnection = null;
    }

    if (callTimerInterval) {
      clearInterval(callTimerInterval);
      callTimerInterval = null;
    }

    socket.emit('endCall', { conversationId: callRoom, userId: socket.id });

    videosContainer.style.display = 'none';
    voiceCallContainer.style.display = 'none';

    document
      .querySelectorAll('.remote-video')
      .forEach((video) => video.remove());

    document.querySelector('#localVideo').srcObject = null;

    isMuted = false;
    isCameraOn = false;
    isScreenSharing = false;

    console.log('Call ended successfully.');
  } catch (error) {
    console.error('Error ending call:', error);
  }
}

document.getElementById('endVideoCall').addEventListener('click', async () => {
  await endCall();
});

socket.on('endCall', async () => {
  await endCall();
});

document.getElementById('muteVIdeoCall').addEventListener('click', () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];

    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMuted = !audioTrack.enabled;

      document.getElementById('muteVIdeoCall').style.backgroundColor = isMuted
        ? 'rebeccapurple'
        : '#333';
    }
  }
});

function toggleMute() {
  if (!localStream) {
    console.error('No active audio stream found.');
    return;
  }
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    isMuted = !audioTrack.enabled;

    document.getElementById('muteVoiceCall').style.backgroundColor = isMuted
      ? 'rebeccapurple'
      : '#333';

    console.log(`Microphone is now ${isMuted ? 'Muted' : 'Unmuted'}`);
  } else {
    console.error('No audio track found in localStream.');
  }
}

function toggleCamera() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];

    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isCameraOn = videoTrack.enabled;

      peerConnection.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'video') {
          sender.track.enabled = videoTrack.enabled;
        }
      });

      document.getElementById('switchToVoice').style.backgroundColor =
        isCameraOn ? '#333' : 'rebeccapurple';
    }
  }
}

document
  .getElementById('switchToVoice')
  .addEventListener('click', toggleCamera);
