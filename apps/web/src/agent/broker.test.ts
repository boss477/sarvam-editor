import { test, expect, afterEach } from "bun:test";
import {
	registerSession,
	requireSession,
	dispatchTool,
	finishTool,
	disconnectSession,
} from "./broker";
import { toolDefinitions } from "./tools";
afterEach(() => disconnectSession());

test("an expired session cannot be revived by a late browser poll", () => {
	const id = registerSession();
	requireSession(id).lastSeen = Date.now() - 10001;
	expect(() => requireSession(id)).toThrow("expired");
});

test("abandoned pending calls expire even when browser cleanup never ran", async () => {
	const id = registerSession();
	const result = dispatchTool("get_state", {}).catch(
		(error: Error) => error.message,
	);
	requireSession(id).lastSeen = Date.now() - 10001;
	expect(await result).toContain("disconnected");
	expect(() => requireSession(id)).toThrow("expired");
});

test("fresh heartbeats retain pending work and stale sessions can be replaced", async () => {
	const id = registerSession();
	const result = dispatchTool("get_state", {}).catch(
		(error: Error) => error.message,
	);
	const session = requireSession(id);
	session.lastSeen = Date.now() - 9000;
	expect(requireSession(id).pending.size).toBe(1);
	expect(Date.now() - session.lastSeen).toBeLessThan(1000);
	session.lastSeen = Date.now() - 10001;
	const replacement = registerSession();
	expect(replacement).not.toBe(id);
	expect(await result).toContain("disconnected");
});
test("only connected editor can finish commands; commands are delivered once", async () => {
	const id = registerSession(),
		result = dispatchTool("get_state", {});
	const session = requireSession(id),
		[command] = session.queue.splice(0);
	expect(session.queue).toHaveLength(0);
	expect(() => finishTool("wrong", command.id, {})).toThrow();
	finishTool(id, command.id, { project: "test" });
	expect(await result).toEqual({ project: "test" });
});
test("disconnect rejects in-flight work and another tab cannot replace active editor", async () => {
	const id = registerSession();
	expect(() => registerSession()).toThrow();
	const pending = dispatchTool("undo", {});
	const rejection = pending.catch((error: Error) => error.message);
	disconnectSession();
	expect(await rejection).toContain("disconnected");
	expect(() => requireSession(id)).toThrow();
});
test("no connected browser and concurrent calls return actionable errors", async () => {
	await expect(dispatchTool("undo", {})).rejects.toThrow("Open a project");
	const id = registerSession(),
		pending = dispatchTool("undo", {});
	await expect(dispatchTool("redo", {})).rejects.toThrow("busy");
	const [command] = requireSession(id).queue.splice(0);
	finishTool(id, command.id, { ok: true });
	await pending;
});
test("tool schemas reject negative, nonfinite and empty edits", () => {
	expect(() =>
		toolDefinitions.split_clip.schema.parse({
			trackId: "t",
			elementId: "e",
			time: -1,
		}),
	).toThrow();
	expect(() =>
		toolDefinitions.trim_clip.schema.parse({
			trackId: "t",
			elementId: "e",
			trimStart: Infinity,
			trimEnd: 0,
		}),
	).toThrow();
	expect(() =>
		toolDefinitions.add_captions.schema.parse({ captions: [] }),
	).toThrow();
});

test("motion title schema bounds text, timing and color", () => {
	const valid = { text: "Made for India", preset: "pop" };
	expect(toolDefinitions.add_motion_title.schema.parse(valid).duration).toBe(4);
	for (const override of [
		{ text: " " },
		{ duration: 0 },
		{ duration: Infinity },
		{ startTime: -1 },
		{ color: "red" },
		{ preset: "unknown" },
	])
		expect(() =>
			toolDefinitions.add_motion_title.schema.parse({ ...valid, ...override }),
		).toThrow();
});
