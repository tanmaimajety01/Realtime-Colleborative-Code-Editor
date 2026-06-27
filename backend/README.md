# SyncCode Backend API

A **production-ready REST API** backend for the [SyncCode](https://github.com/Mohitur669/Realtime-Collaborative-Code-Editor) Realtime Collaborative Code Editor.

---

## 🏗️ Architecture

```
backend/
├── src/
│   ├── config/          # DB, Swagger, app config
│   ├── controllers/     # HTTP handlers (thin layer)
│   ├── middlewares/     # Auth, validate, rate-limit, error handler
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express routers
│   ├── services/        # Business logic
│   ├── utils/           # Logger, API response, constants
│   └── validators/      # Joi schemas
├── tests/               # Jest + Supertest integration tests
├── app.js               # Express app factory
├── server.js            # HTTP server entrypoint
├── .env                 # Your local env vars (git-ignored)
├── .env.example         # Template
└── package.json
```

---

## ⚙️ Tech Stack

| Layer          | Technology                        |
|----------------|-----------------------------------|
| Framework      | Express 4                         |
| Database       | MongoDB + Mongoose                |
| Authentication | JWT access + refresh tokens       |
| Password       | bcryptjs (salt rounds 12)         |
| Validation     | Joi                               |
| Security       | Helmet, CORS, express-rate-limit, express-mongo-sanitize |
| Logging        | Winston + daily-rotate-file       |
| Docs           | Swagger UI (`/api/docs`)          |
| Testing        | Jest + Supertest + MongoMemoryServer |

---

## 🚀 Quick Start

### 1. Prerequisites

- Node.js >= 18
- MongoDB running locally (`mongodb://127.0.0.1:27017`) **or** a MongoDB Atlas URI

### 2. Install

```bash
cd backend
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and set your values — especially MONGODB_URI and JWT secrets
```

> **Generate secure JWT secrets:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 4. Run

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server starts on **port 5003** by default.

---

## 📚 API Documentation

Once running, open: **http://localhost:5003/api/docs**

Swagger UI with full request/response schemas and try-it-out support.

---

## 🔑 Authentication Flow

```
1. POST /api/auth/register  →  { user, accessToken }  + refreshToken cookie
2. POST /api/auth/login     →  { user, accessToken }  + refreshToken cookie
3. Use `Authorization: Bearer <accessToken>` header on protected routes
4. POST /api/auth/refresh   →  new accessToken (uses httpOnly cookie)
5. POST /api/auth/logout    →  clears session
```

---

## 📡 API Reference

### Auth  `POST /api/auth/...`
| Method | Path        | Auth | Description              |
|--------|-------------|------|--------------------------|
| POST   | `/register` | –    | Register new user        |
| POST   | `/login`    | –    | Login, get tokens        |
| POST   | `/refresh`  | –    | Refresh access token     |
| POST   | `/logout`   | ✅   | Invalidate session       |
| GET    | `/me`       | ✅   | Current user profile     |

### Users  `GET /api/users/...`
| Method | Path   | Auth  | Description               |
|--------|--------|-------|---------------------------|
| GET    | `/`    | admin | List users (paginated)    |
| GET    | `/:id` | ✅    | Get user profile          |
| PATCH  | `/:id` | ✅    | Update profile/password   |
| DELETE | `/:id` | ✅    | Delete account            |

### Rooms  `POST /api/rooms/...`
| Method | Path                         | Auth | Description              |
|--------|------------------------------|------|--------------------------|
| GET    | `/`                          | ✅   | List accessible rooms    |
| POST   | `/`                          | ✅   | Create room              |
| GET    | `/:roomId`                   | ✅   | Get room details         |
| PATCH  | `/:roomId`                   | ✅   | Update room (owner)      |
| DELETE | `/:roomId`                   | ✅   | Delete room (owner)      |
| POST   | `/:roomId/members`           | ✅   | Add/update member        |
| DELETE | `/:roomId/members/:userId`   | ✅   | Remove member            |
| POST   | `/:roomId/snapshot`          | ✅   | Save code snapshot       |

### Health  `GET /api/health`
Returns server status and DB connectivity.

---

## 🔐 Security Features

- **bcrypt** password hashing (configurable salt rounds, default 12)
- **JWT** access tokens (15 min TTL) + refresh tokens (7 days), refresh tokens stored **hashed** in DB
- **Helmet** HTTP security headers
- **CORS** allowlist from `CORS_ORIGINS` env var
- **Rate limiting**: 100 req/15min general; 10 req/15min on auth endpoints
- **express-mongo-sanitize**: prevents NoSQL injection
- **Joi validation** on all inputs (type coercion + unknown field stripping)
- **httpOnly cookies** for refresh tokens (XSS protection)
- Passwords **never returned** in API responses (`select: false`)

---

## 🧪 Running Tests

```bash
npm test
```

Tests use an in-memory MongoDB instance (no external DB required).

```bash
npm run test:coverage   # with coverage report
```

---

## 🌍 Environment Variables

| Variable               | Required | Default                            | Description                        |
|------------------------|----------|------------------------------------|------------------------------------|
| `NODE_ENV`             | –        | `development`                      | Environment                        |
| `PORT`                 | –        | `5003`                             | Server port                        |
| `MONGODB_URI`          | –        | `mongodb://127.0.0.1:27017/...`    | MongoDB connection string          |
| `MONGODB_DB`           | –        | `synccode`                         | Database name                      |
| `JWT_ACCESS_SECRET`    | ✅       | *(dev default)*                    | Access token signing secret        |
| `JWT_REFRESH_SECRET`   | ✅       | *(dev default)*                    | Refresh token signing secret       |
| `JWT_ACCESS_EXPIRES_IN`| –        | `15m`                              | Access token TTL                   |
| `JWT_REFRESH_EXPIRES_IN`| –       | `7d`                               | Refresh token TTL                  |
| `CORS_ORIGINS`         | –        | `http://localhost:3000,...`        | Comma-separated allowed origins    |
| `RATE_LIMIT_WINDOW_MS` | –        | `900000`                           | Rate limit window (ms)             |
| `RATE_LIMIT_MAX`       | –        | `100`                              | Max requests per window            |
| `AUTH_RATE_LIMIT_MAX`  | –        | `10`                               | Auth endpoint rate limit           |
| `BCRYPT_SALT_ROUNDS`   | –        | `12`                               | bcrypt salt rounds                 |
| `LOG_LEVEL`            | –        | `info`                             | Winston log level                  |
| `LOG_DIR`              | –        | `logs`                             | Log file directory                 |

---

## 📝 Example Requests

### Register
```bash
curl -X POST http://localhost:5003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"SecurePass1"}'
```

### Login
```bash
curl -X POST http://localhost:5003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"SecurePass1"}'
```

### Create Room (with token)
```bash
curl -X POST http://localhost:5003/api/rooms \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My JS Room","language":"javascript","isPublic":true}'
```

### Get Current User
```bash
curl http://localhost:5003/api/auth/me \
  -H "Authorization: Bearer <your_access_token>"
```

### Health Check
```bash
curl http://localhost:5003/api/health
```
