import { expect, test } from "bun:test";
import { createAgentSessionGuard } from "./session-guard";

function fixture() {
	let active: { metadata: { id: string } } | null = {
		metadata: { id: "original" },
	};
	const guard = createAgentSessionGuard({
		project: {
			getActive: () => ({ metadata: { id: "original" } }),
			getActiveOrNull: () => active,
		},
	});
	return {
		guard,
		select: (id: string | null) => {
			active = id ? { metadata: { id } } : null;
		},
	};
}

test("agent session stays bound to its project and cannot revive after a switch", () => {
	const { guard, select } = fixture();
	expect(() => guard.assertCurrent()).not.toThrow();
	select("original");
	expect(() => guard.assertCurrent()).not.toThrow();
	select("other");
	expect(() => guard.assertCurrent()).toThrow("project changed");
	select("original");
	expect(() => guard.assertCurrent()).toThrow("connection closed");
});

test("closed projects and cancelled sessions cannot execute returned poll commands", async () => {
	const closed = fixture();
	closed.select(null);
	expect(() => closed.guard.assertCurrent()).toThrow("project changed");
	const { guard } = fixture();
	let finishPoll!: () => void;
	const poll = new Promise<void>((resolve) => {
		finishPoll = resolve;
	});
	let executed = false;
	const pending = (async () => {
		await poll;
		guard.assertCurrent();
		executed = true;
	})();
	guard.cancel();
	finishPoll();
	await expect(pending).rejects.toThrow("connection closed");
	expect(executed).toBe(false);
});
