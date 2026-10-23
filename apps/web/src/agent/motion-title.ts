import type { EditorCore } from "@/core";
import type { ElementAnimations, ScalarChannel } from "@/animation/types";
import {
	AddTrackCommand,
	BatchCommand,
	InsertElementCommand,
} from "@/commands";
import { buildSubtitleTextElement } from "@/subtitles/build-subtitle-text-element";
import { mediaTimeFromSeconds } from "@/wasm";
import { toolDefinitions } from "./tools";
import { loadFonts } from "@/fonts/google-fonts";
import { getIndicFontFamily } from "@/fonts/indic-fonts";
import { captureEditorContext } from "./editor-operation";

export async function addMotionTitle(editor: EditorCore, input: unknown) {
	const args = toolDefinitions.add_motion_title.schema.parse(input);
	const context = captureEditorContext(editor);
	await loadFonts({ families: [getIndicFontFamily(args.text)] });
	context.assertCurrent();
	const lower = args.preset === "lower-third";
	const element = buildSubtitleTextElement({
		index: 0,
		canvasSize: editor.project.getActive().settings.canvasSize,
		caption: {
			text: args.text,
			startTime: args.startTime,
			duration: args.duration,
			style: {
				color: args.color,
				fontWeight: "bold",
				fontSizeRatioOfPlayHeight: lower ? 0.045 : 0.075,
				placement: {
					verticalAlign: lower ? "bottom" : "middle",
					marginVerticalRatio: lower ? 0.15 : 0.05,
				},
				background: {
					enabled: lower,
					color: "#151515",
					paddingX: 30,
					paddingY: 20,
					cornerRadius: 4,
				},
			},
		},
	});
	const ramp = Math.min(0.4, args.duration / 4);
	const channel = (values: [number, number][]): ScalarChannel => ({
		keys: values.map(([time, value]) => ({
			id: crypto.randomUUID(),
			time: mediaTimeFromSeconds({ seconds: time }),
			value,
			segmentToNext: "linear",
			tangentMode: "auto",
		})),
	});
	const animations: ElementAnimations = {
		opacity: channel([
			[0, 0],
			[ramp, 1],
			[args.duration - ramp, 1],
			[args.duration, 0],
		]),
	};
	if (args.preset === "pop") {
		for (const path of ["transform.scaleX", "transform.scaleY"])
			animations[path] = channel([
				[0, 0.8],
				[ramp * 0.7, 1.06],
				[ramp, 1],
				[args.duration - ramp, 1],
				[args.duration, 0.95],
			]);
	} else {
		const y = Number(element.params["transform.positionY"]);
		const offset =
			editor.project.getActive().settings.canvasSize.height * 0.045;
		animations["transform.positionY"] = channel([
			[0, y + offset],
			[ramp, y],
			[args.duration - ramp, y],
			[args.duration, y - offset / 2],
		]);
	}
	const track = new AddTrackCommand({ type: "text", index: 0 });
	const trackId = track.getTrackId();
	editor.command.execute({
		command: new BatchCommand([
			track,
			new InsertElementCommand({
				placement: { mode: "explicit", trackId },
				element: { ...element, name: `Motion: ${args.preset}`, animations },
			}),
		]),
	});
	return { trackId };
}
