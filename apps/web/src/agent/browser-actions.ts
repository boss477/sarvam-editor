import type { EditorCore } from "@/core";
import { toolDefinitions, type ToolName } from "./tools";
import {
	mediaTimeFromSeconds,
	mediaTimeToSeconds,
	ZERO_MEDIA_TIME,
} from "@/wasm";
import { insertCaptionChunksAsTextTrack } from "@/subtitles/insert";
import { extractTimelineAudio } from "@/media/mediabunny";
import { decodeAudioToFloat32 } from "@/media/audio";
import { processMediaAssets } from "@/media/processing";
import { DEFAULT_EXPORT_OPTIONS } from "@/export/defaults";
import {
	AddTrackCommand,
	InsertElementCommand,
	BatchCommand,
} from "@/commands";
import { exportLanguageVersions, exportCaptionFile } from "./language-export";
import { addMotionTitle } from "./motion-title";
import { captureEditorContext, withEditorOperation } from "./editor-operation";
import { loadFonts } from "@/fonts/google-fonts";
import { getIndicFontFamily } from "@/fonts/indic-fonts";

export async function callSarvam(body: Record<string, unknown> | FormData) {
	const multipart = body instanceof FormData;
	const response = await fetch("/api/sarvam", {
		method: "POST",
		headers: multipart ? {} : { "Content-Type": "application/json" },
		body: multipart ? body : JSON.stringify(body),
	});
	const data = await response.json();
	if (!response.ok) throw new Error(data.error || "Sarvam request failed");
	return data;
}
function wav(samples: Float32Array) {
	const data = new ArrayBuffer(44 + samples.length * 2),
		v = new DataView(data);
	for (const [offset, text] of [
		[0, "RIFF"],
		[8, "WAVE"],
		[12, "fmt "],
		[36, "data"],
	] as const)
		for (let i = 0; i < text.length; i++)
			v.setUint8(offset + i, text.charCodeAt(i));
	v.setUint32(4, data.byteLength - 8, true);
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true);
	v.setUint16(22, 1, true);
	v.setUint32(24, 16000, true);
	v.setUint32(28, 32000, true);
	v.setUint16(32, 2, true);
	v.setUint16(34, 16, true);
	v.setUint32(40, samples.length * 2, true);
	samples.forEach((s, i) =>
		v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true),
	);
	return new Blob([data], { type: "audio/wav" });
}
export async function executeEditorTool(
	editor: EditorCore,
	name: string,
	input: unknown,
): Promise<unknown> {
	return withEditorOperation(editor, () => executeTool(editor, name, input));
}

