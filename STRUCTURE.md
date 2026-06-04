# Project Structure

```
saas-app/
├── convex/                          # Convex backend
│   ├── _generated/                  #   Auto-generated types & API
│   │   ├── api.d.ts
│   │   ├── api.js
│   │   ├── dataModel.d.ts
│   │   ├── server.d.ts
│   │   └── server.js
│   ├── auth.config.ts               #   Convex auth config
│   ├── credits.ts                   #   Credits queries & mutations
│   ├── crons.ts                     #   Cron jobs (reset credits)
│   ├── processVideo.ts              #   Video processing action
│   ├── projects.ts                  #   Projects queries & mutations
│   ├── schema.ts                    #   DB schema
│   ├── tsconfig.json
│   └── users.ts                     #   Users queries & mutations
├── public/                          # Static assets (kosong)
├── src/
│   ├── app/
│   │   ├── (dashboard)/             # Route group: dashboard
│   │   │   ├── layout.tsx           #   Dashboard layout (sidebar)
│   │   │   └── dashboard/
│   │   │       ├── page.tsx         #   Dashboard utama
│   │   │       ├── new/
│   │   │       │   └── page.tsx     #   Proyek Baru (form YouTube)
│   │   │       ├── projects/
│   │   │       │   ├── page.tsx     #   Daftar proyek
│   │   │       │   └── [id]/
│   │   │       │       └── page.tsx #   Detail proyek
│   │   │       └── settings/
│   │   │           └── page.tsx     #   Pengaturan user
│   │   ├── (public)/                # Route group: public pages
│   │   │   ├── layout.tsx           #   Public layout (Navbar + Footer)
│   │   │   ├── login/
│   │   │   │   └── page.tsx         #   Halaman login
│   │   │   ├── signup/
│   │   │   │   └── page.tsx         #   Halaman signup
│   │   │   └── pricing/
│   │   │       └── page.tsx         #   Halaman pricing
│   │   ├── admin/                   # Admin pages
│   │   │   ├── layout.tsx           #   Admin layout (dark sidebar)
│   │   │   ├── page.tsx             #   Admin overview
│   │   │   ├── users/
│   │   │   │   └── page.tsx         #   Manage users
│   │   │   └── settings/
│   │   │       └── page.tsx         #   Platform settings
│   │   ├── api/                     # API routes
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/
│   │   │   │   │   └── route.ts     #   NextAuth handler
│   │   │   │   └── token/
│   │   │   │       └── route.ts     #   Auth0 ID token for Convex
│   │   │   └── process-video/
│   │   │       └── route.ts         #   Video processing API
│   │   ├── auth/
│   │   │   └── [auth0]/
│   │   │       (empty)              #   Auth0 callback route
│   │   ├── globals.css              # Global styles + Tailwind v4
│   │   ├── layout.tsx               # Root layout (fonts, html)
│   │   └── page.tsx                 # Landing page
│   ├── components/
│   │   ├── admin/
│   │   │   ├── admin-guard.tsx      #   Admin access guard
│   │   │   └── sidebar.tsx          #   Admin sidebar
│   │   ├── dashboard/
│   │   │   ├── sidebar.tsx          #   Dashboard sidebar
│   │   │   └── user-sync.tsx        #   Auto-sync user ke Convex
│   │   ├── landing/
│   │   │   ├── cta.tsx
│   │   │   ├── features.tsx
│   │   │   ├── hero.tsx
│   │   │   ├── how-it-works.tsx
│   │   │   └── testimonials.tsx
│   │   ├── layout/
│   │   │   ├── footer.tsx
│   │   │   └── navbar.tsx
│   │   └── ui/
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       └── toast.tsx
│   ├── lib/
│   │   ├── api.ts                   #   API helpers
│   │   ├── auth.ts                  #   Auth utilities
│   │   ├── convex-client.ts         #   Convex client init
│   │   └── utils.ts                 #   Utility functions (cn, etc.)
│   └── providers/
│       ├── auth.tsx                 #   Auth provider
│       ├── convex-auth-bridge.tsx   #   Auth0 → Convex bridge
│       └── providers.tsx            #   Root providers wrapper
├── .env.local                       # Environment variables
├── .gitignore
├── AGENST.md                        # Project brief
├── Bug.md                           # Bug tracking
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── PROGRESS.md                      # Progress tracking
├── STRUCTURE.md                     # This file
├── tsconfig.json
└── tsconfig.tsbuildinfo
```
