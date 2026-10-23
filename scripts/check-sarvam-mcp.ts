import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "bharat-sarvam-check", version: "1.0.0" });
const transport = new StdioClientTransport({
	command: process.execPath,
	args: ["--env-file=apps/web/.env.local", "scripts/sarvam-mcp.ts"],
});
try {
	await client.connect(transport);
	const { tools } = await client.listTools();
	if (!tools.some((tool) => tool.name.startsWith("sarvam_code_")))
		throw new Error("Sarvam builder tools were not discovered.");
	console.log("Official Sarvam MCP tools: " + tools.length);
	console.log(tools.map((tool) => tool.name).join("\n"));
	const reference = tools.find((tool) => tool.name === "sarvam_code_api_reference");
	if (process.argv.includes("--schema"))
		console.log(JSON.stringify(reference?.inputSchema));
	if (process.argv.includes("--reference")) {
		const result = await client.callTool({
			name: "sarvam_code_api_reference",
			arguments: { endpoint: "/text-to-speech" },
		});
		const text = JSON.stringify(result.content);
		if (result.isError || !text.includes("/text-to-speech"))
			throw new Error("Sarvam builder reference lookup failed.");
		console.log("Builder reference lookup succeeded: " + text.slice(0, 1800));
	}
} finally {
	await client.close();
}
