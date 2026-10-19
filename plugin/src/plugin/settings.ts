/**
 * Minimal plugin settings (plan Q15): no format details are stored here.
 * All format truth (field names, order, tags, cssclasses) is derived at
 * runtime from the template file (see core/template.ts).
 */
export interface AdversarySettings {
	/** Vault-relative folder where adversary files are stored. */
	adversaryFolder: string;
	/**
	 * Frontmatter marker identifying plugin-managed files. Only files with
	 * this exact `key: value` line are edited in place; foreign files are
	 * never overwritten (hard invariant, plan Q7).
	 */
	generatorMarker: string;
	/**
	 * Vault-relative path of the statblock template – the single source of
	 * truth for the output format (plan Q4).
	 */
	templatePath: string;
}

export const DEFAULT_SETTINGS: AdversarySettings = {
	adversaryFolder: "6. Bestiary",
	generatorMarker: "generator: fultimator",
	templatePath: "7. Blue/1. Basics/Templates/add new Fantasy Statblock Monster.md",
};
