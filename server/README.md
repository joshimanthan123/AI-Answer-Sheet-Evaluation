# AI-Based Answer Sheet Evaluation System - Backend (Phase 1)

This project contains **Phase 1** (Backend Architecture & Authentication Foundation) of the AI-Based Answer Sheet Evaluation System. Built on a production-ready, security-hardened Express.js skeleton with layered MVC and Service designs.

## Folder Structure

```text
server/
├── docs/
│   └── swagger.yaml               # Swagger API specification skeleton
├── logs/                         # File logs created dynamically by Winston
│   ├── combined.log              # Request logs & general information traces
│   └── error.log                 # Critical/warning errors
├── src/
│   ├── config/                   # Configuration adapters
│   │   ├── db.js                 # MongoDB connection & development mock fallbacks
│   │   ├── env.js                # Environment schema validation
│   │   ├── cors.js               # CORS origins rules
│   │   ├── multer.js             # Upload parameters & restrictions
│   │   └── index.js              # Exposed module interfaces barrel
│   ├── constants/                # Immutable code configuration references
│   │   ├── roles.js              # RBAC roles lists
│   │   ├── statusCodes.js        # Rest API status mapping
│   │   └── messages.js           # API details messages mappings
│   ├── controllers/              # Request-to-response adapters
│   │   └── auth.controller.js    # Login, registration, token operations
│   ├── helpers/                  # Global response formatting and math
│   │   ├── response.js           # Standard REST response layouts
│   │   └── pagination.js         # Page math properties
│   ├── middleware/               # Route interception filters
│   │   ├── auth.middleware.js    # Access validation filters
│   │   ├── role.middleware.js    # Role access checks
│   │   ├── error.middleware.js   # Global exceptions translations
│   │   └── validation.middleware.js # Express validator format validation checks
│   ├── models/                   # Schema constructs
│   │   └── User.js               # User accounts mapping (Student, Faculty, Admin)
│   ├── routes/                   # Endpoint routers definition
│   │   └── auth.routes.js        # Auth routing maps
│   ├── services/                 # Business logic and mock-DB routines
│   │   └── auth.service.js       # Database manipulation operations
│   ├── utils/                    # Shared operational services
│   │   ├── ApiError.js           # Operational error builders
│   │   ├── ApiResponse.js        # Success payload wraps
│   │   ├── asyncHandler.js       # Try-Catch express route handlers wrappers
│   │   ├── generateToken.js      # Token signing helper
│   │   └── logger.js             # Winston file logger mapping
│   └── validators/               # Input filter rules
│       └── auth.validator.js     # Form/request validations
├── uploads/                      # Uploaded answer sheets storage directory
├── app.js                        # express configuration
├── server.js                     # Server entry point
├── package.json                  # Dependencies scripts definitions
├── .env.example                  # Environment template settings
├── .eslintrc.json                # Project lint rules
├── .prettierrc                   # Prettier formatting options
└── .editorconfig                 # Editor spacing configs
```

## Features Implemented in Phase 1

1. **Layered Structure**: Separation of Controllers, Services, Configurations, Middlewares, and Schemas.
2. **ES Modules**: Standard `import` and `export` modern syntax.
3. **Database Fallback (Mock Mode)**: If MONGODB is unavailable on process startup, the server boots in **Mock Mode** using an in-memory db fallback, which enables frontend testing and verification without requiring a local database setup.
4. **Standard Envelope Formats**:
   - Success:
     ```json
     {
       "success": true,
       "message": "Message text",
       "data": {},
       "meta": {}
     }
     ```
   - Error:
     ```json
     {
       "success": false,
       "message": "Error details",
       "errors": [],
       "statusCode": 401
     }
     ```
5. **Secure Authentication**: Password hashing (bcrypt) and access/refresh token generation stored in Secure HTTPOnly Cookies or HTTP Bearer Headers.
6. **Hardened Security**: Helmet and CORS setups, Rate Limiting (5 requests/15m on login routes), and payload Compression.
7. **Detailed Logging**: Winston logging console alerts, saving all records inside `logs/combined.log` and warning details under `logs/error.log`.
8. **Syntax Standards**: Fully configured code styling tools ESLint + Prettier.

## Installation & Setup

1. Navigation:
   ```bash
   cd server
   ```
2. Installation:
   ```bash
   npm install
   ```
3. Environmental Settings:
   Copy `.env.example` as `.env` and adjust setup parameters:
   ```bash
   cp .env.example .env
   ```
4. Execution:
   - Development server (boots via nodemon):
     ```bash
     npm run dev
     ```
   - Production execution:
     ```bash
     npm start
     ```
   - Verify code format style:
     ```bash
     npm run format
     ```
   - Lint syntax checks:
     ```bash
     npm run lint
     ```

## REST API Endpoint Manifest

- **GET `/health`**: General server status check (returns uptime status, mock/live db connection state).
- **POST `/api/v1/auth/register`**: Registers a new Student/Faculty/Admin account.
- **POST `/api/v1/auth/login`**: Authenticates users and returns tokens & cookies.
- **POST `/api/v1/auth/logout`**: Clears authentication status and signs out.
- **GET `/api/v1/auth/profile`**: Authenticated retrieve profile details for current session.
- **POST `/api/v1/auth/refresh`**: Refresh identity session tokens.
- **POST `/api/v1/auth/forgot-password`**: Forgot Password placeholder.
- **POST `/api/v1/auth/reset-password`**: Reset Password placeholder.
