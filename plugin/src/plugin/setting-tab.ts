/**
 * Settings tab (plan §10): folder + template paths, read-only plugin id.
 */
import { App, Setting, SettingTab } from "obsidian";
import FultimatorPlugin from "../main";

export class FultimatorSettingTab extends SettingTab {
	constructor(app: App, private plugin: FultimatorPlugin) {
		super();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Plugin ID")
			.setDesc("Fest (fultimator-fork) – nicht editierbar.");

		new Setting(containerEl)
			.setName("Bestiary-Ordner")
			.setDesc("Vault-Ordner, in den Statblock-Dateien abgelegt werden.")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.adversaryFolder)
					.onChange(async (value) => {
						this.plugin.settings.adversaryFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Template-Pfad")
			.setDesc("Vault-Pfad der .obsidian/templates/Template-Datei.")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.templatePath)
					.onChange(async (value) => {
						this.plugin.settings.templatePath = value.trim();
						await this.plugin.saveSettings();
					})
			);
	}
}
