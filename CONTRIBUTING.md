# Contributing to Sarvam Editor

Thanks for helping. This is a community fork of OpenCut Classic with Sarvam AI features; keep
upstream behaviour intact unless a change is about the Indian-language workflow.

## Ground rules

- Be kind. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- Open an issue before a large change so we can agree on the approach.
- Keep pull requests focused: one change, one reason.
- Never commit credentials. `SARVAM_API_KEY` and `EDITOR_AGENT_TOKEN` are server-only and live in
  `apps/web/.env.local`, which is git-ignored.

## Setup

Requires [Bun](https://bun.sh/) and a modern browser with media codec support.

```powershell
git clone https://github.com/boss477/sarvam-editor.git
cd sarvam-editor
Copy-Item apps/web/.env.example apps/web/.env.local
bun install
cd apps/web
bun run dev --port 3015
```

If Next.js cannot resolve a dependency on Bun 1.3 or newer, reinstall with
`bun install --linker hoisted`.

## Before you open a pull request

- `bun test` passes in `apps/web` for the area you touched.
- `bun run lint:web` is clean for the files you changed.
- You tried the change in the editor at `localhost:3015`.
