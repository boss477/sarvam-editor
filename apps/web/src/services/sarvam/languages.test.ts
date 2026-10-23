import { expect, test } from "bun:test";
import { toolDefinitions } from "@/agent/tools";
import { bulbulLanguage, sarvamLanguage, sarvamLanguages } from "./languages";

test("all 23 catalog languages are available to captions and export tools", () => {
	expect(sarvamLanguages).toHaveLength(23);
	expect(new Set(sarvamLanguages.map(([code]) => code)).size).toBe(23);
	for (const [language] of sarvamLanguages) {
		expect(sarvamLanguage.safeParse(language).success).toBe(true);
		expect(
			toolDefinitions.transcribe.schema.safeParse({ language }).success,
		).toBe(true);
		expect(
			toolDefinitions.translate_captions.schema.safeParse({
				trackId: "captions",
				source: "en-IN",
				target: language,
			}).success,
		).toBe(true);
		expect(
			toolDefinitions.export_languages.schema.safeParse({
				variants: [{ language, captionTrackId: "captions" }],
			}).success,
		).toBe(true);
	}
});

test("voice tools only accept the 11 Bulbul v3 languages", () => {
	expect(bulbulLanguage.options).toHaveLength(11);
	for (const [language] of sarvamLanguages) {
		const supported = bulbulLanguage.safeParse(language).success;
		expect(
			toolDefinitions.dub.schema.safeParse({ trackId: "captions", language })
				.success,
		).toBe(supported);
	}
	expect(bulbulLanguage.safeParse("as-IN").success).toBe(false);
	expect(sarvamLanguage.safeParse("es-ES").success).toBe(false);
});
