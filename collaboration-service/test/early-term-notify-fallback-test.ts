import { io } from 'socket.io-client';

const SESSION_ID = 'a24186e0-9d5b-4006-a850-33ba4914a6d8';
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

socket2.on('rejoin-available', (data) => console.log('User2 rejoin-available:', data));
socket2.on('session-ended', (data) => console.log('User2 session-ended:', data));

// end session early - Matching Service is not running so notification should fail
// and get stored in failed_notifications table
setTimeout(() => {
  console.log('--- Ending session early ---');
  socket1.emit('end-session', { sessionId: SESSION_ID, userId: USER1_ID });
}, 1000);

setTimeout(() => {
  console.log('Done! Now check:');
  console.log('1. Supabase failed_notifications table has a new row');
  console.log('2. Server logs show retry job attempting resend every 2 mins');
  socket1.disconnect();
  socket2.disconnect();
  process.exit(0);
}, 4000);