async function executeTool(
	editor: EditorCore,
	name: string,
	input: unknown,
): Promise<unknown> {
	if (!Object.hasOwn(toolDefinitions, name))
		throw new Error("Unknown editor action: " + name);
	const toolName = name as ToolName;
	const args = toolDefinitions[toolName].schema.parse(input);
	const context = captureEditorContext(editor);
	const insertCaptions = async (
		captions: { text: string; startTime: number; duration: number }[],
	) => {
		await loadFonts({
			families: [
				...new Set(captions.map((cue) => getIndicFontFamily(cue.text))),
			],
		});
		context.assertCurrent();
		return { trackId: insertCaptionChunksAsTextTrack({ editor, captions }) };
	};
	if (toolName === "add_motion_title") return addMotionTitle(editor, args);
	if (toolName === "export_languages")
		return exportLanguageVersions(editor, args);
	if (toolName === "export_subtitles") return exportCaptionFile(editor, args);
	const tracks = editor.scenes.getActiveScene().tracks;
	const all = [...tracks.overlay, tracks.main, ...tracks.audio];
	const sec = (time: Parameters<typeof mediaTimeToSeconds>[0]["time"]) =>
		mediaTimeToSeconds({ time });
	if (toolName === "get_state")
		return {
			project: {
				id: editor.project.getActive().metadata.id,
				name: editor.project.getActive().metadata.name,
				duration: sec(editor.timeline.getTotalDuration()),
			},
			tracks: all.map((t) => ({
				id: t.id,
				name: t.name,
				type: t.type,
				elements: t.elements.map((e) => ({
					id: e.id,
					name: e.name,
					type: e.type,
					startTime: sec(e.startTime),
					duration: sec(e.duration),
					trimStart: sec(e.trimStart),
					trimEnd: sec(e.trimEnd),
					...("mediaId" in e ? { mediaId: e.mediaId } : {}),
					...(e.type === "text" ? { text: e.params.content } : {}),
				})),
			})),
			media: editor.media.getAssets().map((a) => ({
				id: a.id,
				name: a.name,
				type: a.type,
				duration: a.duration,
			})),
		};
	if (toolName === "undo" || toolName === "redo") {
		editor.command[toolName]();
		return { ok: true };
	}
	if (toolName === "import_media") {
		const a = toolDefinitions.import_media.schema.parse(args);
		const bytes = Uint8Array.from(atob(a.base64), (c) => c.charCodeAt(0));
		const [asset] = await processMediaAssets({
			files: [new File([bytes], a.fileName, { type: a.mimeType })],
		});
		if (!asset) throw new Error("Unsupported media file.");
		context.assertCurrent();
		const saved = await editor.media.addMediaAsset({
			projectId: context.projectId,
			asset,
		});
		if (!saved) throw new Error("Could not save imported media.");
		context.assertCurrent();
		const common = {
			mediaId: saved.id,
			name: saved.name,
			startTime: mediaTimeFromSeconds({ seconds: a.startTime }),
			duration: mediaTimeFromSeconds({ seconds: saved.duration || 5 }),
			trimStart: ZERO_MEDIA_TIME,
			trimEnd: ZERO_MEDIA_TIME,
			params: {},
		};
		if (saved.type === "audio")
			editor.timeline.insertElement({
				placement: { mode: "auto" },
				element: { ...common, type: "audio", sourceType: "upload" },
			});
		else
			editor.timeline.insertElement({
				placement: { mode: "auto" },
				element: { ...common, type: saved.type },
			});
		return { mediaId: saved.id };
	}
	if (toolName === "split_clip") {
		const a = toolDefinitions.split_clip.schema.parse(args),
			track = all.find((t) => t.id === a.trackId),
			clip = track?.elements.find((e) => e.id === a.elementId);
		if (
			!clip ||
			a.time <= sec(clip.startTime) ||
			a.time >= sec(clip.startTime) + sec(clip.duration)
		)
			throw new Error("Split time must be inside an existing clip.");
		return editor.timeline.splitElements({
			elements: [{ trackId: a.trackId, elementId: a.elementId }],
			splitTime: mediaTimeFromSeconds({ seconds: a.time }),
		});
	}
	if (toolName === "trim_clip") {
		const a = toolDefinitions.trim_clip.schema.parse(args),
			clip = all
				.find((t) => t.id === a.trackId)
				?.elements.find((e) => e.id === a.elementId);
		if (!clip || !("mediaId" in clip))
			throw new Error("Select an uploaded media clip.");
		if ("retime" in clip && clip.retime)
			throw new Error("Reset clip speed before trimming through the agent.");
		const source = sec(clip.duration) + sec(clip.trimStart) + sec(clip.trimEnd);
		if (a.trimStart + a.trimEnd >= source)
			throw new Error("Trim would remove the whole clip.");
		editor.timeline.updateElementTrim({
			elementId: a.elementId,
			trimStart: mediaTimeFromSeconds({ seconds: a.trimStart }),
			trimEnd: mediaTimeFromSeconds({ seconds: a.trimEnd }),
			duration: mediaTimeFromSeconds({
				seconds: source - a.trimStart - a.trimEnd,
			}),
		});
		return { ok: true };
	}
	if (toolName === "add_captions")
		return insertCaptions(
			toolDefinitions.add_captions.schema.parse(args).captions,
		);
	if (toolName === "transcribe") {
		const a = toolDefinitions.transcribe.schema.parse(args),
			duration = editor.timeline.getTotalDuration();
		if (duration === 0)
			throw new Error("Add audio or video to the timeline first.");
		const blob = await extractTimelineAudio({
			tracks,
			mediaAssets: editor.media.getAssets(),
			totalDuration: duration,
		});
		const { samples } = await decodeAudioToFloat32({
			audioBlob: blob,
			sampleRate: 16000,
		});
		context.assertCurrent();
		const captions: { text: string; startTime: number; duration: number }[] =
			[];
		// REST accepts short files. Chunk the rendered timeline to retain edit timing.
		for (let start = 0; start < samples.length; start += 25 * 16000) {
			const form = new FormData();
			form.set(
				"file",
				wav(samples.slice(start, start + 25 * 16000)),
				"timeline.wav",
			);
			form.set("language", a.language || "unknown");
			const result = await callSarvam(form),
				ts = result.timestamps;
			context.assertCurrent();
			if (result.transcript?.trim() && !ts?.words?.length)
				throw new Error(
					"Sarvam returned no timestamps; captions were not inserted.",
				);
			for (let i = 0; i < (ts?.words?.length || 0); i++)
				captions.push({
					text: ts.words[i],
					startTime: start / 16000 + ts.start_time_seconds[i],
					duration: ts.end_time_seconds[i] - ts.start_time_seconds[i],
				});
		}
		const valid = toolDefinitions.add_captions.schema.parse({ captions });
		context.assertCurrent();
		return insertCaptions(valid.captions);
	}
	if (toolName === "translate_captions" || toolName === "dub") {
		const a =
			toolName === "dub"
				? toolDefinitions.dub.schema.parse(args)
				: toolDefinitions.translate_captions.schema.parse(args);
		const track = tracks.overlay.find((t) => t.id === a.trackId);
		if (!track || track.type !== "text" || !track.elements.length)
			throw new Error("Select a nonempty caption track.");
		if (toolName === "translate_captions") {
			const tr = toolDefinitions.translate_captions.schema.parse(args),
				captions = [];
			for (const e of track.elements) {
				const result = await callSarvam({
					action: "translate",
					text: String(e.params.content),
					source: tr.source,
					target: tr.target,
				});
				context.assertCurrent();
				if (!result.translated_text)
					throw new Error("Sarvam returned an empty translation.");
				captions.push({
					text: result.translated_text,
					startTime: sec(e.startTime),
					duration: sec(e.duration),
				});
			}
			return insertCaptions(captions);
		}
		const d = toolDefinitions.dub.schema.parse(args);
		const ordered = track.elements
			.slice()
			.sort((a, b) => a.startTime - b.startTime);
		if (
			ordered.some(
				(element, i) =>
					i > 0 &&
					element.startTime <
						ordered[i - 1].startTime + ordered[i - 1].duration,
			)
		)
			throw new Error(
				"Caption cues overlap. Resolve overlaps before generating voice.",
			);
		const generated = [];
		for (const e of ordered) {
			const result = await callSarvam({
				action: "speak",
				text: String(e.params.content),
				language: d.language,
				speaker: d.speaker,
			});
			context.assertCurrent();
			if (!result.audios?.[0])
				throw new Error("Sarvam returned no voice audio.");
			const bytes = Uint8Array.from(atob(result.audios[0]), (c) =>
				c.charCodeAt(0),
			);
			const [asset] = await processMediaAssets({
				files: [
					new File([bytes], "dub-" + e.id + ".wav", { type: "audio/wav" }),
				],
			});
			if (!asset || !asset.duration)
				throw new Error("Could not decode generated voice audio.");
			context.assertCurrent();
			const rate = Math.max(1, asset.duration / sec(e.duration));
			if (rate > 5)
				throw new Error(
					"Voice is too long for its caption slot. Shorten the caption or extend its duration.",
				);
			const saved = await editor.media.addMediaAsset({
				projectId: context.projectId,
				asset,
			});
			if (!saved) throw new Error("Could not save voice audio.");
			context.assertCurrent();
			generated.push({
				saved,
				startTime: e.startTime,
				rate,
				duration: mediaTimeFromSeconds({ seconds: asset.duration / rate }),
			});
		}
		const addTrack = new AddTrackCommand({ type: "audio" });
		context.assertCurrent();
		const trackId = addTrack.getTrackId();
		const inserts = generated.map(
			({ saved, startTime, rate, duration }) =>
				new InsertElementCommand({
					placement: { mode: "explicit", trackId },
					element: {
						type: "audio",
						sourceType: "upload",
						mediaId: saved.id,
						name: d.language + " voice",
						startTime,
						duration,
						sourceDuration: mediaTimeFromSeconds({ seconds: saved.duration! }),
						retime: { rate, maintainPitch: true },
						trimStart: ZERO_MEDIA_TIME,
						trimEnd: ZERO_MEDIA_TIME,
						params: {},
					},
				}),
		);
		editor.command.execute({
			command: new BatchCommand([addTrack, ...inserts]),
		});
		return {
			trackId,
			note: "Voice segments fit caption slots with pitch-preserving retiming. Select this voice track for the language export.",
		};
	}
	if (toolName === "export_video") {
		const a = toolDefinitions.export_video.schema.parse(args);
		const result = await editor.project.export({
			options: { ...DEFAULT_EXPORT_OPTIONS, format: a.format },
		});
		if (!result.success || !result.buffer)
			throw new Error(result.error || "Export failed");
		context.assertCurrent();
		const url = URL.createObjectURL(
			new Blob([result.buffer], {
				type: a.format === "mp4" ? "video/mp4" : "video/webm",
			}),
		);
		const link = document.createElement("a");
		link.href = url;
		link.download = editor.project.getActive().metadata.name + "." + a.format;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 60000);
		return { ok: true, download: link.download };
	}
	throw new Error("Action unavailable.");
}
