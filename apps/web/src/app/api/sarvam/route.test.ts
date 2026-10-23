import { afterEach, expect, test } from "bun:test";
import { POST } from "./route";
import { modelTools } from "@/agent/tools";

const originalFetch = globalThis.fetch;
const originalKey = process.env.SARVAM_API_KEY;
afterEach(() => {
	globalThis.fetch = originalFetch;
	if (originalKey === undefined) delete process.env.SARVAM_API_KEY;
	else process.env.SARVAM_API_KEY = originalKey;
});
function request(
	body: Record<string, unknown> | FormData,
	origin = "http://localhost:3015",
) {
	return new Request("http://localhost:3015/api/sarvam", {
		method: "POST",
		headers: {
			origin,
			...(body instanceof FormData
				? {}
				: { "content-type": "application/json" }),
		},
		body: body instanceof FormData ? body : JSON.stringify(body),
	});
}
function mockUpstream(
	inspect: (url: string, init: RequestInit) => void,
	response: unknown = { ok: true },
) {
	process.env.SARVAM_API_KEY = "route-test-key";
	globalThis.fetch = Object.assign(
		async (input: string | URL | Request, init?: RequestInit) => {
			expect(init).toBeDefined();
			expect(new Headers(init!.headers).get("api-subscription-key")).toBe(
				"route-test-key",
			);
			inspect(String(input), init!);
			return Response.json(response);
		},
		{ preconnect: originalFetch.preconnect },
	);
}

test("translation route sends the documented model and language fields", async () => {
	mockUpstream(
		(url, init) => {
			expect(url).toBe("https://api.sarvam.ai/translate");
			expect(JSON.parse(String(init.body))).toEqual({
				input: "Hello",
				source_language_code: "en-IN",
				target_language_code: "hi-IN",
				model: "sarvam-translate:v1",
			});
		},
		{ translated_text: "translated" },
	);
	const result = await POST(
		request({
			action: "translate",
			text: "Hello",
			source: "en-IN",
			target: "hi-IN",
		}),
	);
	expect(result.status).toBe(200);
	expect(await result.json()).toEqual({ translated_text: "translated" });
});

test("voice route requests Bulbul v3 audio at 24 kHz", async () => {
	mockUpstream(
		(url, init) => {
			expect(url).toBe("https://api.sarvam.ai/text-to-speech");
			expect(JSON.parse(String(init.body))).toEqual({
				text: "Hello",
				language_code: "en-IN",
				speaker: "shubh",
				model: "bulbul:v3",
				speech_sample_rate: 24000,
			});
		},
		{ audios: ["test-base64"] },
	);
	const result = await POST(
		request({
			action: "speak",
			text: "Hello",
			language: "en-IN",
			speaker: "shubh",
		}),
	);
	expect(await result.json()).toEqual({ audios: ["test-base64"] });
});

test("translation accepts languages outside Bulbul voice coverage", async () => {
	mockUpstream((_url, init) => {
		expect(JSON.parse(String(init.body)).target_language_code).toBe("as-IN");
	});
	expect(
		(
			await POST(
				request({
					action: "translate",
					text: "Hello",
					source: "en-IN",
					target: "as-IN",
				}),
			)
		).status,
	).toBe(200);
});

test("transcription route forwards audio as multipart with timestamps", async () => {
	mockUpstream(
		(url, init) => {
			expect(url).toBe("https://api.sarvam.ai/speech-to-text");
			expect(new Headers(init.headers).has("content-type")).toBe(false);
			expect(init.body).toBeInstanceOf(FormData);
			const form = init.body as FormData;
			expect(form.get("model")).toBe("saaras:v4");
			expect(form.get("with_timestamps")).toBe("true");
			expect(form.get("language_code")).toBe("hi-IN");
			expect((form.get("file") as File).name).toBe("fixture.wav");
			expect((form.get("file") as File).size).toBe(4);
		},
		{
			transcript: "hello",
			timestamps: {
				words: ["hello"],
				start_time_seconds: [0],
				end_time_seconds: [1],
			},
		},
	);
	const form = new FormData();
	form.set(
		"file",
		new File([new Uint8Array([82, 73, 70, 70])], "fixture.wav", {
			type: "audio/wav",
		}),
	);
	form.set("language", "hi-IN");
	const result = await POST(request(form));
	expect(result.status).toBe(200);
	expect((await result.json()).timestamps.words).toEqual(["hello"]);
});

test("chat route shares every editor tool and preserves tool-result messages", async () => {
	const messages = [
		{ role: "user", content: "Inspect" },
		{
			role: "assistant",
			content: null,
			tool_calls: [
				{
					id: "state",
					type: "function",
					function: { name: "get_state", arguments: "{}" },
				},
			],
		},
		{ role: "tool", tool_call_id: "state", content: '{"tracks":[]}' },
	];
	mockUpstream(
		(url, init) => {
			expect(url).toBe("https://api.sarvam.ai/v1/chat/completions");
			const body = JSON.parse(String(init.body));
			expect(body.model).toBe("sarvam-105b");
			expect(body.tools).toEqual(modelTools);
			expect(body.messages).toEqual(messages);
			expect(body.tool_choice).toBe("auto");
		},
		{ choices: [{ message: { role: "assistant", content: "Ready" } }] },
	);
	expect((await POST(request({ action: "chat", messages }))).status).toBe(200);
});

test("cross-origin and invalid input never reach the upstream API", async () => {
	let calls = 0;
	mockUpstream(() => {
		calls++;
	});
	expect(
		(
			await POST(
				request(
					{ action: "chat", messages: [{ role: "user", content: "hello" }] },
					"https://other.example",
				),
			)
		).status,
	).toBe(403);
	for (const body of [
		{ action: "translate", text: "", source: "en-IN", target: "hi-IN" },
		{ action: "translate", text: "Hello", source: "en-IN", target: "es-ES" },
		{ action: "speak", text: "Hello", language: "as-IN", speaker: "shubh" },
		{ action: "speak", text: "Hello", language: "hi-IN", speaker: "invalid" },
		{
			action: "speak",
			text: "x".repeat(2501),
			language: "en-IN",
			speaker: "shubh",
		},
		{ action: "chat", messages: [] },
	])
		expect((await POST(request(body))).status).toBe(400);
	const form = new FormData();
	form.set("file", new File([new Uint8Array(10_000_001)], "large.wav"));
	expect((await POST(request(form))).status).toBe(400);
	form.set("file", new File([], "empty.wav"));
	expect((await POST(request(form))).status).toBe(400);
	form.set("file", new File(["audio"], "test.wav"));
	form.set("language", "es-ES");
	expect((await POST(request(form))).status).toBe(400);
	expect(calls).toBe(0);
});
