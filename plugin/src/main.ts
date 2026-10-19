import { Plugin } from "obsidian";
import { AdversarySettings, DEFAULT_SETTINGS } from "./plugin/settings";
import { FultimatorSettingTab } from "./plugin/setting-tab";
import { DesignerView, VIEW_TYPE_DESIGNER } from "./plugin/view";

export default class FultimatorPlugin extends Plugin {
	settings: AdversarySettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Designer leaf view (T7); the Compendium view follows in T9.
		this.registerView(VIEW_TYPE_DESIGNER, (leaf) => new DesignerView(leaf, this));
		this.addSettingTab(new FultimatorSettingTab(this.app, this));
	}

	onunload(): void {
		// Views are removed by Obsidian when the plugin unloads.
	}

	private async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
