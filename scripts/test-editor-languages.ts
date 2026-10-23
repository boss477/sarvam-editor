import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
type State = {
	tracks: {
		id: string;
		type: string;
		elements: { mediaId?: string; text?: string }[];
	}[];
};
const client = new Client({ name: "bharat-language-test", version: "1.0.0" });
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
	const snapshotPath = process.argv[3];
	if (process.argv[2] === "--verify") {
		assert(snapshotPath, "Supply the snapshot JSON path.");
		assert.deepEqual(
			await call("get_state"),
			await Bun.file(snapshotPath).json(),
		);
		console.log("PASS: language export left saved editor state unchanged");
	} else {
		const hiPath = process.argv[2],
			taPath = process.argv[3],
			output = process.argv[4];
		assert(
			hiPath && taPath && output,
			"Supply Hindi WAV, Tamil WAV and output snapshot JSON paths. Use a disposable connected project.",
		);
		const variants = [];
		for (const [language, path, text] of [
			[
				"hi-IN",
				hiPath,
				"\u0928\u092e\u0938\u094d\u0924\u0947 \u092d\u093e\u0930\u0924",
			],
			[
				"ta-IN",
				taPath,
				"\u0bb5\u0ba3\u0b95\u0bcd\u0b95\u0bae\u0bcd \u0b87\u0ba8\u0bcd\u0ba4\u0bbf\u0baf\u0bbe",
			],
		]) {
			const caption = await call("add_captions", {
				captions: [{ text, startTime: 0, duration: 4 }],
			});
			const media = await call("import_media", {
				fileName: `${language}-test-voice.wav`,
				mimeType: "audio/wav",
				base64: Buffer.from(await Bun.file(path).arrayBuffer()).toString(
					"base64",
				),
				startTime: 0,
			});
			const state: State = await call("get_state");
			const voice = state.tracks.find(
				(track) =>
					track.type === "audio" &&
					track.elements.some((item) => item.mediaId === media.mediaId),
			);
			assert(voice, "Voice must be placed on an audio track");
			variants.push({
				language,
				captionTrackId: caption.trackId,
				voiceTrackId: voice.id,
			});
		}
		assert.notEqual(
			variants[0].voiceTrackId,
			variants[1].voiceTrackId,
			"Overlapping voices must use separate tracks",
		);
		await Bun.write(output, JSON.stringify(await call("get_state"), null, 2));
		console.log(
			"PASS: prepared two caption/voice pairs",
			JSON.stringify(variants),
		);
		console.log(
			"Export these pairs through the browser, then run --verify with the snapshot path.",
		);
	}
} finally {
	await client.close();
}
