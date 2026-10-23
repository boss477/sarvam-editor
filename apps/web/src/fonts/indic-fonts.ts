const scriptFonts = [
	[
		/\p{Script=Devanagari}/u,
		"Noto Sans Devanagari",
		"\u0928\u092e\u0938\u094d\u0924\u0947",
	],
	[
		/\p{Script=Bengali}/u,
		"Noto Sans Bengali",
		"\u09ac\u09be\u0982\u09b2\u09be",
	],
	[
		/\p{Script=Gujarati}/u,
		"Noto Sans Gujarati",
		"\u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0",
	],
	[
		/\p{Script=Gurmukhi}/u,
		"Noto Sans Gurmukhi",
		"\u0a2a\u0a70\u0a1c\u0a3e\u0a2c\u0a40",
	],
	[/\p{Script=Tamil}/u, "Noto Sans Tamil", "\u0ba4\u0bae\u0bbf\u0bb4\u0bcd"],
	[
		/\p{Script=Telugu}/u,
		"Noto Sans Telugu",
		"\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41",
	],
	[
		/\p{Script=Kannada}/u,
		"Noto Sans Kannada",
		"\u0c95\u0ca8\u0ccd\u0ca8\u0ca1",
	],
	[
		/\p{Script=Malayalam}/u,
		"Noto Sans Malayalam",
		"\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02",
	],
	[/\p{Script=Oriya}/u, "Noto Sans Oriya", "\u0b13\u0b21\u0b3c\u0b3f\u0b06"],
	[/\p{Script=Arabic}/u, "Noto Sans Arabic", "\u0627\u0631\u062f\u0648"],
	[
		/\p{Script=Ol_Chiki}/u,
		"Noto Sans Ol Chiki",
		"\u1c65\u1c5f\u1c71\u1c5b\u1c5f\u1c72\u1c64",
	],
	[
		/\p{Script=Meetei_Mayek}/u,
		"Noto Sans Meetei Mayek",
		"\uabc3\uabe4\uabc7\uabe9",
	],
] as const;

export function getIndicFontFamily(text: string): string {
	return scriptFonts.find(([script]) => script.test(text))?.[1] ?? "Arial";
}

export function getLocalFontSample(family: string): string | undefined {
	return scriptFonts.find(([, name]) => name === family)?.[2];
}
