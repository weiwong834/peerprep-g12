[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/HpD0QZBI)
# CS3219 Project (PeerPrep) - AY2526S2
## Group: G12

PeerPrep is a platform designed to facilitate collaborative coding interview preparation. It connects students to solve coding questions together in real-time. Users can match with peers based on specific topics and difficulty levels, and work collaboratively in a shared code editor.

## Tech Stack

### Frontend
- **React 19**
- **TypeScript**
- **Vite**
- **MUI 7**
- **Zustand**
- **Monaco Editor**
- **Socket.IO**
- **Y.js**

### Backend
- **Node.js 20**
- **Express 5 (JavaScript)**

### Database
- **PostgreSQL 16 (x3)**
- **Redis 7**

### Infrastructure
- **Docker Compose**
- **pnpm**

## Architecture

| Service                     | Port      | Description                                                       |
|-----------------------------|-----------|-------------------------------------------------------------------|
| **Frontend**                 | 5173      | React SPA                                                         |
| **API Gateway**              | 3000      | JWT authentication, routing, role enforcement                     |
| **User Service**             | 3001      | Auth, profiles, admin management, question history                |
| **Question Bank Service**   | 3002      | CRUD operations for questions and topics                          |
| **Matching Service**        | 3003      | Peer matching via Redis sorted sets                               |
| **Collaboration Service**   | 3004      | Real-time code editor (Socket.IO + Y.js CRDT)                     |
| **Redis**                    | 6379      | In-memory key-value store for low-latency operations              |
| **RabbitMQ**                 | 5672      | Message broker for async communication between services           |
| **AI Explanations Service** | 4000      | Provides AI-generated explanations for coding problems            |
| **AI Chat Service**         | 3005      | AI-powered chat service for Q&A and explanations                   |

## Prerequisites

- Docker and Docker Compose installed on your machine.

## Getting Started
- 

---

## AI Use Disclosure

### All Services 

#### Disclosure 1

Date/Time: Throughout the project.

Tool: ChatGPT/Claude AI 

Prompt/Command: Used AI to assist with debugging, error identification, documentation, and troubleshooting SQL queries.  

Output Summary: Potential fixes for bugs, identified root causes of issues, helped optimize SQL queries, suggested improvements for error handling and documentation in the form of TSDoc etc.

Action Taken: Modified

Author Notes: Advice was taken to make changes to buggy code, while modifying certain logic to better fit requirements. Documentation was modified to better suit our understanding. 

### Collaboration Service 

#### Disclosure 1

Date/Time: 16 Mar 2026

Tool: Claude AI

Prompt/Command: Given project summary and basic requirements for collabaoration service, requested help with service setup

Output Summary: A suggested repository structure and setup + starting code for following files including (redis.ts, supabase.ts, .env, .gitignore, Dockerfile )

Action Taken: Accepted as-is

#
#### Disclosure 2

Date/Time: 19 Mar 2026

Tool: Claude AI

Prompt/Command: Given functional requirements, requested help implementing the GET /sessions/active endpoint (authenticated route requiring JWT verification via User Service)

Output Summary: Full runthrough for that endpoint sessionService.ts, sessionController.ts, authMiddleware.ts, sessionRoutes.ts, index.ts

Action Taken: Modified

Author Notes: Logic was largely maintained but error messages, phrasing and field names were edited to match actual schema. Was then used as an example to implement other endpoints

#
#### Disclosure 3

Date/Time: 19 Mar 2026

Tool: Claude AI

Prompt/Command: Given functional requirements, requested help implementing the join-session Socket.io event (authenticated room join with code restore from Redis)

Output Summary: Full runthrough for that event collabService.ts (join-session handler), Redis restore logic, session-joined emit, user-joined broadcast, idle timer and code save interval setup

Action Taken: Modified

Author Notes: Logic was largely maintained but error messages, phrasing and event names were edited. Was then used as an example to implement other endpoints

#
#### Disclosure 4

Date/Time: Repeated throughout development

Tool: Claude AI

Prompt/Command: Given intended functionality, requested test cases to run based on specific scenarios

Output Summary: Test case files covering session creation, code sync, Redis/Supabase persistence, rejoin, idle timeout and early termination

Action Taken: Modified

Author Notes: Specific error messages and console logs were edited
---
### Chat Service

#### Disclosure 1

Date/Time: 6 Apr 2026

Tool: Claude AI

Prompt/Command: Given project summary and basic requirements for collabaoration service, requested help with service setup

Output Summary: A suggested repository structure and setup + starting code for following files including (redis.ts, supabase.ts, rabbitmq.ts, .env, .gitignore, Dockerfile )

Action Taken: Accepted as-is

#
#### Disclosure 2

Date/Time: 6 Apr 2026

Tool: Claude AI

Prompt/Command: Given functional requirements, requested help implementing the RabbitMQ consumer for session.ended events and the Redis message storage logic

Output Summary: Full runthrough for chatService.ts (saveMessage, getMessages, deleteMessages), persistService.ts (flush Redis to Supabase on session end), rabbitmq.ts (exchange/queue setup and consumer logic), index.ts

