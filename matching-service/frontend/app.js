// Hardcoded for testing purposes
const TOPICS = [
  'Arrays',
  'Sorting',
  'Strings',
  'Hash Tables',
  'Linked Lists',
  'Recursion',
  'Trees',
  'Graphs',
  'Heaps',
  'Tries'
];

const EVENTS = {
  MATCH_REQUEST: 'match_request',
  MATCH_RESPONSE: 'match_response',
  CANCEL_REQUEST: 'cancel_request',
  CANCEL_RESPONSE: 'cancel_response',
  CONFIRM_REQUEST: 'confirm_request'
};

const topicSelect = document.getElementById('topic');
const serverUrlInput = document.getElementById('serverUrl');
const userIdInput = document.getElementById('userId');
const difficultyInput = document.getElementById('difficulty');
const languageInput = document.getElementById('language');
const connectionStatus = document.getElementById('connectionStatus');
const logPanel = document.getElementById('logPanel');

const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const findMatchBtn = document.getElementById('findMatchBtn');
const cancelBtn = document.getElementById('cancelBtn');
const confirmBtn = document.getElementById('confirmBtn');
const declineBtn = document.getElementById('declineBtn');

let socket = null;

function writeLog(label, payload) {
  const line = `[${new Date().toLocaleTimeString()}] ${label}${payload ? ` ${JSON.stringify(payload)}` : ''}`;
  logPanel.textContent = `${line}\n${logPanel.textContent}`;
}

function setStatus(connected) {
  if (connected) {
    connectionStatus.textContent = 'Connected';
    connectionStatus.classList.remove('disconnected');
    connectionStatus.classList.add('connected');
    return;
  }

  connectionStatus.textContent = 'Disconnected';
  connectionStatus.classList.remove('connected');
  connectionStatus.classList.add('disconnected');
}

function getUserId() {
  const fromInput = userIdInput.value.trim();
  if (fromInput) {
    sessionStorage.setItem('matching-ui-user-id', fromInput);
    return fromInput;
  }

  const stored = sessionStorage.getItem('matching-ui-user-id');
  if (stored) {
    userIdInput.value = stored;
    return stored;
  }

  const generated = crypto.randomUUID();
  userIdInput.value = generated;
  sessionStorage.setItem('matching-ui-user-id', generated);
  return generated;
}

function getCriteria() {
  return {
    topic: topicSelect.value,
    difficulty: difficultyInput.value,
    language: languageInput.value
  };
}

function ensureConnected() {
  if (socket && socket.connected) {
    return true;
  }

  writeLog('ERROR', { message: 'Socket is not connected.' });
  return false;
}

function connectSocket() {
  if (socket && socket.connected) {
    writeLog('INFO', { message: 'Already connected.' });
    return;
  }

  socket = io(serverUrlInput.value, {
    transports: ['websocket']
  });

  socket.on('connect', () => {
    setStatus(true);
    writeLog('CONNECTED', { socketId: socket.id });
  });

  socket.on('disconnect', (reason) => {
    setStatus(false);
    writeLog('DISCONNECTED', { reason });
  });

  socket.on(EVENTS.MATCH_RESPONSE, (payload) => {
    // TBD for frontend
    // if MatchResponseStatus.QUEUED FE should show UI notif, can use socket message "Searching for a perfect match." w/ countdown
    // if MatchResponseStatus.PERFECT_MATCH_FOUND or MatchResponseStatus.MATCH_SUCCESS FE can show UI notif to confirm redirection to collab room
    // if MatchResponseStatus.IMPERFECT_MATCH_NEEDS_CONFIRMATION FE can show UI notif with match details and ask user to confirm / cancel
    // if MatchResponseStatus.UNSUCCESSFUL_MATCH or MatchResponseStatus.MATCH_TIMEOUT FE should show UI notif with socket message
    writeLog('MATCH_RESPONSE', payload);
  });

  socket.on(EVENTS.CANCEL_RESPONSE, (payload) => {
    writeLog('CANCEL_RESPONSE', payload);
  });

  socket.on('connect_error', (error) => {
    setStatus(false);
    writeLog('CONNECT_ERROR', { message: error.message });
  });
}

function disconnectSocket() {
  if (!socket) {
    return;
  }

  socket.disconnect();
  setStatus(false);
}

function sendMatchRequest() {
  if (!ensureConnected()) {
    return;
  }

  const payload = {
    userId: getUserId(),
    criteria: getCriteria()
  };

  socket.emit(EVENTS.MATCH_REQUEST, payload);
  writeLog('MATCH_REQUEST', payload);
}

function sendCancelRequest() {
  if (!ensureConnected()) {
    return;
  }

  const payload = { userId: getUserId() };
  socket.emit(EVENTS.CANCEL_REQUEST, payload);
  writeLog('CANCEL_REQUEST', payload);
}

function sendConfirmRequest(accepted) {
  if (!ensureConnected()) {
    return;
  }

  const payload = {
    userId: getUserId(),
    accepted
  };

  socket.emit(EVENTS.CONFIRM_REQUEST, payload);
  writeLog('CONFIRM_REQUEST', payload);
}

// TBD: Can remove when integrated with question service, just for testing with static topics for now
function setupTopicSelect() {
  TOPICS.forEach((topic) => {
    const option = document.createElement('option');
    option.value = topic;
    option.textContent = topic;
    topicSelect.appendChild(option);
  });

  topicSelect.value = 'Arrays';
}

function setup() {
  setupTopicSelect();
  getUserId();
  connectBtn.addEventListener('click', connectSocket); // TBD for FE: Connect upon entering match page instead
  disconnectBtn.addEventListener('click', disconnectSocket); // TBD for FE: Disconnect upon leaving match page instead
  findMatchBtn.addEventListener('click', sendMatchRequest); // TBD: To link to actual Match button in FE
  cancelBtn.addEventListener('click', sendCancelRequest); // TBD: To link to actual Cancel button in FE (should only show if match is in progress)
  confirmBtn.addEventListener('click', () => sendConfirmRequest(true)); // TBD: To link to confirm button in FE (should only show if imperfect match confirmation needed)
  declineBtn.addEventListener('click', () => sendConfirmRequest(false)); // TBD: To link to decline button in FE (should only show if imperfect match confirmation needed)
}

setup();
