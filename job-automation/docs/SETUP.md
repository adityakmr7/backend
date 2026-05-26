# ⚙️ Local Development Setup

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20.x | https://nodejs.org |
| Bun | ≥ 1.1.x | `curl -fsSL https://bun.sh/install \| bash` |
| Docker Desktop | Latest | https://www.docker.com/products/docker-desktop |
| Git | Latest | Included on Mac |
| Playwright | Auto | `bunx playwright install chromium` |

---

## Step 1: Clone & Install

```bash
# Navigate to your workspace
cd /Users/adityakumar/Desktop/backend

# Enter the project (already created)
cd job-automation

# Create frontend
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git

# Create backend
mkdir backend && cd backend
bun init -y
bun add elysia @elysiajs/cors @elysiajs/swagger
bun add @prisma/client
bun add playwright cheerio
bun add @google/generative-ai
bun add bullmq ioredis
bun add nodemailer
bun add -d @types/nodemailer prisma
```

---

## Step 2: Environment Variables

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here

# Generate secret: openssl rand -base64 32
```

### Backend (`backend/.env`)
```env
PORT=3001
NODE_ENV=development

# API Key (make up a random string for local use)
API_KEY=your-secret-api-key-here

# Database (Prisma + PostgreSQL via Docker)
DATABASE_URL="postgresql://jobpilot:jobpilot@localhost:5432/jobpilot?schema=public"

# AI
GEMINI_API_KEY=your-gemini-api-key
# Get from: https://aistudio.google.com/app/apikey

# Email (Gmail SMTP)
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
# Get app password: Google Account → Security → 2FA → App Passwords

# Redis (for BullMQ queue — included in Docker Compose)
REDIS_URL=redis://localhost:6379
```

---

## Step 3: Project Structure Setup

```bash
# From job-automation root
mkdir -p docs
mkdir -p backend/src/{routes,services,prisma,prompts,types}

# Create root package.json for running both
cat > package.json << 'EOF'
{
  "name": "job-automation",
  "scripts": {
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\"",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:backend": "cd backend && bun run dev",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "install:all": "cd frontend && npm install && cd ../backend && bun install"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
EOF

npm install
```

---

## Step 4: Backend Entry Point

```typescript
// backend/src/index.ts
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';

const app = new Elysia()
  .use(cors({ origin: 'http://localhost:3000' }))
  .use(swagger({ path: '/docs' }))
  .get('/health', () => ({ status: 'ok', timestamp: new Date() }))
  .listen(process.env.PORT ?? 3001);

console.log(`🚀 JobPilot API running at http://localhost:${app.server?.port}`);
console.log(`📖 API Docs: http://localhost:${app.server?.port}/docs`);
```

```json
// backend/package.json (add scripts)
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "db:generate": "bunx prisma generate",
    "db:migrate": "bunx prisma migrate dev",
    "db:studio": "bunx prisma studio",
    "db:push": "bunx prisma db push"
  }
}
```

---

## Step 5: Docker Compose Setup

Create `docker-compose.yml` in the project root:

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: jobpilot-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: jobpilot
      POSTGRES_PASSWORD: jobpilot
      POSTGRES_DB: jobpilot
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U jobpilot']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: jobpilot-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

```bash
# Start PostgreSQL + Redis
docker compose up -d

# Verify containers are running
docker compose ps
```

---

## Step 6: Prisma Schema

Create `backend/prisma/schema.prisma`:

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Job {
  id            String   @id @default(cuid())
  source        String   // 'yc' | 'lever' | 'greenhouse'
  externalId    String
  title         String
  company       String
  description   String
  applyUrl      String
  applyMethod   String   @default("form") // 'form' | 'email' | 'external'
  applyEmail    String?
  location      String?
  isRemote      Boolean  @default(false)
  ycBatch       String?  // e.g. 'W24', 'S25'
  tags          String[] // PostgreSQL native array
  status        String   @default("new")
  relevanceScore Float?
  notes         String?
  postedAt      DateTime?
  scrapedAt     DateTime @default(now())

  applications  Application[]

  @@unique([source, externalId])  // deduplication key
  @@index([status])
  @@index([company])
}

model Application {
  id               String    @id @default(cuid())
  job              Job       @relation(fields: [jobId], references: [id])
  jobId            String
  resume           Resume?   @relation(fields: [resumeId], references: [id])
  resumeId         String?
  coverLetter      String?
  stage            String    @default("applied")
  submittedAt      DateTime  @default(now())
  interviewDate    DateTime?
  followUpSentAt   DateTime?
  notes            String?
}

model Resume {
  id           String        @id @default(cuid())
  name         String
  filePath     String        // Path to .md file
  textContent  String        // Raw markdown content (for AI)
  tags         String[]
  uploadedAt   DateTime      @default(now())

  applications Application[]
}
```

```bash
# Generate Prisma client
cd backend
bunx prisma generate

# Run first migration
bunx prisma migrate dev --name init

# Open Prisma Studio (visual DB browser)
bunx prisma studio
```

---

## Step 7: Install Playwright Browsers

```bash
cd backend
bunx playwright install chromium
```

---

## Step 8: Run Everything

```bash
# 1. Start database + Redis (Docker)
docker compose up -d

# 2. Start frontend + backend (from project root)
npm run dev
```

Open:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **API Docs**: http://localhost:3001/docs
- **Prisma Studio**: http://localhost:5555 (run `bunx prisma studio` separately)

---

## Docker Management

```bash
# Start all services
docker compose up -d

# Stop all services (keep data)
docker compose stop

# Stop and remove containers (keep volumes/data)
docker compose down

# Full reset — DELETES ALL DATA
docker compose down -v

# View logs
docker compose logs -f postgres
docker compose logs -f redis

# Connect to PostgreSQL directly
docker exec -it jobpilot-db psql -U jobpilot -d jobpilot
```

---

## Useful Commands

```bash
# Backend
cd backend
bun run dev              # Start with hot reload
bun run db:generate      # Regenerate Prisma client after schema changes
bun run db:migrate       # Create + run new migration
bun run db:studio        # Open Prisma Studio (visual DB browser)
bun run db:push          # Push schema without migration (quick dev iteration)

# Frontend
cd frontend
npm run dev              # Start Next.js
npm run build            # Production build
npm run lint             # Run ESLint

# Playwright debugging
cd backend
bunx playwright codegen https://www.workatastartup.com/jobs
# Opens browser + records your actions as code
```

---

## Troubleshooting

### Playwright fails to launch
```bash
# Install system dependencies (if needed)
bunx playwright install-deps chromium
```

### Gmail SMTP auth fails
1. Enable 2FA on your Google Account
2. Go to: Account → Security → 2-Step Verification → App Passwords
3. Create password for "Mail" on "Mac"
4. Use the 16-character code as `GMAIL_APP_PASSWORD`

### PostgreSQL connection refused
```bash
# Make sure Docker is running and containers are up
docker compose up -d
docker compose ps  # Both should show 'running'

# Test connection
docker exec -it jobpilot-db pg_isready -U jobpilot
```

### Prisma client not found
```bash
# Regenerate after any schema change
cd backend && bunx prisma generate
```

### Port already in use
```bash
# Kill whatever is on port 3001
lsof -ti:3001 | xargs kill -9

# PostgreSQL port conflict (if local Postgres running)
docker compose down
# Change port in docker-compose.yml: '5433:5432' instead
# Update DATABASE_URL accordingly: localhost:5433
```
