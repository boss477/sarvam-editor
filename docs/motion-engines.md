# Motion engine review

Reviewed 2026-10-11 against upstream sources. This records engineering choices,
not legal advice; review exact pinned package terms before any future adoption.

## Current choice: native OpenCut text and keyframes

The editor uses its existing MIT-licensed timeline/rendering commands. Lower-third,
rising and pop titles remain editable, seekable, persistent and undoable. No new
animation engine is needed for these presets. Native rendering also keeps preview
and export on the same timeline model.

## Remotion

[Upstream license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)
is source-available, not MIT. Free use eligibility includes individuals, nonprofits
and for-profit organizations with up to three employees. Other organizations need
a company license, and the terms restrict selling or relicensing a derivative.
The source also flags upcoming v5 license changes.

Decision: do not bundle Remotion into the editor's default runtime. A separately
installed render adapter would need its own license review, deterministic timing,
asset sandbox and version pin. No adapter is currently shipped.

## GSAP

[Official standard license](https://gsap.com/community/standard-license/) grants
no-charge use subject to restrictions. It excludes certain no-code visual animation
builders that compete with Webflow's animation-building capabilities unless written
consent is obtained. Whether this editor falls within that restriction requires
clarification, not an assumption that free pricing means unrestricted redistribution.

Decision: do not ship GSAP as the editor's animation engine without resolving that
question. Native keyframes cover the current title presets.

## HyperFrames

[Repository](https://github.com/heygen-com/hyperframes) and
[license](https://github.com/heygen-com/hyperframes/blob/main/LICENSE) identify
Apache-2.0 licensing. It renders seekable HTML compositions using a headless browser
and FFmpeg, with multiple animation adapters. An Apache-licensed framework does not
automatically change the licenses of animation libraries or assets inside a composition.

Decision: the best candidate for an optional HTML-composition render/import adapter,
not a replacement for the interactive timeline. A future adapter should render in
an isolated worker, forbid arbitrary local-file/network access, preserve composition
sources separately, and import the resulting media through existing commands.
HTML imports must not execute arbitrary scripts inside the editor's origin.
No HyperFrames adapter is currently shipped or claimed as implemented.

## Reference repositories

The motion-design skill repositories in the parent PLAN.md are design references,
not copied dependencies. Their individual licenses and asset rights must be checked
before importing code, templates or media. No template from those repositories has
been copied into this implementation.
