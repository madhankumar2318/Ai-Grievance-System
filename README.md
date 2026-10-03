# 🏛️ AI Grievance System

Enterprise civic grievance reporting and triage portal powered by **Next.js 16 (Frontend)**, **Java Spring Boot 3.2 (Backend)**, **Google Gemini AI**, and **PostgreSQL / Supabase**.

---

## 📁 Project Structure

```
ai-grievance-system/
├── frontend/             # Next.js 16.3.8 Application (Port 3000)
│   ├── src/              # App router, components, context, and server actions
│   ├── public/           # Static assets, icons, and service workers
│   ├── next.config.ts    # CSP headers, HSTS, and image domain config
│   ├── tsconfig.json     # TypeScript configuration
│   └── package.json      # Frontend dependencies
│
├── backend/              # Enterprise Java Spring Boot Backend (Port 8080)
│   ├── src/              # Controllers, services, JPA models, and security filters
│   ├── pom.xml           # Maven dependencies (Spring Boot 3.2.12)
│   └── ...
│
├── package.json          # Root Monorepo runner scripts
├── .gitignore            # Git ignore rules for both frontend & backend
└── README.md
```

---

## 🚀 Running the Project

### Option A: From the Root Directory

You can run commands directly from the root of the project:

```bash
# Start Next.js Frontend (http://localhost:3000)
npm run dev

# Build Frontend
npm run build

# Start Spring Boot Backend (http://localhost:8080)
npm run backend:dev

# Compile Spring Boot Backend
npm run backend:build
```

---

### Option B: Running in Individual Folders

#### 1. Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### 2. Backend (Spring Boot)
```bash
cd backend
mvn spring-boot:run
```
Backend API will be live at [http://localhost:8080](http://localhost:8080).

---

## 🛡️ Enterprise Security Highlights
- **Edge Route Guards & RBAC:** Cryptographic HMAC-SHA256 JWT checks at the edge (`proxy.ts`).
- **Active Token Revocation:** In-memory sliding-window token blacklist on logout (`TokenBlacklistService`).
- **Dual-Layer Rate Limiting:** Sliding-window rate limiters on both Next.js Server Actions and Spring Boot servlet filters.
- **Injection Immunities:** Stored XSS tag stripping, prompt injection XML quarantine, and Leaflet DOM-XSS entity escaping.
- **Data Minimization:** High-entropy tracking IDs (`GRV-YYYY-XXXXXXXX`) and PII email masking (`r***r@gmail.com`).
- **Encrypted Database Transport:** PostgreSQL TLS enforced via `?sslmode=require`.
