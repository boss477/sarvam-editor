# Sarvam Editor (formerly Bharat Editor)

Local development fork of OpenCut Classic for Indian creator workflows.
Upstream commit: cf5e79e919144200294fb9fed22a222592a0aeea. MIT license retained.

## Run

From this folder:

```powershell
bun install
cd apps/web
bun run dev --port 3015
```

Open http://localhost:3015. Create a project and import media. The Sarvam button
in the editor header provides transcription, caption translation, voice generation,
and an assistant that executes the same commands exposed to MCP.

Set `SARVAM_API_KEY` in `apps/web/.env.local` and restart the dev server.
No Sarvam key is shipped. AI requests send timeline audio or caption text to Sarvam.
Projects and media remain in this browser's local storage.

For a fresh checkout, copy `apps/web/.env.example` to `apps/web/.env.local`
before starting. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3015` and generate
independent random values for `EDITOR_AGENT_TOKEN` and `BETTER_AUTH_SECRET`.
Use at least 32 random bytes for each; never deploy the example auth secret.
Database, Redis and third-party asset credentials in the upstream example are
placeholders, not provisioned services. Core local editing does not require
Sarvam, but AI operations require a valid key. Keep the development server local.

## MCP

### Official Sarvam Server

The official Sarvam MCP server is distinct from the editor bridge below: it
exposes Sarvam API and builder/reference tools, not editor timeline controls.
The local Claude registrations in both the parent folder and this editor folder
now use `scripts/sarvam-mcp.ts`, replacing the earlier `your_key` registration.
The wrapper loads the ignored environment file through Bun and launches the
official `sarvam-mcp==0.2.12` package through `uvx`. Install uv/uvx and Python 3.11+
for this server. Registration for a fresh checkout, from this folder:

```powershell
claude mcp add sarvam -- bun --cwd "C:/path/to/sarvam-editor" --env-file=apps/web/.env.local scripts/sarvam-mcp.ts
bun scripts/check-sarvam-mcp.ts --reference
```

Change the absolute checkout path when installing elsewhere. Tool discovery and
a `/text-to-speech` builder lookup succeeded without an API key (36 tools).
Authenticated Sarvam operations still require a real key. Builder reference
metadata can lag or disagree with the live docs; it is not a substitute for
live request verification. See [official setup](https://docs.sarvam.ai/api/developer-tools/mcp).

The pinned server includes tool-argument/result telemetry. The wrapper overrides
`SARVAM_MCP_ANALYTICS_URL` to `http://127.0.0.1:0`, a non-listening local endpoint,
so those best-effort telemetry sends cannot reach its external collector. This
does not block requested Sarvam API calls or the package's PyPI update check.
Recheck the telemetry behavior before upgrading the pinned package.

Claude is currently logged out. Run `claude auth login` locally before asking
Claude to read the parent `PLAN.md`; no login or key is included in this checkout.

### Editor Bridge

Set a random `EDITOR_AGENT_TOKEN` in `apps/web/.env.local`. Local setup already
has a generated token. It authenticates local MCP calls and is never sent to Sarvam.
Set `EDITOR_URL=http://localhost:3015` in the same file.

From this folder, register the editor with Claude:

```powershell
claude mcp add sarvam-editor -- bun --cwd "C:/path/to/sarvam-editor" --env-file=apps/web/.env.local scripts/editor-mcp.ts
```

Open a project, open Sarvam, and choose Connect agent. Keep that project open.
Only one project can connect at a time. Tools return clip/track IDs and seconds.
Connections are bound to the project explicitly connected. Project switches and
editor unmounts invalidate pending polling callbacks; reconnect on the new project.
Idle and executing connections send heartbeats. A connection with no heartbeat
for ten seconds expires, and pending calls reject within the next watchdog tick.
This does not roll back an action that has already started. Inspect the timeline
before retrying after a timeout or connection failure.
Tool edits use the editor's existing undo history. Export downloads in the browser.
Media import takes base64 data; regular file import is also available in the UI.

