import { test, expect, afterEach } from "bun:test";
import { sarvamRequest, sameOrigin } from "./server";

const originalFetch = globalThis.fetch;
const originalKey = process.env.SARVAM_API_KEY;
afterEach(() => {
	globalThis.fetch = originalFetch;
	if (originalKey === undefined) delete process.env.SARVAM_API_KEY;
	else process.env.SARVAM_API_KEY = originalKey;
});

test("missing credentials fail before sending audio or text", async () => {
	delete process.env.SARVAM_API_KEY;
	await expect(sarvamRequest({ path: "/translate", body: {} })).rejects.toThrow(
		"SARVAM_API_KEY",
	);
});

test("API key is sent only as an authentication header", async () => {
	process.env.SARVAM_API_KEY = "test-credential";
	let called = false;
	globalThis.fetch = Object.assign(
		async (input: string | URL | Request, init?: RequestInit) => {
			called = true;
			expect(String(input)).toBe("https://api.sarvam.ai/translate");
			expect(new Headers(init?.headers).get("api-subscription-key")).toBe(
				"test-credential",
			);
			expect(String(init?.body)).not.toContain("test-credential");
			return Response.json({ translated_text: "translated" });
		},
		{ preconnect: originalFetch.preconnect },
	);
	expect(
		await sarvamRequest({ path: "/translate", body: { input: "hello" } }),
	).toEqual({ translated_text: "translated" });
	expect(called).toBe(true);
});

test("cross-origin requests cannot invoke browser AI actions", () => {
	expect(
		sameOrigin(
			new Request("http://localhost:3015/api/sarvam", {
				headers: { origin: "https://other.example" },
			}),
		),
	).toBe(false);
	expect(
		sameOrigin(
			new Request("http://localhost:3015/api/sarvam", {
				headers: { origin: "http://localhost:3015" },
			}),
		),
	).toBe(true);
});
