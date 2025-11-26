# Repository Guidelines

## Project Structure & Module Organization
- `backend/` hosts the Express + MongoDB API. Domain logic sits in `controllers/`, `services/`, `models/`, and middleware, with helpers in `utils/`; uploads live in `backend/uploads/` and room seeding in `initializeRoomData.js`.
- `frontend/` contains the WeChat Mini Program: views in `pages/`, reusable UI in `components/`, and HTTP clients in `services/`; shared config/utilities sit in their folders and images in `images/`.
- `docs/` stores deployment and manual QA guides; update the right playbook with behaviour changes. Shell automation (bootstrap, rollout, PM2) is in the repo root and `scripts/`.

## Build, Test, and Development Commands
- `cd backend && npm install` installs API dependencies; rerun after editing `package.json`.
- `npm run dev` starts the backend with nodemon; `npm start` runs the production entry without hot reload.
- `node initializeRoomData.js` seeds conference rooms once MongoDB credentials are configured.
- Frontend work relies on WeChat DevTools: open `frontend/project.config.json`, sync, and run the simulator (no `npm` step needed).

## Coding Style & Naming Conventions
- Use 4-space indentation and semicolons in backend JavaScript; mirror the existing controller/service class structure, `camelCase` variables, and `PascalCase` service names.
- Keep payload keys in `camelCase`, falling back to `snake_case` only for compatibility with live clients.
- If you add linting or formatting, expose it through `npm run lint` so the team can reuse the script.

## Testing Guidelines
- Automated tests are not yet wired; prefer Jest + Supertest coverage under `backend/tests/` and update `npm test` once suites are in place before shipping large backend changes.
- Manual regression steps live in `docs/testing/`; record new scenarios there and attach UI screenshots when relevant.
- Capture console output or API traces when reporting suspected production regressions.

## Commit & Pull Request Guidelines
- Follow the lightweight Conventional style in history: `<type>: summary` (e.g. `fix: 调整预约冲突校验`). Keep subjects under 72 characters and highlight the behaviour touched.
- Squash work-in-progress commits; each PR must cover scope, rollout risk, config changes, and link related issues.
- Provide test evidence (`npm run dev`, Jest output, WeChat simulator screenshots) and list any seeding or config steps reviewers must repeat.

## Deployment & Operations Notes
- Production relies on PM2 via `backend/ecosystem.config.js` and Nginx (`unified_nginx.conf`); keep both in sync with process or route changes.
- Use `deploy_to_production.sh` and `rollback_nginx.sh` for rollouts; avoid ad-hoc server edits not captured in scripts.
- Store secrets in the backend `.env` (keys listed in `backend/config.js`) and never commit credentials—document adjustments in the deployment runbook.
