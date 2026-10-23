import { strict as assert } from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const expected = process.argv[2];
if (!expected)
	throw new Error(
		"Usage: bun scripts/test-editor-connection.ts <project-id|--disconnected>",
	);
const client = new Client({ name: "bharat-connection-test", version: "1.0.0" });
const transport = new StdioClientTransport({
	command: process.execPath,
	args: ["--env-file=apps/web/.env.local", "scripts/editor-mcp.ts"],
});
try {
	await client.connect(transport);
	const result = await client.callTool({ name: "get_state", arguments: {} });
	const content = result.content;
	assert(Array.isArray(content), "MCP returned no content");
	const message = content.find((item) => item.type === "text");
	assert(
		message && typeof message.text === "string",
		"MCP returned no text result",
	);
	if (expected === "--disconnected") {
		assert.equal(
			result.isError,
			true,
			"An unconnected project accepted an MCP command",
		);
		assert.match(
			message.text,
			/enable agent control|connection expired|disconnected/i,
		);
		console.log("MCP correctly rejected the disconnected editor.");
	} else {
		assert.notEqual(result.isError, true, message.text);
		const state = JSON.parse(message.text);
		assert.equal(
			state.project.id,
			expected,
			"MCP targeted a different project",
		);
		console.log(
			"MCP targets the explicitly connected project: " + state.project.id,
		);
	}
} finally {
	await client.close();
}
