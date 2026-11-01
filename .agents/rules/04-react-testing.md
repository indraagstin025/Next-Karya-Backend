---
trigger: always_on
---

# 04 — React, TypeScript & Quality Rules

Rules for the App Router UI, Tailwind CSS, testing, logging, deployment, and code review.

## React & TypeScript

- Use Server Components by default. Use Client Components only when browser-side interaction or state is required. Never access Prisma or server secrets from client code.
- Use TypeScript types for props, database-facing data, and action results. Avoid `any`; validate external data at runtime.
- Return only the fields the UI needs. Do not pass complete database records or sensitive properties to the client.
- Keep state minimal and avoid duplicating server state unnecessarily. Extract reusable components when they improve consistency or clarity—not for every small JSX fragment.

## Tailwind & Accessibility

- Follow the project's existing Tailwind conventions, design tokens, and component patterns. Avoid introducing another styling system without a clear need.
- Build responsive layouts with semantic HTML, accessible labels, keyboard support, visible focus states, and appropriate contrast.
- Forms should show pending, success, and error states. Client-side validation improves UX, but server-side validation and authorization remain authoritative.

## Testing

- Follow the project's existing test tools and conventions; do not add a framework without a reason.
- Test important business logic, Server Actions, Route Handlers, validation, authentication, authorization, CRUD, publishing, and uploads.
- Include negative security cases: unauthenticated access, missing permissions, wrong ownership, manipulated IDs, invalid payloads, unsafe files, and privilege escalation.
- Use integration tests for database behavior and the production database engine when PostgreSQL-specific behavior matters. Use browser/E2E tests for critical flows; these do not replace server-side tests.
- Do not add meaningless tests just to raise coverage numbers.

## Logging, Deployment & Review

- Audit sensitive actions where appropriate, such as role changes, publishing, user administration, media changes, and exports. Never log passwords, tokens, or secrets.
- Keep production secrets in environment configuration, use HTTPS, back up the database, and run Prisma production migrations with the project's deployment process (for example, `prisma migrate deploy`).
- Before implementing a feature, consider authorization, validation, database changes, performance, cache invalidation, audit needs, and tests. State important assumptions briefly.
- Review in this order: security, authorization, data integrity, validation, business logic, query performance, maintainability, then style. Fix root causes and avoid unrelated changes.
- Consider a feature complete only when it is secure, correct, maintainable, testable, and performant.
