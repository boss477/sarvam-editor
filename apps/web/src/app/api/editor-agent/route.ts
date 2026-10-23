import {
	registerSession,
	requireSession,
	disconnectSession,
	dispatchTool,
	finishTool,
} from "@/agent/broker";
import { sameOrigin } from "@/services/sarvam/server";
import { toolDefinitions, type ToolName } from "@/agent/tools";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
	try {
		const data = await request.json();
		if (data.action === "call") {
			const token = process.env.EDITOR_AGENT_TOKEN;
			if (!token || request.headers.get("authorization") !== "Bearer " + token)
				return Response.json(
					{ error: "Invalid EDITOR_AGENT_TOKEN" },
					{ status: 401 },
				);
			if (!Object.hasOwn(toolDefinitions, data.name))
				throw new Error("Unknown editor tool.");
			const args = toolDefinitions[data.name as ToolName].schema.parse(
				data.args,
			);
			return Response.json({ result: await dispatchTool(data.name, args) });
		}
		if (!sameOrigin(request))
			return Response.json({ error: "Origin rejected" }, { status: 403 });
		if (data.action === "connect")
			return Response.json({ sessionId: registerSession() });
		const session = requireSession(
			request.headers.get("x-editor-session") || "",
		);
		if (data.action === "heartbeat") return Response.json({ ok: true });
		if (data.action === "poll") {
			const commands = session.queue.splice(0);
			return Response.json({ commands });
		}
		if (data.action === "disconnect") {
			disconnectSession();
			return Response.json({ ok: true });
		}
		if (data.action === "result") {
			finishTool(session.id, data.id, data.result, data.error);
			return Response.json({ ok: true });
		}
		throw new Error("Unknown bridge action.");
	} catch (error) {
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Editor bridge failed",
			},
			{ status: 400 },
		);
	}
}
