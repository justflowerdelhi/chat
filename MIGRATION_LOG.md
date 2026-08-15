# Project Flora Migration Log

## Scope
Extraction target: Florist Mitra AI components from IFA into a new Project Flora solution folder.

Source root: `d:/ifa`

Target root: `d:/ifa/project-flora`

Behavior policy: copied modules are unchanged at code level unless explicitly listed in namespace changes.

## Copied Modules

### API Routes
- `src/app/api/florist-mitra/chat/route.ts` -> `project-flora/src/app/api/florist-mitra/chat/route.ts`
- `src/app/api/florist-mitra/sessions/route.ts` -> `project-flora/src/app/api/florist-mitra/sessions/route.ts`
- `src/app/api/florist-mitra/sessions/[id]/route.ts` -> `project-flora/src/app/api/florist-mitra/sessions/[id]/route.ts`

### UI Pages
- `src/app/dashboard/florist-mitra/page.tsx` -> `project-flora/src/app/dashboard/florist-mitra/page.tsx`
- `src/app/admin/florist-mitra/page.tsx` -> `project-flora/src/app/admin/florist-mitra/page.tsx`

### Direct Library Dependencies
- `src/lib/floristPrompt.ts` -> `project-flora/src/lib/floristPrompt.ts`
- `src/lib/auth.ts` -> `project-flora/src/lib/auth.ts`
- `src/lib/db.ts` -> `project-flora/src/lib/db.ts`
- `src/types/user.ts` -> `project-flora/src/types/user.ts`

### Database Migrations (Feature-Specific)
- `db/migrations/024_create_chat_sessions.sql` -> `project-flora/db/migrations/024_create_chat_sessions.sql`
- `db/migrations/025_create_member_usage.sql` -> `project-flora/db/migrations/025_create_member_usage.sql`

## Changed Namespaces

### Filesystem Namespace Changes
- Root path namespace changed from `d:/ifa/...` to `d:/ifa/project-flora/...` for all copied modules.

### Code Namespace Changes
- None.
- Import aliases (for example `@/lib/...`) were not modified.
- Cookie key, table names, and route behavior were not modified.

## Unresolved Dependencies

### Database Schema Dependencies Not Included In This Extraction
The copied Florist Mitra modules reference tables outside copied migrations:
- `members`
- `users`

Reason:
- `chat_sessions.user_id` and `member_usage.user_id` both reference `members(id)`.
- `getCurrentUser()` reads from `users` and joins membership identity via `member_id`.

### Runtime Environment Dependencies
Required environment variables:
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `SESSION_SECRET`

### Framework/Build Dependencies
The extracted files depend on Next.js App Router runtime and packages from IFA solution, including:
- `next`
- `react`
- `openai`
- `pg`
- `react-markdown`
- `lucide-react`

### Alias Resolution Dependency
- Path alias `@/*` must exist in Project Flora TypeScript config for imports to resolve.

### Integration Dependencies Not Included
The copied dashboard/admin pages are feature pages only; broader shell integration remains external:
- parent layouts/navigation wiring
- auth/login/logout UX flow
- support APIs used by unrelated dashboard shell components

## Verification Notes
- Copy operation completed with no file content edits in extracted modules.
- No code behavior changes were introduced during extraction.
