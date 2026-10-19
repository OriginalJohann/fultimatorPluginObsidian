/**
 * Designer leaf view (plan §5.1, §10.1, T8).
 *
 * Registers the `fultimator-designer` view type and mounts the Svelte
 * `Designer` component. All `obsidian` coupling (vault reads/writes,
 * settings, template loading) is wrapped in a `DesignerOps` object handed
 * to the component; the headless core does all the parsing/serialization.
 */
import { ItemView, TFolder, TFile } from "obsidian";
import { createAdversary, cloneAdversary, Adversary } from "../core/model";
import { parseAdversary } from "../core/parse";
import { serialize } from "../core/serialize";
import { parseTemplate } from "../core/template";
import { calcAvailableSkills } from "../core/sp";
import { sanitizeName, resolveSavePath } from "../core/filename";
import { DesignerOps, AdversaryFile } from "../ui/types";
import Designer from "../ui/designer/Designer.svelte";
import type FultimatorPlugin from "../main";

export const VIEW_TYPE_DESIGNER = "fultimator-designer";

export class DesignerView extends ItemView {
	static readonly VIEW_TYPE = VIEW_TYPE_DESIGNER;

	private plugin: FultimatorPlugin;
	private component: Designer | null = null;

	constructor(leaf: ItemView["leaf"], plugin: FultimatorPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return DesignerView.VIEW_TYPE;
	}

	getViewTitle(): string {
		return "Fultimator";
	}

	getDisplayText(): string {
		return "Fultimator";
	}

	getIcon(): string {
		return "swords";
	}

	async onOpen(): Promise<void> {
		this.containerEl.empty();
		this.component = new Designer({
			target: this.containerEl,
			props: { ops: this.buildOps() },
		});
	}

	async onClose(): Promise<void> {
		this.component?.$destroy();
		this.component = null;
		this.containerEl.empty();
	}

	// --- vault helpers ---------------------------------------------------

	private folderFiles(): TFile[] {
		const folder = this.plugin.settings.adversaryFolder;
		return this.plugin.app.vault
			.getMarkdownFiles()
			.filter((f) => f.path.startsWith(folder + "/") && f.path.endsWith(".md"));
	}

	/** Paths of files in the adversary folder that carry the plugin marker. */
	private async markedPaths(): Promise<Set<string>> {
		const marker = this.plugin.settings.generatorMarker;
		const set = new Set<string>();
		// Bounded by the adversary folder size; a plain content scan is
		// simpler and more reliable than relying on the frontmatter cache.
		for (const f of this.folderFiles()) {
			const content = await this.plugin.app.vault.read(f);
			if (content.includes(marker)) set.add(f.path);
		}
		return set;
	}

	private async template() {
		const f = this.plugin.app.vault.getAbstractFileByPath(this.plugin.settings.templatePath);
		if (!(f instanceof TFile)) throw new Error(`Template not found: ${this.plugin.settings.templatePath}`);
		return parseTemplate(await this.plugin.app.vault.read(f));
	}

	// --- ops wiring ------------------------------------------------------

	private buildOps(): DesignerOps {
		const app = this.plugin.app;
		const settings = this.plugin.settings;
		const folder = settings.adversaryFolder;

		const ensureFolder = async () => {
			if (!folder) return;
			const existing = app.vault.getAbstractFileByPath(folder);
			if (!(existing instanceof TFolder)) await app.vault.createFolder(folder);
		};

		const saveAdversary = async (path: string, a: Adversary) => {
			// sp_pool is always recomputed on save (plan §14).
			a.spPool = calcAvailableSkills(a);
			const tpl = await this.template();
			const content = serialize(a, tpl, settings.generatorMarker);
			await ensureFolder();
			const file = app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await app.vault.modify(file, content);
			} else {
				await app.vault.create(path, content);
			}
		};

		const duplicate = async (a: Adversary) => {
			const base = a.name ? a.name : "Untitled";
			const existing = new Set(this.folderFiles().map((f) => f.path));
			const marked = await this.markedPaths();
			const path = resolveSavePath(base, folder, existing, (p) => marked.has(p));
			await saveAdversary(path, cloneAdversary(a));
			return path;
		};

		const pathFor = (name: string): string => {
			const existing = new Set(this.folderFiles().map((f) => f.path));
			return resolveSavePath(name, folder, existing, () => false);
		};

		const listFiles = async () => this.folderFiles().map((f) => f.path).sort();

		const openFile = async (path: string): Promise<AdversaryFile> => {
			const file = app.vault.getAbstractFileByPath(path) as TFile;
			const text = await app.vault.read(file);
			const parsed = parseAdversary(text, settings.generatorMarker);
			return { path, marked: parsed.marked, adversary: parsed.npc, parsed };
		};

		return {
			settings,
			newAdversary: () => createAdversary(),
			saveAdversary,
			duplicate,
			pathFor,
			listFiles,
			openFile,
		};
	}
}

/** Open (or reveal) the designer in a leaf of the given group. */
export async function revealDesigner(leaf: ItemView["leaf"]): Promise<void> {
	leaf.setViewState({ type: VIEW_TYPE_DESIGNER, active: true });
}
