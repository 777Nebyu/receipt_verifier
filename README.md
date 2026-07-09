# Receipt Verification System

A full-stack web application for verifying Ethiopian digital payment receipts from Telebirr, Commercial Bank of Ethiopia, and Bank of Abyssinia.

The system allows users to sign in, verify receipts by reference number or receipt URL, upload receipt images for OCR-assisted extraction, and review verification history. Admin users can manage merchant accounts, view verification logs, and see summary statistics.

## Technology Stack

- Frontend: React, Vite, plain CSS, Recharts
- Backend: Node.js, Express.js
- Architecture: MVC-style backend structure with separate routes, controllers, models, middleware, services, and client
- Database: PostgreSQL
- Security: JWT authentication, bcrypt password hashing, role-based authorization, Helmet, validation, and rate limiting
- Logging: Morgan request logging and Winston application/error logging
- File/OCR features: Multer uploads and Tesseract.js OCR

## Main Features

- User login with JWT-based sessions
- Secure password storage using bcrypt hashing
- Role-based access control for admin and merchant users
- Admin dashboard for user management, logs, and verification statistics
- Receipt verification through provider integrations
- Receipt image upload with OCR text extraction
- Verification history per user, with admin access to all records
- Relational database schema with users, providers, receipts, verification results, logs, and password reset records
- Request logging, application logging, input validation, rate limiting, and basic security headers

## Project Structure


client/                 React frontend
server/                 Express backend
server/config/          Database configuration
server/controllers/     Request handlers
server/database/        Database DDL
server/middleware/      Authentication, authorization, and validation middleware
server/models/          Database access logic
server/routes/          API route definitions
server/services/        OCR and provider verification logic
server/utils/           Logger configuration


## Tree Structure for Receipt Verification System
.
|   README.md
|   
+---client
|   |   .oxlintrc.json
|   |   index.html
|   |   package-lock.json
|   |   package.json
|   |   vite.config.js
|   |   
|   |           
|   +---public
|   |       favicon.svg
|   |       icons.svg
|   |       
|   \---src
|       |   App.css
|       |   App.jsx
|       |   index.css
|       |   main.jsx
|       |   
|       \---assets
|               hero.png
|               
\---server
    |   app.js
    |   eng.traineddata
    |   package-lock.json
    |   package.json
    |   
    +---config
    |       db.js
    |       
    +---controllers
    |       adminController.js
    |       authController.js
    |       receiptController.js
    |       
    +---database
    |       schema.sql
    |       
    |       
    +---middleware
    |       authMiddleware.js
    |       roleMiddleware.js
    |       validate.js
    |       
    +---models
    |       Receipt.js
    |       User.js
    |       
    +---routes
    |       adminRoutes.js
    |       authRoutes.js
    |       receiptRoutes.js
    |       
    +---services
    |       ocrService.js
    |       pdfService.js
    |       providerService.js
    |       
    +---uploads
    |       .gitkeep
    |
    \---utils
            logger.js
            


## Setup and Run

1. Create the PostgreSQL database.

```bash
createdb receipt_verification
psql receipt_verification < server/database/schema.sql
```

2. Configure and start the backend API.

```bash
cd server
npm install
npm run dev
```

3. Start the React client in a second terminal.

```bash
cd client
npm install
npm run dev
```
.env sample code
```bash
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JWT_SECRET=secretCode
DATABASE_URL=postgres://postgres:postgres@localhost:5432/receipt_verification
```

The API runs on `http://localhost:5000` and the client runs on `http://localhost:5173`.

## API Overview

- `POST /api/auth/register` - create the first admin account
- `POST /api/auth/login` - sign in and receive a JWT
- `GET /api/auth/me` - get the current authenticated user
- `PUT /api/auth/me` - update profile details
- `POST /api/receipt/verify` - verify a receipt by provider/reference/URL/QR data
- `POST /api/receipt/upload` - upload a receipt image and extract receipt data
- `POST /api/receipt/scan` - verify scanned receipt data
- `GET /api/receipt/history` - view verification history
- `GET /api/admin/users` - list users, admin only
- `POST /api/admin/users` - create merchant users, admin only
- `PUT /api/admin/users/:id` - update users, admin only
- `DELETE /api/admin/users/:id` - deactivate users, admin only
- `GET /api/admin/logs` - view verification logs, admin only
- `GET /api/admin/stats` - view verification statistics, admin only

## Verification Providers

- Telebirr: `https://transactioninfo.ethiotelecom.et/receipt/{reference}`
- BOA: `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={reference}{last5AccountDigits}`
- CBE legacy PDF: `https://apps.cbe.com.et:100/?id={reference}{last8AccountDigits}`

## Database

The database DDL is included in:


server/database/schema.sql




Main tables:

- `users`
- `receipt_providers`
- `receipts`
- `verification_results`
- `verification_logs`
- `password_reset_tokens`

## Extra Features 

- OCR-assisted receipt upload using Tesseract.js
- Third-party provider verification integrations
- Admin statistics with Recharts
- Rate limiting with express-rate-limit
- Structured logging with Winston
- Request logging with Morgan
- Input validation with express-validator
- File upload handling with Multer


