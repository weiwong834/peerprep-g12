# User Service
The User Service handles authentication, user management, and authorization for the PeerPrep platform.

Built using:
- Node.js + Express
- Supabase Auth (authentication)
- Supabase Postgres (user profiles)

## Setup
Prerequisites:
- Node.js (LTS)
- Supabase project

## Environment Variables
Create a `.env` file in the user-service directory:
```
PORT=3000
SUPABASE_URL=<your_supabase_url>
SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_KEY=<your_service_role_key>
```

## Supabase Setup
Ensure you have:
- Authentication enabled (Email/Password)
- A schema: `userservice`
- A table: `profiles` with fields:
    - `id` (UUID, matches auth.users.id)
    - `username`
    - `email`
    - `user_role` (e.g. "user", "admin")
- A trigger that inserts into `profiles` on signup.

## Running the Service
In Terminal:
```
npm install
npm start
```
Or in development mode:
```
npm run dev
```
The service runs on: `http://localhost:3000`

## API Endpoints
### Auth
#### Signup: 
`POST /auth/signup`

Body:
```
{
  "username": "user123",
  "email": "user@gmail.com",
  "password": "Password123!"
}
```

Responses:
- 201	User registered
- 400	Invalid input / duplicate username/email
- 429	Email rate limit exceeded

#### Login:
`POST /auth/login`

Body:
```
{
"email": "user@gmail.com",
"password": "Password123!"
}
```

Responses:
- 200 Login successful (returns access token)
- 401 Invalid email or password


#### Logout:
`POST /auth/logout`

Headers:
```
Authorization: Bearer <token>
```

Responses:
- 200 Logged out successfully
- 401 Missing or invalid token


---

### User

#### Get Current User Info:
`GET /user/getUserInfo`

Headers:
```
Authorization: Bearer <token>
```

Responses:
- 200 Returns user info
- 401 Unauthorized
- 404 Profile not found


#### Update Username:
`PATCH /user/username`

Headers:
```
Authorization: Bearer <token>
```

Body:
```
{
"username": "newusername"
}
```

Responses:
- 200 Username updated
- 400 Username invalid / duplicate
- 401 Unauthorized
- 500 Update failed


#### Check Username Availability:
`GET /user/checkUniqueUsername?username=<username>`

Responses:
- 200 { available: true/false }
- 400 Missing username
- 500 Server error


#### Delete Own Account:
`DELETE /user/deleteAccount`

Headers:
```
Authorization: Bearer <token>
```

Responses:
- 200 Account deleted
- 400 Cannot delete last admin
- 401 Unauthorized
- 500 Server error


---

### Admin

#### Promote User to Admin:
`PATCH /admin/role/:userId`

Headers:
```
Authorization: Bearer <token>
```

Responses:
- 200 User promoted
- 401 Unauthorized
- 403 Not admin
- 404 User not found
- 400 Already admin
- 500 Server error


#### Get All Users:
`GET /admin/allUsers`

Headers:
```
Authorization: Bearer <token>
```

Responses:
- 200 Returns all users
- 401 Unauthorized
- 403 Not admin
- 500 Server error


---

### Password Reset

#### Request Password Reset:
`POST /auth/requestResetPassword`

Body:
```
{
"email": "user@gmail.com"
}
```

Responses:
- 200 Reset email sent
- 500 Failed to send email


#### Reset Password:
`POST /auth/resetPassword`

Headers:
```
Authorization: Bearer <token>
```

Body:
```
{
"password": "NewPassword123!",
"refreshToken": "<refresh_token>"
}
```

Responses:
- 200 Password reset successful
- 400 Invalid token / bad request
- 401 Unauthorized
- 500 Server error

## Limitations

### Supabase Email Rate Limits
Supabase (free plan) enforces a rate limit on authentication-related emails (e.g. signup confirmation and password reset emails).

- Limit: Approximately 2 emails per hour per user
- Affects:
  - `/auth/signup`
  - `/auth/requestResetPassword`

If the rate limit is exceeded:
- Requests will fail with errors (e.g. 429 or 500 depending on context)
- Users may not receive confirmation or reset emails

---

### Email Verification (Magic Link Scanning)
Supabase verifies users via email confirmation links (magic links).

However, some email providers (e.g. institutional or enterprise emails like `@u.nus.edu`) may have security systems that:
- Automatically scan incoming emails
- Open links to check for malicious content

This can result in:
- Magic links being triggered automatically
- Emails being marked as "verified" without user interaction

Implication:
- Users may appear as “verified” immediately after signup

Note: this is due to external email security systems, not a bug in the service