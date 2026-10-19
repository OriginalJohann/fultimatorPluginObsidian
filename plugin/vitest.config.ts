/**
 * Vitest config: tests the headless core (model, template, serialize,
 * parse, sp, filename, import) without Obsidian (plan §13, T10).
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["test/**/*.test.ts"],
		environment: "node",
	},
});
