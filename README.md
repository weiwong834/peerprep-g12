[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/HpD0QZBI)
# CS3219 Project (PeerPrep) - AY2526S2
## Group: G12

### Note: 
- You are required to develop individual microservices within separate folders within this repository.
- The teaching team should be given access to the repositories, as we may require viewing the history of the repository in case of any disputes or disagreements. 

---

## AI Use Disclosure

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

#
#### Disclosure 5

Date/Time: 19 Mar 2026

Tool: Claude AI

Prompt/Command: Requested documentation based on a few endpoints and Socket.io events

Output Summary: DOCUMENTATION.md

Action Taken: Modified

Author Notes: Minor formatting changes and additional endpoints and events included as development progressed

#
#### Disclosure 6

Date/Time: Repeated throughout development

Tool: Claude AI

Prompt/Command: Given error output or unexpected behaviour, requested help identifying root cause and fix

Output Summary: Identification of root cause and suggested fix

Action Taken: Modified

Author Notes: Fixes reviewed and understood before applying

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