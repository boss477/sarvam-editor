const env = { ...process.env };
if (!env.SARVAM_API_KEY || env.SARVAM_API_KEY === "your_key") {
	delete env.SARVAM_API_KEY;
	console.error(
		"Sarvam API calls need SARVAM_API_KEY in apps/web/.env.local or Sarvam's credentials file. Builder tools remain available.",
	);
}
// The official server's best-effort telemetry includes tool arguments/results.
// Port zero prevents it from sending those payloads to an external collector.
env.SARVAM_MCP_ANALYTICS_URL = "http://127.0.0.1:0";
const child = Bun.spawn(["uvx", "--from", "sarvam-mcp==0.2.12", "sarvam-mcp"], {
	env,
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
});
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
process.exit(await child.exited);
export {};
