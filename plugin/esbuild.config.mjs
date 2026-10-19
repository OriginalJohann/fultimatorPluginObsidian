import esbuild from "esbuild";
import { createRequire } from "node:module";
import Svelte from "esbuild-svelte";

const require = createRequire(import.meta.url);
const prod = process.argv[2] === "production";

/**
 * @type {import('esbuild').BuildOptions}
 * esbuild options shared between dev and production builds.
 * The Svelte plugin compiles .svelte UI components in the same pipeline.
 * Output is always `main.js` at the plugin root (Obsidian manifest `main`).
 */
const opts = {
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...require("builtin-modules"),
	],
	loader: { ".png": "dataurl", ".svg": "dataurl" },
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	minify: prod,
	outfile: "main.js",
	plugins: [Svelte({ hot: !prod })],
};

/**
 * Dev: watch the plugin sources and rebuild on change.
 * Production: single build.
 */
if (!prod) {
	const ctx = await esbuild.context(opts);
	await ctx.watch();
} else {
	await esbuild.build(opts);
}
