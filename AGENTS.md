# Agents Guide

This repository is configured for autonomous agents working in Cursor. Read these documents first:

- Architecture overview: `dev/ARCHITECTURE.md`
- Development guide and roadmap: `dev/DEVELOPMENT.md`

## Operating Procedure
1. Read `dev/ARCHITECTURE.md` to understand the system and constraints (Next.js 14, TypeScript, Vercel serverless).
2. Review `dev/DEVELOPMENT.md` for current status, coding standards, and roadmap.
3. Draft a brief plan before implementation. Keep edits small and reversible.
4. Implement with strict TypeScript, follow project structure, and maintain tests.
5. Verify with:
   - `npm run type-check`
   - `npm run lint`
   - `npm test`
6. Document progress:
   - Add a progress note to `dev/DEVELOPMENT.md` (date, change, rationale, verification).
   - Update `CHANGELOG.md` under [Unreleased] with Added/Changed/Fixed as applicable.

## Environment & Secrets
- Use `.env.local` (never commit secrets). On Vercel, set env vars in project settings.
- Required: `OPENAI_API_KEY`. Optional: `GITHUB_TOKEN`.

## Testing & Safety
- Tests must pass locally with Jest. Use `__mocks__/openai.js`; do not call real APIs.
- Avoid large, breaking edits. Prefer incremental, typed changes with clear error handling.

## Deployment
- The app targets Vercel. Keep serverless constraints in mind (timeouts/memory).
- Do not introduce long-running synchronous operations in API routes.

For further details, consult the linked docs above and `.cursorrules` in the repo root.

