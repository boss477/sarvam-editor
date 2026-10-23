# Editor reference review

Reviewed 2026-10-11. These are design references, not bundled dependencies or
claims that Bharat Editor matches their feature sets.

## Shotcut and MLT: rendering boundaries

MLT separates frame producers, filters, playlists/multitracks and consumers.
Consumers pull frames; image/audio work can be evaluated lazily. Its XML format
separates source references from timeline arrangements and transitions.
Sources: [framework](https://www.mltframework.org/docs/framework/) and
[MLT XML](https://mltframework.org/docs/mltxml/).

Shotcut distinguishes saving an editable MLT project from exporting a rendered
video. Its FAQ also warns that non-transcoding subclip extraction is not frame
accurate. Source: [Shotcut FAQ](https://shotcut.org/FAQ/).

Decision: retain OpenCut's project model, command history and renderer. Agent
actions edit that model rather than inventing a second timeline. Language export
uses isolated render-track snapshots without changing the saved project. MLT is
not embedded, and no MLT project interchange is implemented.

## LosslessCut: fast cuts have constraints

LosslessCut documents keyframe-rounded starts, timestamp/audio-sync pitfalls and
experimental Smart Cut compatibility limits. Its Smart Cut implementation checks
nearby keyframes before deciding whether a segment needs special handling.
Sources: [troubleshooting](https://github.com/mifi/lossless-cut/blob/master/docs/troubleshooting.md)
and [Smart Cut source](https://github.com/mifi/lossless-cut/blob/master/src/renderer/src/smartcut.ts).

Decision: do not describe current timeline exports as lossless stream copies.
Captions, motion and language-specific audio use the existing rendered export
path. A future fast-cut mode would need separate codec/keyframe eligibility,
timestamp handling and decoded boundary/audio-sync tests. Synthetic MP4 exports
have been inspected with FFprobe and decoded frames; that is not broad codec QA.
No LosslessCut source code is copied.

## Kdenlive: subtitle workflow baseline

Kdenlive supports timeline subtitle editing, subtitle-file management, import of
ASS/SRT/VTT/SBV, and ASS/SRT export. Its speech workflow includes local recognition
engines and optional translation. Sources:
[subtitles](https://docs.kdenlive.org/en/effects_and_filters/subtitles.html) and
[speech to text](https://docs.kdenlive.org/en/effects_and_filters/speech_to_text.html).

Bharat currently provides editable native text cues, separate translated tracks,
SRT export, selected caption/voice variants and agent actions. This is not subtitle
feature parity: dedicated ASS styling/interchange, broad subtitle import and
local/offline speech recognition are not implemented by this integration.

The intended advantage is the connected Indian-language editing/dubbing/export
workflow, not an unmeasured claim of better recognition. Before claiming quality
improvements, benchmark real code-mixed speech, cue alignment, line wrapping,
names/numbers, translation accuracy and dubbed speech duration with native
speakers. Live Sarvam quality has not yet been measured.

## Release evidence

- Runnable base, native timeline operations, persistence and synthetic media
  exports have browser/MCP verification. Details are in [BHARAT.md](../BHARAT.md).
- Sarvam HTTP contracts and model tool loops have mocked tests; authenticated
  transcription, translation, TTS and Sarvam-105B behavior remain unverified.
- Official Sarvam MCP discovery and builder lookup pass without credentials;
  this does not validate live API responses. Claude kickoff requires local login.
- Motion adapters and licenses are reviewed in [motion-engines.md](motion-engines.md).
  Native titles ship; external rendering engines do not.
- Production authentication/deployment, comprehensive Indic/RTL and touch-device
  QA remain release work. Three existing upstream mask tests still fail.

Acceptance criteria remain in [bharat-milestones.md](bharat-milestones.md). Do not
mark credential-dependent gates complete on the strength of mocked tests.
