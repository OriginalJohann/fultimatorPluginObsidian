/**
 * Markdown file → Adversary model, plan §5.
 *
 * Tolerant by design (plan §5.3.3): hand-edited or foreign files parse
 * without data loss – unparseable `desc` segments fall back to raw text,
 * unknown sections are preserved in `meta.unknownBlockLines`.
 *
 * Headless: no Obsidian imports.
 */
import {
	Adversary,
	AFFINITY_KEYS,
	AffinityKey,
	AttackDetail,
	createAffinities,
	SkillDetail,
	SpellDetail,
	SpCostEntry,
	StatListEntry,
} from "./model";

const AFFINITY_VALUES = new Set(["RS", "VU", "AB", "IM"]);

/**
 * Parse a single YAML scalar: double-quoted (with escapes), single-quoted
 * or plain. Returns the unquoted string.
 */
export function parseYamlScalar(raw: string): string {
	const text = raw.trim();
	if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
		return text
			.slice(1, -1)
			.replace(/\\'/g, "'")
			.replace(/\\"/g, '"')
			.replace(/\\\\/g, "\\");
	}
	if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
		return text.slice(1, -1);
	}
	// Strip trailing comments on plain scalars.
	const hashIdx = text.indexOf(" #");
	return (hashIdx >= 0 ? text.slice(0, hashIdx) : text).trim();
}

export interface FrontmatterData {
	/** Raw lines of the frontmatter block (excluding the `---` fences). */
	rawLines: string[];
	/** Best-effort field map (scalars unquoted, lists as string arrays). */
	fields: Record<string, string | string[]>;
	/** Plugin extension: spCost entries. */
	spCosts: SpCostEntry[];
	/** Plugin extension: cached SP pool. */
	spPool: number | null;
}

export interface ParsedFile {
	npc: Adversary;
	/** Parsed frontmatter (raw preserved for round-trip of foreign files). */
	frontmatter: FrontmatterData;
	/**
	 * Top-level statblock lines that were not recognized (foreign keys).
	 * Preserved verbatim so re-serialization of foreign files loses nothing.
	 */
	unknownBlockLines: string[];
	/** True iff the file carries the plugin generator marker. */
	marked: boolean;
}

/** Check whether the file carries the plugin marker line (plan Q7). */
export function hasMarker(content: string, marker: string): boolean {
	return content.split("\n").some((line) => line.trim() === marker.trim());
}

/** Extract and parse the frontmatter block (tolerant). */
export function parseFrontmatter(content: string): FrontmatterData {
	const lines = content.split("\n");
	const data: FrontmatterData = { rawLines: [], fields: {}, spCosts: [], spPool: null };
	if (lines[0]?.trim() !== "---") return data;

	let end = -1;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === "---") {
			end = i;
			break;
		}
	}
	if (end < 0) return data;

	data.rawLines = lines.slice(1, end);

	let currentListKey: string | null = null;
	let spCostsMode = false;
	let pendingSpCost: SpCostEntry | null = null;

	for (const line of data.rawLines) {
		const spCostEntry = line.match(/^\s+-\s+name:\s*(.*)$/);
		if (spCostsMode && spCostEntry) {
			pendingSpCost = {
				name: parseYamlScalar(spCostEntry[1]),
				spCost: 1,
			};
			continue;
		}
		if (spCostsMode && pendingSpCost) {
			const spCost = line.match(/^\s+spCost:\s*(.*)$/);
			if (spCost) {
				pendingSpCost.spCost = Number(parseYamlScalar(spCost[1])) || 1;
				data.spCosts.push(pendingSpCost);
				pendingSpCost = null;
				continue;
			}
		}
		if (/^\s+-\s+/.test(line)) {
			if (currentListKey) {
				const arr = (data.fields[currentListKey] as string[]) ?? [];
				arr.push(parseYamlScalar(line.replace(/^\s+-\s+/, "")));
				data.fields[currentListKey] = arr;
			}
			continue;
		}
		const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
		if (!m) continue;
		const key = m[1];
		const value = m[2].trim();
		if (key === "sp_costs") {
			spCostsMode = true;
			data.fields[key] = [];
			currentListKey = null;
			continue;
		}
		spCostsMode = false;
		if (value === "") {
			data.fields[key] = [];
			currentListKey = key;
		} else {
			data.fields[key] = parseYamlScalar(value);
			currentListKey = null;
			if (key === "sp_pool") data.spPool = Number(parseYamlScalar(value)) || null;
		}
	}
	return data;
}
/**
 * Extract the lines between the ```statblock fence and the closing ```.
 */
export function extractStatblockLines(content: string): string[] {
	const lines = content.split("\n");
	const block: string[] = [];
	let inBlock = false;
	for (const line of lines) {
		if (!inBlock && /```statblock/.test(line)) {
			inBlock = true;
			continue;
		}
		if (inBlock && line.trim() === "```") break;
		if (inBlock) block.push(line);
	}
	return block;
}

/** Decode an attack `desc` into structured subfields (tolerant, plan §5.3.3). */
export function decodeAttackDesc(desc: string): AttackDetail | null {
	const m = desc.match(
		/^\*\*\[([^\]]*) \+ ([^\]]*)\] ~ \[([^\]]*)\] (\S+)\*\* damage(.*?)( \(extra damage\))?\s*$/
	);
	if (!m) return null;
	const specialText = m[5]?.trim().replace(/^[,\s]+/, "") ?? "";
	return {
		attr1: m[1],
		attr2: m[2],
		damage: m[3],
		type: m[4],
		special: specialText
			? specialText.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
			: [],
		extraDamage: m[6] !== undefined,
	};
}

