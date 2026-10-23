import { z } from "zod";
import {
	sarvamLanguage as language,
	bulbulLanguage,
	bulbulSpeaker,
} from "@/services/sarvam/languages";

const seconds = z.number().finite().nonnegative();
export const toolDefinitions = {
	add_motion_title: {
		description:
			"Add an editable animated title on a new text track. Presets: lower third, rising title, pop title. Times are seconds.",
		schema: z.object({
			text: z.string().trim().min(1).max(300),
			preset: z.enum(["lower-third", "rise", "pop"]),
			startTime: seconds.default(0),
			duration: z.number().finite().min(1).max(60).default(4),
			color: z
				.string()
				.regex(/^#[0-9a-fA-F]{6}$/)
				.default("#ffffff"),
		}),
	},
	import_media: {
		description:
			"Import a base64-encoded media file (up to 50 MB) and place it on the timeline.",
		schema: z.object({
			fileName: z.string().min(1).max(255),
			base64: z.string().min(1).max(70_000_000),
			mimeType: z.string().min(1),
			startTime: seconds.default(0),
		}),
	},
	get_state: {
		description:
			"Inspect the active project, tracks, clips and media. Times are seconds.",
		schema: z.object({}),
	},
	split_clip: {
		description:
			"Split an existing clip at an absolute timeline time in seconds.",
		schema: z.object({
			trackId: z.string(),
			elementId: z.string(),
			time: seconds,
		}),
	},
	trim_clip: {
		description: "Trim source seconds from the beginning and end of a clip.",
		schema: z.object({
			trackId: z.string(),
			elementId: z.string(),
			trimStart: seconds,
			trimEnd: seconds,
		}),
	},
	add_captions: {
		description: "Add a new editable caption track. Preserve original tracks.",
		schema: z.object({
			captions: z
				.array(
					z.object({
						text: z.string().min(1),
						startTime: seconds,
						duration: z.number().positive(),
					}),
				)
				.min(1)
				.max(2000),
		}),
	},
	transcribe: {
		description:
			"Transcribe the active timeline using Sarvam and add captions.",
		schema: z.object({ language: language.optional() }),
	},
	translate_captions: {
		description: "Translate a text track into a new caption track.",
		schema: z.object({
			trackId: z.string(),
			source: language,
			target: language,
		}),
	},
	dub: {
		description:
			"Generate a timed voice track from a caption track using Bulbul v3 (11 supported languages).",
		schema: z.object({
			trackId: z.string(),
			language: bulbulLanguage,
			speaker: bulbulSpeaker.default("shubh"),
		}),
	},
	export_video: {
		description:
			"Render the active timeline and download it in the connected browser.",
		schema: z.object({ format: z.enum(["mp4", "webm"]).default("mp4") }),
	},
	export_languages: {
		description:
			"Export language variants as a ZIP of videos and SRT captions. Each variant specifies its caption and optional voice track. The saved timeline is unchanged.",
		schema: z.object({
			format: z.enum(["mp4", "webm"]).default("mp4"),
			sourceCaptionTrackId: z.string().optional(),
			originalAudioTrackIds: z.array(z.string()).default([]),
			variants: z
				.array(
					z.object({
						language,
						captionTrackId: z.string(),
						voiceTrackId: z.string().optional(),
					}),
				)
				.min(1)
				.max(23)
				.refine(
					(items) =>
						new Set(items.map((item) => item.language)).size === items.length,
					"Choose each language once",
				),
		}),
	},
	export_subtitles: {
		description: "Download a text track as a UTF-8 SRT subtitle file.",
		schema: z.object({ trackId: z.string(), language }),
	},
	undo: { description: "Undo the last editor command.", schema: z.object({}) },
	redo: {
		description: "Redo the last undone editor command.",
		schema: z.object({}),
	},
};
export type ToolName = keyof typeof toolDefinitions;
export const modelTools = Object.entries(toolDefinitions).map(
	([name, tool]) => ({
		type: "function",
		function: {
			name,
			description: tool.description,
			parameters: z.toJSONSchema(tool.schema),
		},
	}),
);
