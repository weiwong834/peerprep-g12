# PeerPrep Frontend

## Overview
The frontend provides the user-facing interface for PeerPrep, covering authentication, peer matching, real-time collaboration, question management, and attempt review.

It is designed to support a microservices architecture, where each major frontend feature communicates with its corresponding backend service.

---

## Tech Stack
- **React**
- **Vite**
- **TypeScript**
- **Tailwind CSS**
- **Socket.IO Client**
- **Monaco Editor**
- **Yjs**

---

## Running the Frontend Locally

### Prerequisites
- Node.js installed
- npm installed

### Install dependencies & Run
```bash
npm install
npm run dev
```

---
Main Features
---
- User service: User login, signup, account creation confirmation, password reset flows, username update, account deletion, user promotion to admin
- Question service: Viewing, creating, editing, archiving, restoring, deleting questions, support question creation with images 
- Matching service: Peer matching by topic, difficulty, and language, handle logic for cases: Imperfect match confirmation flow..
- Collaboaration service: Real-time collaborative coding room, shared code editor with live synchronisation, code formatting, syntax highlighting, question view on the left panel
- Partner chat and AI-assisted support tools
- Attempt history viewing
- Admin interface for question and user management
