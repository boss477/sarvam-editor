import { afterEach, expect, test } from "bun:test";
import {
	disconnectSession,
	dispatchTool,
	finishTool,
	registerSession,
	requireSession,
} from "@/agent/broker";
import { POST } from "./route";

afterEach(() => disconnectSession());
function heartbeat(id: string, origin = "http://localhost:3015") {
	return new Request("http://localhost:3015/api/editor-agent", {
		method: "POST",
		headers: {
			origin,
			"content-type": "application/json",
			"x-editor-session": id,
		},
		body: JSON.stringify({ action: "heartbeat" }),
	});
}

test("session heartbeats refresh pending work without consuming queued commands", async () => {
	const id = registerSession();
	const pending = dispatchTool("get_state", {});
	const session = requireSession(id);
	session.lastSeen = Date.now() - 9000;
	const response = await POST(heartbeat(id));
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ ok: true });
	expect(Date.now() - session.lastSeen).toBeLessThan(1000);
	expect(session.queue).toHaveLength(1);
	finishTool(id, session.queue[0].id, { ok: true });
	expect(await pending).toEqual({ ok: true });
});

test("foreign origins, unknown sessions and expired sessions cannot send heartbeats", async () => {
	const id = registerSession();
	expect((await POST(heartbeat(id, "https://other.example"))).status).toBe(403);
	expect((await POST(heartbeat("wrong"))).status).toBe(400);
	requireSession(id).lastSeen = Date.now() - 10001;
	expect((await POST(heartbeat(id))).status).toBe(400);
	expect(() => requireSession(id)).toThrow("expired");
});
