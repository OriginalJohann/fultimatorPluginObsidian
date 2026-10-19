/**
 * Template single-source-of-truth reader (plan Q4/Q15).
 *
 * The template file defines the output format: frontmatter fields (tags,
 * cssclasses, statblock mode) and the statblock section order. This module
 * parses the template .md and exposes the derived format config, so no
 * format detail is duplicated in plugin settings.
 *
 * Headless: no Obsidian imports.
 */

export interface TemplateFrontmatter {
	/** Raw key/value lines of the template frontmatter (order preserved). */
	rawLines: string[];
	/** Parsed frontmatter as best-effort key → scalar-or-list map. */
	fields: Record<string, string | string[]>;
}

export interface TemplateFormat {
	/** Frontmatter derived from the template. */
	frontmatter: TemplateFrontmatter;
	/** Section order of the statblock block, exactly as in the template. */
	sectionOrder: string[];
	/** Full template content (for diagnostics). */
	raw: string;
}

/**
 * Extract the frontmatter block (between the first two `---` lines) as raw
 * lines, and parse it into a best-effort field map.
 */
export function parseFrontmatterBlock(content: string): TemplateFrontmatter {
	const lines = content.split("\n");
	const rawLines: string[] = [];
	const fields: Record<string, string | string[]> = {};

	if (lines[0]?.trim() !== "---") {
		return { rawLines, fields };
	}
	let inBlock = false;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === "---") {
			inBlock = true;
			break;
		}
	}
	if (!inBlock) return { rawLines, fields };

	// Collect raw lines up to the closing `---`.
	const body: string[] = [];
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === "---") break;
		body.push(lines[i]);
	}
	rawLines.push(...body);

	// Best-effort parse: `key: value`, `key:` (list start), `  - item`.
	let currentListKey: string | null = null;
	for (const line of body) {
		if (/^\s+-\s+/.test(line)) {
			if (currentListKey) {
				const arr = (fields[currentListKey] as string[]) ?? [];
				arr.push(line.replace(/^\s+-\s+/, "").trim());
				fields[currentListKey] = arr;
			}
		} else if (/^\s*#/.test(line) || line.trim() === "") {
			currentListKey = null;
		} else if (/^[\w-]+:/.test(line)) {
			const idx = line.indexOf(":");
			const key = line.slice(0, idx).trim();
			const value = line.slice(idx + 1).trim();
			if (value === "") {
				fields[key] = [];
				currentListKey = key;
			} else {
				fields[key] = value;
				currentListKey = null;
			}
		}
	}
	return { rawLines, fields };
}

/**
 * Extract the ordered section keys of the ```statblock block.
 * A section key is a top-level `key:` line inside the block. List sections
 * (attacks-m, spells, …) are recorded once, at first occurrence.
 */
export function parseStatblockSections(content: string): string[] {
	const sectionOrder: string[] = [];
	const inBlock = /```statblock/.test(content);
	if (!inBlock) return sectionOrder;

	const lines = content.split("\n");
	let inBlockLines = false;
	for (const line of lines) {
		if (/```statblock/.test(line)) {
			inBlockLines = true;
			continue;
		}
		if (inBlockLines && line.trim() === "```") {
			break;
		}
		if (!inBlockLines) continue;
		const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
		if (m && !sectionOrder.includes(m[1])) {
			sectionOrder.push(m[1]);
		}
	}
	return sectionOrder;
}

/**
 * Parse the full template file into a TemplateFormat.
 * Throws if the template has no statblock block (it is not a statblock template).
 */
export function parseTemplate(raw: string): TemplateFormat {
	const format: TemplateFormat = {
		frontmatter: parseFrontmatterBlock(raw),
		sectionOrder: parseStatblockSections(raw),
		raw,
	};
	if (format.sectionOrder.length === 0) {
		throw new Error("Template has no ```statblock block – is this the statblock template?");
	}
	return format;
}

/**
 * The generator marker line to inject into frontmatter (plan Q7).
 * Format: `key: value` – compared line-wise, so trailing spaces matter
 * for the invariant check, not for the marker itself.
 */
export function markerKey(marker: string): string {
	const idx = marker.indexOf(":");
	return idx >= 0 ? marker.slice(0, idx).trim() : marker.trim();
}

export function markerValue(marker: string): string {
	const idx = marker.indexOf(":");
	return idx >= 0 ? marker.slice(idx + 1).trim() : "";
}
