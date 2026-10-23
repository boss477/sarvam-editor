import { afterAll, afterEach, expect, spyOn, test } from "bun:test";
import { strFromU8, unzipSync } from "fflate";
import type { EditorCore } from "@/core";
import type { AudioTrack, SceneTracks, TextTrack } from "@/timeline";
import * as browser from "@/utils/browser";
import { mediaTimeFromSeconds, ZERO_MEDIA_TIME } from "@/wasm";
import {
	exportLanguageVersions,
	serializeCaptionTrack,
} from "./language-export";

const downloads: { blob: Blob; filename: string }[] = [];
const download = spyOn(browser, "downloadBlob").mockImplementation((file) => {
	downloads.push(file);
});
afterAll(() => download.mockRestore());
afterEach(() => {
	downloads.length = 0;
});

function captions(id: string, content = id): TextTrack {
	return {
		id,
		name: id,
		type: "text",
		hidden: false,
		elements: [
			{
				id: id + "-cue",
				name: id,
				type: "text",
				startTime: ZERO_MEDIA_TIME,
				duration: mediaTimeFromSeconds({ seconds: 4 }),
				trimStart: ZERO_MEDIA_TIME,
				trimEnd: ZERO_MEDIA_TIME,
				params: { content },
			},
		],
	};
}

function audio(id: string, muted = false): AudioTrack {
	return {
		id,
		name: id,
		type: "audio",
		muted,
		elements: [
			{
				id: id + "-clip",
				name: id,
				type: "audio",
				sourceType: "upload",
				mediaId: id,
				startTime: ZERO_MEDIA_TIME,
				duration: mediaTimeFromSeconds({ seconds: 4 }),
				trimStart: ZERO_MEDIA_TIME,
				trimEnd: ZERO_MEDIA_TIME,
				params: { volume: 1, muted: false },
			},
		],
	};
}

function fixture(onExport?: (tracks: SceneTracks) => void) {
	const tracks: SceneTracks = {
		main: {
			id: "main",
			name: "Main",
			type: "video",
			hidden: false,
			muted: false,
			elements: [],
		},
		overlay: [
			captions("source"),
			captions("hi", "Namaste"),
			captions("ta", "Vanakkam"),
			captions("title"),
		],
		audio: [
			audio("hi-voice", true),
			audio("ta-voice"),
			audio("speech"),
			audio("music"),
			audio("muted-music", true),
		],
	};
	let project = { metadata: { id: "project", name: "Demo: India" } };
	const scene = { id: "scene", tracks };
	const renders: SceneTracks[] = [];
	// Only the manager methods used by this adapter are supplied by the test double.
	const editor = {
		project: {
			getActive: () => project,
			getActiveOrNull: () => project,
			export: async ({ renderTracks }: { renderTracks: SceneTracks }) => {
				renders.push(renderTracks);
				onExport?.(renderTracks);
				return { success: true, buffer: new Uint8Array([1, 2, 3]).buffer };
			},
		},
		scenes: { getActiveScene: () => scene, getActiveSceneOrNull: () => scene },
	} as unknown as EditorCore;
	return {
		editor,
		tracks,
		renders,
		changeProject: () => {
			project = { metadata: { id: "other", name: "Other" } };
		},
	};
}

const variants = [
	{ language: "hi-IN", captionTrackId: "hi", voiceTrackId: "hi-voice" },
	{ language: "ta-IN", captionTrackId: "ta", voiceTrackId: "ta-voice" },
];

