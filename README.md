# RefinoText

Production-ready SaaS AI writing humanizer.

## Tech Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS
- **Clerk** — authentication
- **Neon PostgreSQL** + **Prisma** — database
- **Google Gemini** — AI humanization
- **Polar** — payments & subscriptions
- **Vercel** — deployment

## Getting Started

1. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in credentials in `.env.local`:
   - [Clerk](https://clerk.com) — publishable & secret keys
   - [Neon](https://neon.tech) — `DATABASE_URL`
   - [Google AI Studio](https://aistudio.google.com) — `GEMINI_API_KEY`
   - [Polar](https://polar.sh) — access token & webhook secret

3. Install dependencies and run:

   ```bash
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── (marketing)/     # Landing & pricing
│   ├── (auth)/          # Clerk sign-in / sign-up
│   ├── dashboard/       # Protected app area
│   └── api/             # API routes & webhooks
├── components/          # Shared UI components
├── lib/                 # Clients & utilities
└── types/               # Shared TypeScript types
prisma/
└── schema.prisma        # Database schema (models TBD)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Prisma Studio |

## Deployment

Deploy to [Vercel](https://vercel.com). Set all environment variables from `.env.example` in the Vercel project settings.
