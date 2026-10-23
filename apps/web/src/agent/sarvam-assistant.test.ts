import { expect, test } from "bun:test";
import { runSarvamAssistant } from "./sarvam-assistant";

const response = (content: string | null, tool_calls?: unknown[]) => ({
	choices: [{ message: { role: "assistant", content, tool_calls } }],
});
const tool = (id: string, name: string, args = "{}") => ({
	id,
	type: "function",
	function: { name, arguments: args },
});

test("assistant returns tool results in order and uses them for a second edit", async () => {
	const executed: string[] = [];
	let turns = 0;
	const answer = await runSarvamAssistant({
		prompt: "Caption this",
		request: async ({ messages }) => {
			turns++;
			if (turns === 1) return response(null, [tool("state", "get_state")]);
			if (turns === 2) {
				expect(messages.at(-1)).toEqual({
					role: "tool",
					tool_call_id: "state",
					content: '{"trackId":"track-1"}',
				});
				return response(null, [
					tool("edit", "add_captions", '{"trackId":"track-1"}'),
				]);
			}
			expect(messages.at(-1)).toEqual({
				role: "tool",
				tool_call_id: "edit",
				content: '{"ok":true}',
			});
			return response("Captions added.");
		},
		execute: async (name, args) => {
			executed.push(name);
			if (name === "get_state") return { trackId: "track-1" };
			expect(args).toEqual({ trackId: "track-1" });
			return { ok: true };
		},
	});
	expect(answer).toBe("Captions added.");
	expect(executed).toEqual(["get_state", "add_captions"]);
});

test("malformed arguments and tool failures are sent back to the assistant", async () => {
	let turns = 0,
		executions = 0;
	await runSarvamAssistant({
		prompt: "Edit",
		request: async ({ messages }) => {
			if (++turns === 1)
				return response(null, [
					tool("bad-json", "trim_clip", "{"),
					tool("bad-tool", "unknown"),
				]);
			const results = messages.filter((item) => item.role === "tool");
			expect(results).toHaveLength(2);
			expect(JSON.parse(results[0].content as string).error).toBeString();
			expect(JSON.parse(results[1].content as string).error).toBe(
				"Unknown editor action",
			);
			return response("Please choose a clip.");
		},
		execute: async () => {
			executions++;
			throw new Error("Unknown editor action");
		},
	});
	expect(executions).toBe(1);
});

test("invalid responses cannot execute tools", async () => {
	let executions = 0;
	for (const value of [
		{},
		response(null, [tool("duplicate", "undo"), tool("duplicate", "redo")]),
	]) {
		await expect(
			runSarvamAssistant({
				prompt: "Edit",
				request: async () => value,
				execute: async () => {
					executions++;
				},
			}),
		).rejects.toThrow();
	}
	expect(executions).toBe(0);
});

test("endless tool requests stop at the turn limit", async () => {
	let executions = 0;
	await expect(
		runSarvamAssistant({
			prompt: "Edit",
			request: async () => response(null, [tool("again", "get_state")]),
			execute: async () => {
				executions++;
				return {};
			},
		}),
	).rejects.toThrow("Action limit reached");
	expect(executions).toBe(12);
});

test("plain assistant responses allow null tool calls", async () => {
	expect(
		await runSarvamAssistant({
			prompt: "Hello",
			request: async () => ({
				choices: [
					{
						message: {
							role: "assistant",
							content: "Namaste",
							tool_calls: null,
						},
					},
				],
			}),
			execute: async () => {
				throw new Error("Must not execute");
			},
		}),
	).toBe("Namaste");
});

test("batched tool requests cannot exceed the total call limit", async () => {
	let executions = 0;
	await expect(
		runSarvamAssistant({
			prompt: "Edit",
			request: async () =>
				response(
					null,
					Array.from({ length: 16 }, (_, i) => tool(String(i), "get_state")),
				),
			execute: async () => {
				executions++;
				return {};
			},
		}),
	).rejects.toThrow("Action limit reached");
	expect(executions).toBe(64);
});
