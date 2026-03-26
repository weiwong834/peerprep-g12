import { io } from 'socket.io-client';

const SESSION_ID = 'a092131c-b02f-447e-bbea-95b67b5f0be3';
const USER1_ID = 'a9261639-ad11-45d9-8ac1-5f3873f83acf';
const USER2_ID = 'ecba29b9-541c-4170-9081-df13b6668173';

const socket1 = io('http://localhost:3003');
const socket2 = io('http://localhost:3003');

socket1.on('connect', () => {
  socket1.emit('join-session', { sessionId: SESSION_ID, userId: USER1_ID });
});

socket2.on('connect', () => {
  socket2.emit('join-session', { sessionId: SESSION_ID, userId: USER2_ID });
});

// User2 listeners
socket2.on('session-ended', (data) => console.log('User2 session-ended:', data));
socket2.on('rejoin-available', (data) => console.log('User2 rejoin-available:', data));

// End session immediately (within 2 mins)
setTimeout(() => {
  console.log('--- User1 ends session early ---');
  socket1.emit('end-session', { sessionId: SESSION_ID, userId: USER1_ID });
}, 1000);

setTimeout(() => {
  console.log('Done!');
  socket1.disconnect();
  socket2.disconnect();
  process.exit(0);
}, 5000);