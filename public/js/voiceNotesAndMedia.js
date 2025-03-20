let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let recordingTimer;
let recordingSeconds = 0;
let micStream = null;
let convoId;

async function toggleVoiceRecording(conversationId) {
  convoId = conversationId;
  const voiceBtn = document.getElementById('sendVoiceMessageBtn');
  const recordingIndicator = document.getElementById('recordingIndicator');
  const recordingTimerSpan = document.getElementById('recordingTimer');
  voiceBtn.classList.add('sendIcons');

  if (!isRecording) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaRecorder = new MediaRecorder(micStream);
      audioChunks = [];
      recordingSeconds = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        clearInterval(recordingTimer);
        recordingIndicator.style.display = 'none';
        closeMicrophone();
        sendVoiceMessage();
      };

      mediaRecorder.start();
      isRecording = true;

      recordingIndicator.style.display = 'block';
      recordingTimerSpan.textContent = '00:00';

      recordingTimer = setInterval(() => {
        recordingSeconds++;
        const minutes = Math.floor(recordingSeconds / 60);
        const seconds = recordingSeconds % 60;
        recordingTimerSpan.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }, 1000);

      voiceBtn.innerHTML = `<i class='bx bx-stop-circle' style='color:#ffffff' ></i>`;
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;

    voiceBtn.innerHTML = `<i class='bx bxs-microphone-alt' style='color:#ffffff' ></i>`;
  }
}

function sendVoiceMessage() {
  if (audioChunks.length === 0) return;

  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  const reader = new FileReader();

  reader.onloadend = function () {
    const audioBase64 = reader.result.split(',')[1];

    const replyingToElement = document.querySelector('.reply-preview');
    const replyingToId = replyingToElement
      ? replyingToElement.dataset.id
      : null;

    socket.emit('sendMessage', {
      conversationId: convoId,
      message: audioBase64,
      replyingTo: replyingToId || undefined,
      type: 'voice',
    });

    console.log('Voice message sent!');

    if (replyingToElement) replyingToElement.remove();
  };

  reader.readAsDataURL(audioBlob);
}

function closeMicrophone() {
  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
    console.log('Microphone closed after recording.');
  }
}
