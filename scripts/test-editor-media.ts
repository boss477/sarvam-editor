import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type Clip = {
	id: string;
	mediaId?: string;
	duration: number;
	startTime: number;
	trimStart: number;
	trimEnd: number;
};
type State = { tracks: { id: string; elements: Clip[] }[] };
const path = process.argv[2];
assert(
	path,
	"Supply a four-second synthetic MP4 path. Connect a disposable editor project first.",
);
const client = new Client({ name: "bharat-media-test", version: "1.0.0" });
async function call(name: string, args: Record<string, unknown> = {}) {
	const result = await client.callTool({ name, arguments: args });
	assert(!result.isError, JSON.stringify(result));
	const content = result.content as { type: string; text?: string }[];
	return JSON.parse(content.find((item) => item.type === "text")!.text!);
}
try {
	await client.connect(
		new StdioClientTransport({
			command: process.execPath,
			args: ["--env-file=apps/web/.env.local", "scripts/editor-mcp.ts"],
		}),
	);
	const initial: State = await call("get_state");
	assert(
		initial.tracks.every((track) =>
			track.elements.every((clip) => !clip.mediaId),
		),
		"Use a project without uploaded clips to keep placement deterministic.",
	);
	const imported = await call("import_media", {
		fileName: "bharat-test-source.mp4",
		mimeType: "video/mp4",
		base64: Buffer.from(await Bun.file(path).arrayBuffer()).toString("base64"),
	});
	const state: State = await call("get_state");
	const track = state.tracks.find((track) =>
		track.elements.some((clip) => clip.mediaId === imported.mediaId),
	)!;
	assert(track, "Imported media must appear on timeline");
	const clip = track.elements.find(
		(clip) => clip.mediaId === imported.mediaId,
	)!;
	assert(Math.abs(clip.duration - 4) < 0.05);
	await call("split_clip", { trackId: track.id, elementId: clip.id, time: 2 });
	const split: State = await call("get_state");
	const pieces = split.tracks
		.find((item) => item.id === track.id)!
		.elements.filter((item) => item.mediaId === imported.mediaId)
		.sort((a, b) => a.startTime - b.startTime);
	assert.equal(pieces.length, 2);
	assert.equal(pieces[0].duration, 2);
	assert.equal(pieces[1].startTime, 2);
	await call("trim_clip", {
		trackId: track.id,
		elementId: pieces[0].id,
		trimStart: 0.25,
		trimEnd: pieces[0].trimEnd,
	});
	const trimmed: State = await call("get_state");
	const left = trimmed.tracks
		.find((item) => item.id === track.id)!
		.elements.find((item) => item.id === pieces[0].id)!;
	assert.equal(left.trimStart, 0.25);
	assert.equal(left.duration, 1.75);
	await call("undo");
	const undone: State = await call("get_state");
	assert.equal(
		undone.tracks
			.find((item) => item.id === track.id)!
			.elements.find((item) => item.id === pieces[0].id)!.duration,
		2,
	);
	await call("redo");
	console.log("PASS: media import, split, trim, undo and redo");
	await call("export_video", { format: "mp4" });
	console.log(
		"PASS: browser video export",
		JSON.stringify(await call("get_state")),
	);
} finally {
	await client.close();
}
