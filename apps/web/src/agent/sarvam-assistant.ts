import { z } from "zod";

const assistantResponse = z.object({
	choices: z
		.array(
			z.object({
				message: z.object({
					role: z.literal("assistant"),
					content: z.string().nullable().optional(),
					tool_calls: z
						.array(
							z.object({
								id: z.string().min(1),
								type: z.literal("function"),
								function: z.object({
									name: z.string().min(1),
									arguments: z.string(),
								}),
							}),
						)
						.max(16)
						.nullish(),
				}),
			}),
		)
		.min(1),
});
type Message = Record<string, unknown>;

export async function runSarvamAssistant({
	prompt,
	request,
	execute,
}: {
	prompt: string;
	request: (body: { action: "chat"; messages: Message[] }) => Promise<unknown>;
	execute: (name: string, args: unknown) => Promise<unknown>;
}): Promise<string> {
	const messages: Message[] = [
		{
			role: "system",
			content:
				"You control a video editor. Inspect get_state before changes. Use the provided tools. Tool times are seconds. Preserve existing caption tracks. Ask the user when intent is unclear.",
		},
		{ role: "user", content: prompt },
	];
	let calls = 0;
	for (let step = 0; step < 12; step++) {
		const parsed = assistantResponse.safeParse(
			await request({ action: "chat", messages: [...messages] }),
		);
		if (!parsed.success)
			throw new Error("Sarvam returned an invalid assistant response.");
		const message = parsed.data.choices[0].message;
		const toolCalls = message.tool_calls ?? [];
		if (new Set(toolCalls.map((call) => call.id)).size !== toolCalls.length)
			throw new Error("Sarvam returned duplicate tool call IDs.");
		messages.push(message);
		if (!toolCalls.length) return message.content || "Done.";
		for (const call of toolCalls) {
			if (++calls > 64)
				throw new Error(
					"Action limit reached. Review the timeline before continuing.",
				);
			let result: unknown;
			try {
				result = await execute(
					call.function.name,
					JSON.parse(call.function.arguments),
				);
			} catch (error) {
				result = {
					error: error instanceof Error ? error.message : "Action failed",
				};
			}
			messages.push({
				role: "tool",
				tool_call_id: call.id,
				content: JSON.stringify(result ?? null),
			});
		}
	}
	throw new Error(
		"Action limit reached. Review the timeline before continuing.",
	);
}
