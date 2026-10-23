export async function sarvamRequest({
	path,
	body,
}: {
	path: string;
	body: FormData | Record<string, unknown>;
}) {
	const key = process.env.SARVAM_API_KEY;
	if (!key || key === "your_key")
		throw new Error(
			"Set SARVAM_API_KEY in apps/web/.env.local and restart the server.",
		);
	const multipart = body instanceof FormData;
	const response = await fetch("https://api.sarvam.ai" + path, {
		method: "POST",
		headers: {
			"api-subscription-key": key,
			...(multipart ? {} : { "Content-Type": "application/json" }),
		},
		body: multipart ? body : JSON.stringify(body),
		signal: AbortSignal.timeout(120000),
	});
	if (!response.ok)
		throw new Error(
			"Sarvam request failed (" +
				response.status +
				"): " +
				(await response.text()).slice(0, 500),
		);
	return response.json();
}
export function sameOrigin(request: Request) {
	const origin = request.headers.get("origin");
	return origin === new URL(request.url).origin;
}
