<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## BootVerse Skills workflow

Before implementation, inspect the installed Codex Skills, identify those relevant to the task and read each selected `SKILL.md` before applying it. Use complementary Skills when helpful; avoid unnecessary or conflicting Skills.

Prioritize these Skills for BootVerse development when their scope applies:

- `ui-ux-pro-max`
- `frontend-ui-engineering`
- `api-and-interface-design`
- `code-review-and-quality`
- `security-and-hardening`
- `test-driven-development`
- `playwright`
- `performance-optimization`

Follow the existing architecture, coding conventions and design system. Preserve working functionality. After implementation, run relevant tests, review the changes, verify responsive UI when applicable, and assess security and performance implications. Report which Skills were actually used; only claim use when their instructions were successfully loaded and followed. Report failed or unperformed checks honestly.