Action Taken: Modified

Author Notes: Logic was largely maintained but schema name, key naming conventions and error messages were edited to match actual project setup.

#
#### Disclosure 3

Date/Time: 9 Apr 2026

Tool: Claude AI

Prompt/Command: Given existing CollaborationRoom component structure, requested help with frontend integration of chat panel

Output Summary: chatService.ts (Socket.IO connection helper), ChatPanel.tsx (authenticate event, send-message/receive-message handlers, chat history display), modifications to CollaborationRoom.tsx to add chat as third column

Action Taken: Modified

Author Notes: Component structure and event names were maintained but styling was adjusted to match existing frontend conventions.

---
### Question Service

#### Disclosure 1

Date/Time: 13 Mar 2026  

Tool: Claude AI  

Prompt/Command: Requested help setting up the service.

Output Summary: Claude AI generated the initial service setup, including suggested folder structure, configuration files, and initial setup code (e.g., `server.ts`, `routes.ts`, `.env`, `Dockerfile`). 

Action Taken: Accepted as-is.

#
#### Disclosure 2

Date/Time: 17 Mar 2026  

Tool: Claude AI  

Prompt/Command: Requested help with implementing the first two GET and POST endpoints to understand the syntax.  

Output Summary: Claude AI provided a detailed implementation for the first endpoint, including controller logic, middleware setup, and routing.  

Action Taken: Accepted as-is

Author Notes: Helped familiarise with the service structure and endpoint creation syntax, to be able to create the remaining endpoints myself. Tested using Postman to check for correctness.

#
#### Disclosure 3

Date/Time: 18 Mar 2026  

Tool: Claude AI  

Prompt/Command: Requested help with bulk population of questions.  

Output Summary: Helped streamline the question population process, suggesting optimized code for loading bulk question data into the database.  

Action Taken: Modified 

Author Notes: Checked correctness by trying to populate Supabase using the seed json file. Used error messages to debug issues and regenerated seed json file to populate.

#
#### Disclosure 4

Date/Time: 3 April 2026  

Tool: Claude AI  

Prompt/Command: Requested help with implementing authentication middleware for verifying admin roles using JWT from the User Service.  

Output Summary: Starting structure for the `requireAuth` and `requireAdmin` middleware, helping to handle the Supabase JWT verification and integrating the User Service for admin verification.  

Action Taken: Modified 

Author Notes: Logic was largely retained, with changes made to messages, and debugging errors. Tested for correctness using Postman, and by testing on localhost. 

---
### Frontend

#### Disclosure 1

Date/Time: 11 Mar 2026

Tool: Chatgpt (GPT-5.4)

Prompt/Command: Given project summary and the basic idea of the potential implementation of the app, suggest the techstack and how I should kickstart this app, provide comparison where possible

Output Summary: A comparison between Vite, Next.js, Create React App and suggested to use Vite for simpler implementation and speed. It also provided a skeleton frontend folder structure, and starting code to visualise the app.

Action Taken: Taken and modified suggestion

Author Notes: Suggestions were taken and skeleton code was modified to match desired implementation

#
#### Disclosure 2

Date/Time: 18 Mar 2026

Tool: Chatgpt (GPT-5.4)

Prompt/Command: For the frontend implementation in the admin page, admins will be able to view the full list of questions, I would like to display each question in a question card with relevant information tagged within the card. Can you suggest an implementation.

Output Summary: Provided different output choices for question card, highlighting the pros of better formatting within the card, for clarity

Action Taken: Taken and modified suggestion

Author Notes: The flow of the question card was used, however fixed some rendering and implemented additional feature to question card by making it expandable

#### Disclosure 3

Date/Time: 14 Apr 2026

Tool: Chatgpt (GPT-5.4)

Prompt/Command: Currently building the collaboration room. It has Monaco editor, socket events, idle warning, end session modal, AI explanation/partner chat panel. The idea is 3 panels: question on the left followed by editor, followed by collapsible chat panel with 3 tabs. However the format is getting messy and mainly page overflowing issues, can you suggest some fixes

Output Summary: Suggested formatting and layout changes to improve page structure and handle overflow issues more cleanly, while preserving the existing collaboration room logic and features.

Action Taken: Taken and modified suggestion

Author Notes: The formatting suggestions were reviewed, adjusted, and tested before being incorporated into the final CollaborationRoom component.

#
#### Disclosure 4

Date/Time: 14 Apr 2026

Tool: Chatgpt (GPT-5.4)

Prompt/Command: Working on CollagPage where users select topic, difficulty and language then connect to matching service through sockets. Can you debug the modal and error cases, the network error isn't displayed properly in a pop up and the modal format is messed up too.

Output Summary: Provided suggestings for error handling, and general debugginf for the UI

Action Taken: Taken and modified suggestion

Author Notes: The suggested logic and UI flow ideas were reviewed, adapted, and tested before being integrated, with further modifications made to fit the project’s actual matching flow.