test("language exports isolate selected voices and preserve background music without saved edits", async () => {
	const { editor, tracks, renders } = fixture();
	const before = structuredClone(tracks);
	const result = await exportLanguageVersions(editor, {
		sourceCaptionTrackId: "source",
		originalAudioTrackIds: ["speech"],
		variants,
	});
	expect(renders).toHaveLength(2);
	for (const [index, rendered] of renders.entries()) {
		expect(rendered.main.muted).toBe(true);
		expect(
			rendered.overlay
				.filter((track) => !track.hidden)
				.map((track) => track.id),
		).toEqual([index === 0 ? "hi" : "ta", "title"]);
		expect(rendered.audio.map((track) => [track.id, track.muted])).toEqual([
			["hi-voice", index !== 0],
			["ta-voice", index !== 1],
			["speech", true],
			["music", false],
			["muted-music", true],
		]);
	}
	expect(tracks).toEqual(before);
	expect(result.files).toEqual([
		"Demo- India-hi-IN.mp4",
		"Demo- India-hi-IN.srt",
		"Demo- India-ta-IN.mp4",
		"Demo- India-ta-IN.srt",
	]);
	expect(downloads).toHaveLength(1);
	expect(downloads[0].filename).toBe("Demo- India-languages.zip");
	const files = unzipSync(
		new Uint8Array(await downloads[0].blob.arrayBuffer()),
	);
	expect(files["Demo- India-hi-IN.mp4"]).toEqual(new Uint8Array([1, 2, 3]));
	expect(strFromU8(files["Demo- India-ta-IN.srt"])).toBe(
		"1\n00:00:00,000 --> 00:00:04,000\nVanakkam\n",
	);
});

test("caption-only versions keep source speech and still exclude another selected language voice", async () => {
	const { editor, renders } = fixture();
	await exportLanguageVersions(editor, {
		sourceCaptionTrackId: "source",
		originalAudioTrackIds: ["speech"],
		variants: [{ language: "hi-IN", captionTrackId: "hi" }, variants[1]],
	});
	expect(renders[0].main.muted).toBe(false);
	expect(renders[0].audio.find((track) => track.id === "speech")?.muted).toBe(
		false,
	);
	expect(renders[0].audio.find((track) => track.id === "ta-voice")?.muted).toBe(
		true,
	);
});

test("missing voice tracks reject the batch before rendering or downloading", async () => {
	const { editor, renders } = fixture();
	await expect(
		exportLanguageVersions(editor, {
			variants: [variants[0], { ...variants[1], voiceTrackId: "missing" }],
		}),
	).rejects.toThrow("Missing voice track");
	expect(renders).toHaveLength(0);
	expect(downloads).toHaveLength(0);
});

test("stale source-caption and original-speech IDs reject before rendering", async () => {
	for (const selection of [
		{ sourceCaptionTrackId: "missing" },
		{ sourceCaptionTrackId: "main" },
		{ originalAudioTrackIds: ["missing"] },
		{ originalAudioTrackIds: ["hi"] },
	]) {
		const { editor, renders } = fixture();
		await expect(
			exportLanguageVersions(editor, { ...selection, variants }),
		).rejects.toThrow("track");
		expect(renders).toHaveLength(0);
		expect(downloads).toHaveLength(0);
	}
});

test("changing projects during rendering aborts before the next version or ZIP download", async () => {
	const state = fixture(() => state.changeProject());
	await expect(
		exportLanguageVersions(state.editor, { variants }),
	).rejects.toThrow("project or timeline changed");
	expect(state.renders).toHaveLength(1);
	expect(downloads).toHaveLength(0);
});

test("SRT sorts cues, preserves Unicode and normalizes multiline captions", () => {
	const track = captions("hi", "नमस्ते\r\nभारत");
	track.elements[0].startTime = mediaTimeFromSeconds({ seconds: 61.25 });
	track.elements.push({
		...track.elements[0],
		id: "first",
		startTime: ZERO_MEDIA_TIME,
		params: { content: "पहला" },
	});
	const before = structuredClone(track);
	expect(serializeCaptionTrack(track)).toBe(
		"1\n00:00:00,000 --> 00:00:04,000\nपहला\n\n2\n00:01:01,250 --> 00:01:05,250\nनमस्ते\nभारत\n",
	);
	expect(track).toEqual(before);
});
