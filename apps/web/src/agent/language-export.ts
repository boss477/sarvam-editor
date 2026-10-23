import type { EditorCore } from "@/core";
import type { SceneTracks, TextTrack } from "@/timeline";
import { mediaTimeToSeconds } from "@/wasm";
import { toolDefinitions } from "./tools";
import { DEFAULT_EXPORT_OPTIONS } from "@/export/defaults";
import { downloadBlob } from "@/utils/browser";
import { zipSync, strToU8 } from "fflate";
import { captureEditorContext } from "./editor-operation";

function srtTime(seconds: number) {
	const millis = Math.round(seconds * 1000);
	return (
		[
			Math.floor(millis / 3600000),
			Math.floor(millis / 60000) % 60,
			Math.floor(millis / 1000) % 60,
		]
			.map((n) => String(n).padStart(2, "0"))
			.join(":") +
		"," +
		String(millis % 1000).padStart(3, "0")
	);
}
export function serializeCaptionTrack(track: TextTrack) {
	return track.elements
		.slice()
		.sort((a, b) => a.startTime - b.startTime)
		.map((element, index) => {
			const start = mediaTimeToSeconds({ time: element.startTime }),
				duration = mediaTimeToSeconds({ time: element.duration });
			return (
				index +
				1 +
				"\n" +
				srtTime(start) +
				" --> " +
				srtTime(start + duration) +
				"\n" +
				String(element.params.content).replace(/\r\n/g, "\n") +
				"\n"
			);
		})
		.join("\n");
}
export async function exportLanguageVersions(
	editor: EditorCore,
	input: unknown,
) {
	const args = toolDefinitions.export_languages.schema.parse(input);
	const context = captureEditorContext(editor);
	const original = editor.scenes.getActiveScene().tracks;
	if (
		args.sourceCaptionTrackId &&
		!original.overlay.some(
			(track) =>
				track.id === args.sourceCaptionTrackId && track.type === "text",
		)
	)
		throw new Error("Missing source caption track; select it again.");
	for (const trackId of args.originalAudioTrackIds) {
		if (!original.audio.some((track) => track.id === trackId))
			throw new Error("Missing original speech track; select it again.");
	}
	const captionIds = new Set(
		[
			args.sourceCaptionTrackId,
			...args.variants.map((v) => v.captionTrackId),
		].filter(Boolean),
	);
	const voiceIds = new Set(
		args.variants.map((v) => v.voiceTrackId).filter(Boolean),
	);
	const captions = new Map<string, TextTrack>();
	for (const variant of args.variants) {
		const track = original.overlay.find((t) => t.id === variant.captionTrackId);
		if (!track || track.type !== "text" || !track.elements.length)
			throw new Error("Missing caption track for " + variant.language);
		if (
			variant.voiceTrackId &&
			!original.audio.some(
				(t) => t.id === variant.voiceTrackId && t.elements.length,
			)
		)
			throw new Error("Missing voice track for " + variant.language);
		captions.set(variant.language, track);
	}
	const files: Record<string, Uint8Array> = {};
	const projectName =
		editor.project
			.getActive()
			.metadata.name.replace(/[<>:"/\\|?*]/g, "-")
			.trim() || "video";
	for (const variant of args.variants) {
		context.assertCurrent();
		const replaceVoice = !!variant.voiceTrackId;
		const renderTracks: SceneTracks = {
			main: { ...original.main, muted: replaceVoice || original.main.muted },
			overlay: original.overlay.map((track) => {
				if (captionIds.has(track.id))
					return { ...track, hidden: track.id !== variant.captionTrackId };
				if (track.type === "video" && replaceVoice)
					return { ...track, muted: true };
				return track;
			}),
			audio: original.audio.map((track) => ({
				...track,
				muted:
					track.id === variant.voiceTrackId
						? false
						: voiceIds.has(track.id) ||
							  (replaceVoice && args.originalAudioTrackIds.includes(track.id))
							? true
							: track.muted,
			})),
		};
		const result = await editor.project.export({
			options: { ...DEFAULT_EXPORT_OPTIONS, format: args.format },
			renderTracks,
		});
		if (!result.success || !result.buffer)
			throw new Error(
				variant.language + ": " + (result.error || "Export cancelled"),
			);
		context.assertCurrent();
		const stem = projectName + "-" + variant.language;
		files[stem + "." + args.format] = new Uint8Array(result.buffer);
		files[stem + ".srt"] = strToU8(
			serializeCaptionTrack(captions.get(variant.language)!),
		);
	}
	const archive = zipSync(files, { level: 0 });
	const filename = projectName + "-languages.zip";
	downloadBlob({
		blob: new Blob([new Uint8Array(archive)], { type: "application/zip" }),
		filename,
	});
	return { download: filename, files: Object.keys(files) };
}
export function exportCaptionFile(editor: EditorCore, input: unknown) {
	const args = toolDefinitions.export_subtitles.schema.parse(input);
	const track = editor.scenes
		.getActiveScene()
		.tracks.overlay.find((t) => t.id === args.trackId);
	if (!track || track.type !== "text" || !track.elements.length)
		throw new Error("Select a nonempty caption track.");
	const filename = args.language + ".srt";
	downloadBlob({
		blob: new Blob([serializeCaptionTrack(track)], {
			type: "application/x-subrip;charset=utf-8",
		}),
		filename,
	});
	return { download: filename };
}
