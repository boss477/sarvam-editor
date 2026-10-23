import { plugin } from "bun";
import { dirname, join } from "node:path";

// wasm-pack's bundler entry expects WASM exports, not Bun's file import.
plugin({
	name: "opencut-wasm-test-loader",
	setup(build) {
		build.onLoad({ filter: /[/\\]opencut-wasm[/\\]opencut_wasm\.js$/ }, ({ path }) => {
			const binaryPath = join(dirname(path), "opencut_wasm_bg.wasm");
			return {
				loader: "js",
				contents: `
import * as bindings from "./opencut_wasm_bg.js";
const binary = await Bun.file(${JSON.stringify(binaryPath)}).arrayBuffer();
const { instance } = await WebAssembly.instantiate(binary, {
  "./opencut_wasm_bg.js": bindings,
});
bindings.__wbg_set_wasm(instance.exports);
instance.exports.__wbindgen_start();
export * from "./opencut_wasm_bg.js";
`,
			};
		});
	},
});