/**
 * Decode a spell `name` into structured subfields (plan §5.1).
 * Returns null when the line is plain text (tolerant fallback).
 */
export function decodeSpellName(name: string): { spell: SpellDetail } | null {
	const m = name.match(
		/^(\$ )?(.+?)( ~ \[([^\]]*)\] \+ ([^\s~][^~]*))? ~ (.+) ~ (.+) ~ (.+)$/
	);
	if (!m) return null;
	const check = m[4] !== undefined;
	// Serializer order: name ~ [check] ~ MP ~ Target ~ Duration
	const mp = m[6];
	const target = m[7];
	const duration = m[8];
	return {
		spell: {
			offensive: m[1] === "$ ",
			name: m[2],
			attr1: check ? m[4] : "",
			attr2: check ? m[5] : "",
			mp,
			target,
			duration,
			damagetype: "",
			special: [],
			effect: "",
		},
	};
}

/** Decode a skill `desc` (free text) into structured subfields. */
export function decodeSkillDesc(desc: string): SkillDetail {
	return { spCost: 1, effect: desc };
}

/**
 * Parse one statblock list section (entries with name + desc).
 */
function parseListSection(lines: string[], key: string): StatListEntry[] {
	const idx = lines.findIndex((l) => l.trim() === `${key}:`);
	if (idx < 0) return [];
	const entries: StatListEntry[] = [];
	for (let i = idx + 1; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === "") continue;
		// A new top-level key ends this section.
		if (/^[A-Za-z_][\w-]*:/.test(line)) break;
		const nameMatch = line.match(/^\s+-\s+name:\s*(.*)$/);
		if (nameMatch) {
			entries.push({ name: parseYamlScalar(nameMatch[1]), desc: "" });
			continue;
		}
		const descMatch = line.match(/^\s+desc:\s*(.*)$/);
		if (descMatch && entries.length > 0) {
			entries[entries.length - 1].desc = parseYamlScalar(descMatch[1]);
		}
	}
	return entries;
}

/**
 * Parse the full file into an Adversary model. Never throws for foreign
 * files: unknown content is preserved (raw frontmatter, unknown block lines).
 */
export function parseAdversary(content: string, marker: string): ParsedFile {
	const frontmatter = parseFrontmatter(content);
	const blockLines = extractStatblockLines(content);

	const npc: Adversary = {
		name: "",
		rank: "",
		level: 0,
		species: "",
		description: "",
		traits: "",
		typicaltraits: "",
		DEX: 0,
		INS: 0,
		MIG: 0,
		WLP: 0,
		HP: 0,
		MP: 0,
		DEF: 0,
		MDEF: 0,
		initiative: 0,
		affinities: createAffinities(),
		attacksMelee: parseListSection(blockLines, "attacks-m"),
		attacksRanged: parseListSection(blockLines, "attacks-r"),
		spells: parseListSection(blockLines, "spells"),
		skills: parseListSection(blockLines, "skills"),
		rules: parseListSection(blockLines, "rules"),
	};

	const scalarKeys = new Set([
		"name", "rank", "level", "species", "description", "traits",
		"typicaltraits", "DEX", "INS", "MIG", "WLP", "HP", "MP",
		"DEF", "MDEF", "initiative", "layout",
	]);
	const listKeys = new Set([
		"attacks-m", "attacks-r", "spells", "skills", "rules",
	]);

	const unknownBlockLines: string[] = [];
	for (const line of blockLines) {
		if (line.trim() === "" || line.trim().startsWith("#")) continue;
		const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
		if (!m) continue;
		const key = m[1];
		const value = m[2].trim();
		if (scalarKeys.has(key)) {
			if (key === "layout") continue;
			if (["level", "DEX", "INS", "MIG", "WLP", "HP", "MP", "DEF", "MDEF", "initiative"].includes(key)) {
				(npc as unknown as Record<string, unknown>)[key] = Number(parseYamlScalar(value)) || 0;
			} else {
				(npc as unknown as Record<string, unknown>)[key] = parseYamlScalar(value);
			}
		} else if ((AFFINITY_KEYS as readonly string[]).includes(key)) {
			const v = value.toUpperCase();
			npc.affinities[key as AffinityKey] = AFFINITY_VALUES.has(v) ? (v as "RS") : null;
		} else if (listKeys.has(key)) {
			// handled by parseListSection
		} else {
			unknownBlockLines.push(line);
		}
	}

	// Attach structured subfields (tolerant: null = raw-text fallback).
	npc.attackDetails = {};
	for (const entry of [...npc.attacksMelee, ...npc.attacksRanged]) {
		const detail = decodeAttackDesc(entry.desc);
		if (detail) npc.attackDetails[entry.name] = detail;
	}
	npc.spellDetails = {};
	for (const entry of npc.spells) {
		const decoded = decodeSpellName(entry.name);
		if (decoded) {
			// Key = full entry name (serializer grammar); spell.name stays the
			// clean base name from the decoded first segment.
			decoded.spell.effect = entry.desc;
			npc.spellDetails[entry.name] = decoded.spell;
		}
	}
	npc.skillDetails = {};
	for (const entry of npc.skills) {
		npc.skillDetails[entry.name] = decodeSkillDesc(entry.desc);
	}

	// Frontmatter extensions (plugin files only; ignored on foreign files).
	npc.spCosts = frontmatter.spCosts.length > 0 ? frontmatter.spCosts : undefined;
	if (frontmatter.spPool !== null) npc.spPool = frontmatter.spPool;

	return {
		npc,
		frontmatter,
		unknownBlockLines,
		marked: hasMarker(content, marker),
	};
}

