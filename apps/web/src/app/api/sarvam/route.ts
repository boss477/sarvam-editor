import { z } from "zod";
import { sarvamRequest, sameOrigin } from "@/services/sarvam/server";
import { modelTools } from "@/agent/tools";
import {
	sarvamLanguage,
	bulbulLanguage,
	bulbulSpeaker,
} from "@/services/sarvam/languages";
export const runtime = "nodejs";
export const maxDuration = 180;
const payload = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("translate"),
		text: z.string().min(1).max(2000),
		source: sarvamLanguage,
		target: sarvamLanguage,
	}),
	z.object({
		action: z.literal("speak"),
		text: z.string().min(1).max(2500),
		language: bulbulLanguage,
		speaker: bulbulSpeaker,
	}),
	z.object({
		action: z.literal("chat"),
		messages: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
	}),
]);
export async function POST(request: Request) {
	if (!sameOrigin(request))
		return Response.json({ error: "Origin rejected" }, { status: 403 });
	try {
		if (request.headers.get("content-type")?.includes("multipart/form-data")) {
			const incoming = await request.formData();
			const file = incoming.get("file");
			if (!(file instanceof File) || file.size === 0 || file.size > 10_000_000)
				throw new Error("Provide a nonempty audio file under 10 MB.");
			const form = new FormData();
			form.set("file", file);
			form.set("model", "saaras:v4");
			form.set("with_timestamps", "true");
			const language = z
				.union([sarvamLanguage, z.literal("unknown")])
				.parse(incoming.get("language") || "unknown");
			form.set("language_code", language);
			return Response.json(
				await sarvamRequest({ path: "/speech-to-text", body: form }),
			);
		}
		const data = payload.parse(await request.json());
		const result =
			data.action === "translate"
				? await sarvamRequest({
						path: "/translate",
						body: {
							input: data.text,
							source_language_code: data.source,
							target_language_code: data.target,
							model: "sarvam-translate:v1",
						},
					})
				: data.action === "speak"
					? await sarvamRequest({
							path: "/text-to-speech",
							body: {
								text: data.text,
								language_code: data.language,
								speaker: data.speaker,
								model: "bulbul:v3",
								speech_sample_rate: 24000,
							},
						})
					: await sarvamRequest({
							path: "/v1/chat/completions",
							body: {
								model: "sarvam-105b",
								messages: data.messages,
								tools: modelTools,
								tool_choice: "auto",
								max_tokens: 2048,
							},
						});
		return Response.json(result);
	} catch (error) {
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Sarvam request failed",
			},
			{ status: 400 },
		);
	}
}
