/**
 * Shared types + the Obsidian-coupled operations the Designer/Compendium
 * Svelte components call (plan §10). Kept in a plain TS module so the
 * Svelte components stay loosely coupled from the `obsidian` package.
 */
import { Adversary } from "../core/model";
import { ParsedFile } from "../core/parse";

export interface VaultSettings {
	adversaryFolder: string;
	generatorMarker: string;
	templatePath: string;
}

/** A parsed adversary file as surfaced to the UI. */
export interface AdversaryFile {
	path: string;
	marked: boolean;
	adversary: Adversary;
	parsed: ParsedFile;
}

/**
 * The operations the UI components invoke. The `obsidian` coupling (vault
 * reads/writes, settings) lives in `plugin/view.ts`, which builds this
 * object and hands it to the mounted Svelte component.
 */
export interface DesignerOps {
	settings: VaultSettings;
	/** Create a fresh, empty adversary. */
	newAdversary(): Adversary;
	/**
	 * Save an adversary to `path` (frontmatter + statblock). The folder is
	 * created on first save; the generator marker is stamped.
	 */
	saveAdversary(path: string, a: Adversary): Promise<void>;
	/**
	 * Save a copy of `a` under a new, collision-free name in the adversary
	 * folder. Returns the new path.
	 */
	duplicate(a: Adversary): Promise<string>;
	/** Vault-relative path for an adversary name (sanitized, no collision check). */
	pathFor(name: string): string;
	/** List all `.md` files in the adversary folder. */
	listFiles(): Promise<string[]>;
	/** Parse one adversary file (path = vault-relative `.md`). */
	openFile(path: string): Promise<AdversaryFile>;
}

export interface CompendiumOps {
	settings: VaultSettings;
	listFiles(): Promise<string[]>;
	openFile(path: string): Promise<AdversaryFile>;
	/** Duplicate a file to a new collision-free name. Returns the new path. */
	duplicate(path: string): Promise<string>;
	/** Derive a pre-filled copy (new name, fresh file). Returns the new path. */
	derive(path: string): Promise<string>;
	/** Reveal the file in the leaf / designer. */
	reveal(path: string): Promise<void>;
}