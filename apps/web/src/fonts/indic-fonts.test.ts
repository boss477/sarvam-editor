import { expect, test } from "bun:test";
import { getIndicFontFamily, getLocalFontSample } from "./indic-fonts";

test("script-specific font selection covers bundled Indian scripts", () => {
	for (const [text, script] of [
		["\u0928\u092e\u0938\u094d\u0924\u0947", "Devanagari"],
		["\u09ac\u09be\u0982\u09b2\u09be", "Bengali"],
		["\u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0", "Gujarati"],
		["\u0a2a\u0a70\u0a1c\u0a3e\u0a2c\u0a40", "Gurmukhi"],
		["\u0ba4\u0bae\u0bbf\u0bb4\u0bcd", "Tamil"],
		["\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41", "Telugu"],
		["\u0c95\u0ca8\u0ccd\u0ca8\u0ca1", "Kannada"],
		["\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02", "Malayalam"],
		["\u0b13\u0b21\u0b3c\u0b3f\u0b06", "Oriya"],
		["\u0627\u0631\u062f\u0648", "Arabic"],
		["\u1c65\u1c5f\u1c71\u1c5b\u1c5f\u1c72\u1c64", "Ol Chiki"],
		["\uabc3\uabe4\uabc7\uabe9", "Meetei Mayek"],
	]) {
		const family = `Noto Sans ${script}`;
		expect(getIndicFontFamily(text)).toBe(family);
		expect(getIndicFontFamily(`Creator: ${text}`)).toBe(family);
		expect(getLocalFontSample(family)).toBeString();
	}
	expect(getIndicFontFamily("Hello India 2026")).toBe("Arial");
	expect(getLocalFontSample("Arial")).toBeUndefined();
});
