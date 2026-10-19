/**
 * Build script: bundle src/main.ts → main.js (CJS, obsidian external).
 * Usage: node build.mjs
 */
import esbuild from "esbuild";
import sveltePlugin from "esbuild-svelte";

const result = await esbuild.build({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian"],
	format: "cjs",
	platform: "node",
	target: "es2020",
	outfile: "main.js",
	sourcemap: false,
	minify: true,
	plugins: [sveltePlugin()],
});

if (result.errors.length > 0) {
	console.error(result.errors);
	process.exit(1);
}
console.log("BUILD_OK main.js");