Run `bun scripts/test-editor-mcp.ts` from this folder while a disposable test project
is connected. It tests actual MCP discovery, state, caption insertion, undo and redo.
Run `bun test apps/web/src/agent/broker.test.ts` for broker/validation tests.
Run `bun scripts/test-editor-connection.ts <project-id>` to verify the actual MCP
target. After navigating away without reconnecting, run the same script with
`--disconnected` to assert that the new project cannot receive agent commands.

For the media workflow, connect a disposable project without uploaded clips and
run `bun scripts/test-editor-media.ts <absolute-path-to-four-second-test.mp4>`.
The script asserts import, split, trim, undo and redo, then exports a video through
the real MCP bridge. It leaves the test media and edits in the connected project.

For batch-export QA, run `bun scripts/test-editor-languages.ts <hi.wav> <ta.wav> <snapshot.json>`
in a disposable connected project. Export the prepared caption/voice pairs through
Language exports, then run `bun scripts/test-editor-languages.ts --verify <snapshot.json>`.
After extracting the ZIP, `bun scripts/verify-language-export.ts <folder>` checks
the default New project filenames, 1080p video, timed subtitles and isolated
660/880 Hz tones. This requires FFmpeg/FFprobe and four-second synthetic fixtures;
it is not a general speech-quality test.

## Current limitations

