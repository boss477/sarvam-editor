import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const directory = process.argv[2];
assert(directory, "Supply the extracted test language archive directory.");
function run(command: string, args: string[]) {
	const result = spawnSync(command, args, { maxBuffer: 10 * 1024 * 1024 });
	assert.equal(result.status, 0, result.stderr.toString());
	return result.stdout;
}
for (const [language, frequency, text] of [
	[
		"hi-IN",
		660,
		"\u0928\u092e\u0938\u094d\u0924\u0947 \u092d\u093e\u0930\u0924",
	],
	[
		"ta-IN",
		880,
		"\u0bb5\u0ba3\u0b95\u0bcd\u0b95\u0bae\u0bcd \u0b87\u0ba8\u0bcd\u0ba4\u0bbf\u0baf\u0bbe",
	],
] as const) {
	const stem = join(directory, `New project-${language}`);
	const subtitles = await Bun.file(stem + ".srt").text();
	assert(subtitles.includes(text));
	assert(subtitles.includes("00:00:00,000 --> 00:00:04,000"));
	const metadata = JSON.parse(
		run("ffprobe", [
			"-v",
			"error",
			"-show_entries",
			"stream=codec_name,width,height,nb_frames",
			"-show_entries",
			"format=duration",
			"-of",
			"json",
			stem + ".mp4",
		]).toString(),
	);
	assert(
		metadata.streams.some(
			(stream: {
				codec_name: string;
				width?: number;
				height?: number;
				nb_frames?: string;
			}) =>
				stream.codec_name === "h264" &&
				stream.width === 1920 &&
				stream.height === 1080 &&
				stream.nb_frames === "120",
		),
	);
	assert(
		metadata.streams.some(
			(stream: { codec_name: string }) => stream.codec_name === "aac",
		),
	);
	assert(Math.abs(Number(metadata.format.duration) - 4) < 0.05);
	const audio = run("ffmpeg", [
		"-v",
		"error",
		"-ss",
		"0.5",
		"-i",
		stem + ".mp4",
		"-t",
		"1",
		"-vn",
		"-ac",
		"1",
		"-ar",
		"48000",
		"-f",
		"f32le",
		"pipe:1",
	]);
	const view = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
	const amplitude = (hz: number) => {
		let real = 0,
			imaginary = 0;
		for (let i = 0; i < audio.byteLength / 4; i++) {
			const sample = view.getFloat32(i * 4, true),
				angle = (2 * Math.PI * hz * i) / 48000;
			real += sample * Math.cos(angle);
			imaginary += sample * Math.sin(angle);
		}
		return (Math.hypot(real, imaginary) * 2) / (audio.byteLength / 4);
	};
	const selected = amplitude(frequency);
	assert(selected > 0.05, `${language}: selected voice tone is missing`);
	for (const excluded of [440, 660, 880].filter((hz) => hz !== frequency))
		assert(
			selected > amplitude(excluded) * 100,
			`${language}: unwanted ${excluded} Hz audio leaked`,
		);
	console.log(
		`PASS: ${language} video, captions and ${frequency} Hz voice isolation`,
	);
}
