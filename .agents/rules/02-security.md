---
trigger: always_on
---

# 02 — Security & Authorization Rules

Apply these rules to every protected CMS feature and together with the other rule files.

## Authentication & Authorization

- Authentication is not authorization. Verify the current user and their permission on **every Server Action, Route Handler, and protected data operation**.
- Frontend guards, hidden buttons, and disabled controls are UX only—not security controls.
- Check both the required capability and access to the specific record, including ownership or tenant boundaries where applicable. Never trust a client-supplied ID.
- Keep role/permission checks server-side. Do not allow users to grant themselves privileges or change protected fields such as `role`, `permissions`, `userId`, `authorId`, or approval status.
- Use the project's existing authentication and authorization solution; do not introduce a new one without a clear reason.

## Input & Data Safety

- Validate all external input on the server, including types, lengths, allowed values, relationships, IDs, pagination, and business rules. Use the project's existing schema validator (for example, Zod if installed).
- Accept only expected fields. Do not spread raw request payloads directly into Prisma `create` or `update` data.
- Never expose password hashes, session/reset tokens, secrets, private records, or unnecessary fields to the client.
- Keep secrets server-only. Never put secrets in `NEXT_PUBLIC_*` variables or commit `.env` files.

## Common Vulnerabilities

- React escapes text by default. Do not render untrusted HTML with `dangerouslySetInnerHTML` unless it has been sanitized with a strict allowlist.
- Prefer Prisma's parameterized queries. Never interpolate untrusted input into raw SQL; avoid unsafe raw-query APIs for user-controlled values.
- Validate file size, type, and content on the server. Generate safe filenames and control storage paths; never trust the supplied filename or MIME type.
- Validate redirect destinations and URLs. Do not allow arbitrary open redirects or unsafe embeds.
- Use the framework's session, cookie, and request protections correctly. Never disable security protections just to make a request work.

## Abuse & Error Handling

- Apply rate limits to login, password reset, public forms, uploads, expensive searches, and bulk actions where appropriate.
- Return safe error messages; do not expose stack traces, SQL, filesystem paths, tokens, or environment variables in production.
- Log relevant security events without logging passwords, tokens, or secrets.
- Before completion, review authentication bypass, unauthorized record access, mass assignment, XSS, SQL injection, unsafe uploads, privilege escalation, and sensitive data exposure.
