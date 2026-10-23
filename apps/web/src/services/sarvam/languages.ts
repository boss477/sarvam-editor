import { z } from "zod";

// Provider metadata: https://docs.sarvam.ai/api/getting-started/models
export const sarvamLanguages = [
	["hi-IN", "Hindi"],
	["ta-IN", "Tamil"],
	["te-IN", "Telugu"],
	["kn-IN", "Kannada"],
	["ml-IN", "Malayalam"],
	["mr-IN", "Marathi"],
	["bn-IN", "Bengali"],
	["gu-IN", "Gujarati"],
	["pa-IN", "Punjabi"],
	["od-IN", "Odia"],
	["en-IN", "English"],
	["as-IN", "Assamese"],
	["ur-IN", "Urdu"],
	["ne-IN", "Nepali"],
	["sa-IN", "Sanskrit"],
	["kok-IN", "Konkani"],
	["ks-IN", "Kashmiri"],
	["sd-IN", "Sindhi"],
	["sat-IN", "Santali"],
	["mni-IN", "Manipuri"],
	["brx-IN", "Bodo"],
	["mai-IN", "Maithili"],
	["doi-IN", "Dogri"],
] as const;

export const sarvamLanguage = z.enum(sarvamLanguages.map(([code]) => code));
export const bulbulLanguage = z.enum([
	"hi-IN",
	"ta-IN",
	"te-IN",
	"kn-IN",
	"ml-IN",
	"mr-IN",
	"bn-IN",
	"gu-IN",
	"pa-IN",
	"od-IN",
	"en-IN",
]);
export const bulbulSpeaker = z.enum(["shubh", "ritu", "priya", "aditya"]);