- Sarvam API contracts are implemented; live calls need a real key and verification.
- Caption transcription, translation and language-export selectors expose all
  23 supported language codes. Bulbul v3 voice generation supports only 11;
  unsupported targets disable the voice control and reject at both the tool and
  HTTP boundaries. Four voices are selectable: Shubh, Ritu, Priya and Aditya.
  Coverage follows [Sarvam's model table](https://docs.sarvam.ai/api/getting-started/models),
  checked October 11, 2026. Availability is not proof of rendered font quality
  for every script; the visual verification limits below still apply.
- Transcription sends rendered audio in 25-second chunks with sentence timestamps.
- Voice segments start at caption times and are sped up when needed to fit their
  caption slots. Overlapping cues and rates above 5x are rejected. Live voice
  timing and audio quality still need verification with a real key.
- Language export batches pair caption and optional voice tracks, preserve
  background audio, and download videos plus SRT files in one ZIP. Choose original
  speech tracks to mute when replacing a voice. Speaker separation is not implemented.
- Phones use panel tabs with a persistent timeline; precise touch dragging,
  resizing and device-specific codec/export behavior still need device testing.
- The bridge keeps command state in one local Next.js process, not a distributed host.
- Web TypeScript checks pass after repairing upstream API call signatures.
  Bun tests load the real Rust WASM binary through a test-only preload; the
  browser build continues using the upstream bundler entry unchanged.
- The full web test suite still has three upstream mask-test failures: uniform
  scale snap-line expectations, text measurement without a canvas context, and
  Bezier insertion-handle expectations. These are not skipped or mocked away.

## Verified checkpoint

- Local app creates a project and reloads saved caption tracks.
- The shared tool registry now contains 14 tools. MCP state, caption insertion, undo and redo
  succeeded against the connected browser project.
- Thirty-nine broker, schema, credential, HTTP-origin, operation-guard, font-selection,
  language-export, assistant-loop and Sarvam HTTP-route tests pass.
- Connection guard tests reject project switches, closed projects and cancelled
  polls. Broker and HTTP heartbeat tests cover expiration of abandoned pending
  calls, late-poll rejection, safe session replacement, origin/session checks and
  queue preservation. Actual stdio MCP state calls targeted the connected project;
  after hard navigation, MCP rejected the unconnected project rather than hanging.
- Language-export adapter tests verify caption/voice isolation, preservation of
  background-track mute states, caption-only source audio, unchanged saved tracks,
  ZIP contents, UTF-8 SRT ordering/timing, stale-context cancellation, and rejection
  of stale source-caption/original-speech IDs before rendering. The renderer and
  browser download are test doubles here; these are not audio-mixing quality tests.
- Mocked route tests inspect the actual outgoing transcription multipart fields,
  translation/TTS model bodies, and chat tool/result messages. Invalid inputs,
  oversized/empty audio and foreign origins are rejected before upstream calls.
- Shared action execution rejects overlapping UI/MCP actions. Pending imports,
  transcription, translation, dubbing and exports check their originating project,
  scene and timeline before committing results. If a context changes after saving
  a generated asset, the asset may remain in its original project's media library;
  no pending timeline insertion is made. Guard tests cover lock release and stale
  contexts; live long-running Sarvam workflows remain unverified.
- Mocked assistant conversations verify ordered tool results, model-visible
  execution errors, malformed-response rejection and per-turn/total call limits.
  These tests do not prove live Sarvam model behavior.
- Motion titles offer lower-third, rising and pop presets in the Sarvam panel
  and through `add_motion_title`. They use editable native text/keyframes and
  one undo step. Browser insertion and export of a pop title succeeded; decoded
  frames confirm its entrance fade/scale and settled full-opacity state. Other
  presets and long-title fitting still need rendered verification.
- Twelve Noto families are self-hosted for Devanagari, Bengali, Gujarati, Gurmukhi,
  Tamil, Telugu, Kannada, Malayalam, Oriya, Arabic, Ol Chiki and Meetei Mayek scripts. Captions and motion
  titles select a font from their text and wait for loading before measurement;
  exports also load the timeline fonts. Font copyright notices and complete OFL
  licenses are served under `/licenses/noto-sans-<script>.txt`.
- A Hindi lower-third title rendered legibly in the exported MP4 with Noto Sans
  Devanagari. Tamil captions were also visually checked in a batch-exported MP4.
  Other scripts have font-selection tests but still need visual checks.
  Mixed-script text and right-to-left layout are not comprehensively verified.
- Short Ol Chiki and Meetei Mayek samples were inserted through the connected
  editor bridge, saved/reloaded, and exported in a four-second 1080p H.264 video.
  Decoded frames show their script glyphs rather than missing-character boxes.
  This checks the sample glyphs and export path, not native-speaker review or
  full script/diacritic coverage. Both new fonts include their complete OFL notices.
- Full web TypeScript check passes.
- Timeline placement, retiming-update and real-WASM timing suites pass (17
  tests). Fractional-tick fixtures now use valid integer ticks while retaining
  the same overlapping/non-overlapping placement cases. Full `bun test` from
  `apps/web` runs 234 tests: 231 pass and the three mask tests listed above fail.
  Run tests from either this folder or `apps/web`; both have a Bun test preload.
- Production `bun run build` in `apps/web` passes, including TypeScript and
  generation of all 20 pages. Better Auth warns about the local placeholder
  secret; production authentication and deployment are not verified.
- Motion-engine license review is recorded in `docs/motion-engines.md`.
  Native keyframes remain the default; no Remotion, GSAP or HyperFrames runtime
  is bundled. HyperFrames is an optional future worker candidate, not a shipped
  rendering integration.
- Responsive editor was checked at 390x844 and 320x740. Preview, Assets and
  Properties tabs, clip selection, media listing and the Sarvam dialog are
  accessible, without document-level horizontal overflow. Desktop retains its
  resizable panel layout. These browser checks do not prove touch gesture support.
- Actual MCP media test passed import of a synthetic four-second MP4, split at
  two seconds, quarter-second source trim, undo/redo and export. The output has
  120 H.264 frames at 1920x1080 plus AAC audio. A decoded frame confirms footage
  and caption composition; both edited clips and the media survived reload.
- Browser language export downloaded a ZIP containing a 1920x1080 H.264 MP4
  (120 frames, four seconds, verified with FFprobe) and correctly timed SRT cues.
  A later Hindi/Tamil batch produced two H.264/AAC MP4s and matching UTF-8 SRTs.
  Frequency analysis verified each selected 660/880 Hz synthetic voice and
  excluded both the source-video tone and the other language's voice. A before/
  after MCP state comparison confirms export did not alter saved editor state.
  Real Sarvam calls, speech quality and background-music mixing remain unverified.

See `docs/bharat-milestones.md` for remaining acceptance criteria.
See `docs/editor-references.md` for the Shotcut/MLT, LosslessCut and Kdenlive
reference review and subtitle parity gaps.
