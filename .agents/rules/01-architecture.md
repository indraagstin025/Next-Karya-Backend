---
trigger: always_on
---

# 01 — Architecture & Next.js Rules

## Scope

Rules for a production CMS using **Next.js App Router, React, TypeScript, Prisma, PostgreSQL, and Tailwind CSS**. Apply together with the other CMS rule files.

## Core Principles

Prioritize security, authorization, data integrity, correctness, maintainability, and performance. Never sacrifice security or data integrity for convenience.

## Next.js Architecture

- Follow the existing App Router structure and official conventions. Use `app/` for routes and layouts, `components/` for reusable UI, `lib/` for shared server utilities, and `prisma/` for schema and migrations.
- Use **Server Components by default**. Add `'use client'` only for interactivity, browser APIs, or client-side state.
- Keep Prisma, secrets, and privileged business logic on the server. Never import database code into Client Components.
- Use Server Actions for suitable UI mutations. Use Route Handlers (`app/api/.../route.ts`) for APIs, webhooks, or external integrations—not for every ordinary page interaction.
- Treat every Server Action and Route Handler as a public entry point: authenticate, authorize, and validate inside it.

## Business Logic & Data Access

Use a simple flow:

```text
Request → Authentication → Authorization → Validation
        → Business Logic → Prisma → PostgreSQL
```

- Keep pages and components focused on rendering. Put meaningful workflows in small, focused server-side functions or services.
- Avoid unnecessary Repository, DTO, manager, or abstraction layers. Add them only for a real requirement.
- Use Prisma for normal queries and mutations. Define relations and constraints in `schema.prisma`; use migrations for schema changes.
- Return only the data the UI needs. Use explicit query `select` fields for sensitive or large records.
- Keep admin routes and public pages clearly separated, for example `/admin/posts` and public post routes.

## Existing Project & Dependencies

- Inspect the current structure and reuse existing authentication, permissions, components, utilities, and conventions before changing code.
- Make the smallest change that solves the task. Do not refactor unrelated code.
- Before adding packages, verify the need, maintenance status, compatibility, and existing alternatives. Never invent APIs or package methods.
