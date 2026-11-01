---
trigger: always_on
---

# 03 — Database, Performance & CMS Rules

Rules for Prisma, PostgreSQL, CMS workflows, media, caching, and public content.

## Data Integrity

- Treat PostgreSQL as the source of truth. Model relations explicitly in Prisma and use foreign keys, unique constraints, required fields, and indexes where appropriate.
- Enforce important rules in the database as well as application validation. Do not index every field; base indexes on actual query patterns.
- Protect unique slugs with a database constraint and handle conflicts caused by concurrent requests.
- Use Prisma `$transaction` when related database operations must succeed or fail together. Consider race conditions for slugs, publishing, ordering, counters, and bulk changes.
- Use UUID/ULID or soft deletes only when the project has a concrete requirement. IDs never replace authorization.

## Queries & Performance

- Avoid N+1 queries, unbounded queries, and fetching full records unnecessarily. Select only needed fields and paginate growing lists.
- Do not fetch entire tables for normal CMS screens. Add indexes or caching only when justified by query patterns or measurement.
- Use transactions for database consistency, but do not hold them open during slow external work.

## CMS Content Workflow

- Use a consistent typed status model, such as `draft`, `review`, `scheduled`, `published`, and `archived`, when those states are needed.
- Treat publishing as a business operation: check authorization, validate required content and dates, update related data transactionally where needed, record audit information when appropriate, and invalidate affected caches.
- Do not let arbitrary status updates bypass publishing rules. Consider revision history for important content.
- Public queries must return only content that is intended to be public, such as published posts whose publication time has arrived.

## Media, Bulk Work & Caching

- Store media metadata in PostgreSQL and file bytes in controlled file/object storage. Track fields such as path, MIME type, size, alt text, and uploader where needed.
- Validate and authorize every record in bulk operations. Limit batch sizes and use transactions where appropriate. Use background jobs for expensive imports, exports, image processing, email, or sitemap work when the project supports them.
- Cache only where useful. After content changes, invalidate the affected Next.js cache using the project's supported approach, such as `revalidatePath` or `revalidateTag`.

## SEO & Public Pages

- Store appropriate metadata such as title, slug, excerpt, meta description, canonical URL, Open Graph image, status, and publication date when needed.
- Use Next.js Metadata APIs for page metadata. Validate canonical URLs and redirects; do not accept arbitrary unsafe destinations.
- When a published slug changes, consider redirects, existing links, SEO impact, and cache invalidation.
