// Type declarations for Svelte single-file components imported from
// TypeScript (the Svelte compiler is handled by esbuild at build time).
declare module "*.svelte" {
	import { SvelteComponent } from "svelte";
	export default class SvelteComponentClass extends SvelteComponent {
		constructor(options?: {
			target?: Element | Document;
			anchor?: Element;
			props?: Record<string, unknown>;
			context?: Map<string, unknown>;
		});
		$destroy(): void;
		$set(props: Record<string, unknown>): void;
	}
}