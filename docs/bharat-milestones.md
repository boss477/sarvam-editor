# Bharat Editor implementation

## Source and stack

The base is https://github.com/OpenCut-app/opencut-classic (MIT), cloned into
`bharat-editor`. The original repository and license are retained. Upstream's
current main repository is a Rust rewrite; this checkout uses the classic web
editor, Next.js/React, Bun, Mediabunny, and the published OpenCut WASM core.

Existing project storage is IndexedDB/OPFS in the browser. Timeline operations
must go through EditorCore commands so undo, selection, and autosave work.
Platform-independent domain logic belongs in Rust under the upstream AGENTS.md.
New TypeScript integrations are platform adapters for HTTP and browser APIs.

## Acceptance criteria

### Milestone 0: runnable base

- Pin the classic editor source and retain MIT attribution.
- Install dependencies and run the editor locally.
- Open a project, import a local video, split/trim, save/reload, and export.
- Record verified behavior and any existing upstream build errors.

### Milestone 1: Sarvam workflows

- Keep SARVAM_API_KEY on the server; return actionable configuration errors.
- Transcribe timeline audio into editable timestamped captions.
- Translate caption tracks while preserving timing and original tracks.
- Generate voice tracks and align their segments to caption times.
- Export selected language versions with matching captions/audio.
- Verify requests with mocked API contracts and real credentials when available.

### Milestone 2: agents

- Share validated action schemas between MCP and Sarvam function calling.
- Target an explicitly connected browser project; reject stale connections.
- Support state, import, split/trim, captions, translation, dub, export, undo/redo.
- Run an actual MCP tool call against the open editor and verify the timeline.
- Verify Sarvam's tool-call/result loop without exposing API credentials.

### Milestone 3: motion and release

- Integrate reusable motion graphics through existing graphic/animation commands.
- Evaluate Remotion/HyperFrames/GSAP adapters and their licenses before adoption.
- Verify Indic font rendering, subtitle files, mobile layout, and exported media.
- Document installation, credentials, MCP setup, and tested limitations.

## Credential state

The Shotcut/MLT, LosslessCut and Kdenlive study is recorded in
[editor-references.md](editor-references.md), including current feature gaps and
the distinction between implementation evidence and live-service verification.

The earlier `your_key` Sarvam MCP registration was replaced with an environment-file
wrapper in both the parent folder and editor checkout. Official server v0.2.12 tool
discovery (36 tools) and a builder API-reference lookup pass without a key. Actual
authenticated requests remain unverified: `SARVAM_API_KEY` is blank locally.
Claude's current auth status is logged out, so the Claude kickoff also remains
incomplete. Codex can implement and run the app independently. No credentials are
committed or printed; configure the key and log Claude in locally to clear these gates.
