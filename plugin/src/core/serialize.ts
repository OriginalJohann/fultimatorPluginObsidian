/**
 * Adversary model → Markdown file (statblock + frontmatter), plan §5.
 *
 * Grammar (deterministic, reversible – fixed by unit tests):
 *
 * Attack desc (attacks-m / attacks-r):
 *   **[{attr1} + {attr2}] ~ [{damage}] {type}** damage{, specialText}{ (extra damage)}
 *
 * Spell name:
 *   {offensivePrefix}{name} ~ [{attr1} + {attr2}] ~ {mp} ~ {target} ~ {duration}
 *   where offensivePrefix = "$ " iff offensive; the check segment is
 *   omitted when both attributes are empty. `desc` = free-text effect.
 *
 * Skill / rule entries: name + free-text desc (spCost lives in the
 * frontmatter `sp_costs` extension, plan §4.3).
 *
 * Round-trip guarantee (plan §5.3.1): for plugin-generated files
 * `serialize(parse(file)) === file` byte-identically.
 */
import {
	Adversary,
	AFFINITY_KEYS,
	AttackDetail,
	SkillDetail,
	SpellDetail,
	StatListEntry,
} from "./model";
import { TemplateFormat } from "./template";

/** Quote a string as a YAML double-quoted scalar (minimal escaping). */
export function yamlQuote(value: string): string {
	return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

/**
 * Serialize one list entry. `desc` is always emitted; a null detail means
 * tolerant raw text (serialized verbatim).
 */
function serializeEntry(
	indent: string,
	entry: StatListEntry,
	detail: AttackDetail | SpellDetail | SkillDetail | null,
	kind: "attack" | "spell" | "skill"
): string {
	let desc = entry.desc;
	let name = entry.name;

	if (detail && kind === "attack") {
		const a = detail as AttackDetail;
		desc = `**[${a.attr1} + ${a.attr2}] ~ [${a.damage}] ${a.type}** damage`;
		if (a.special.length > 0) desc += `, ${a.special.join(", ")}`;
		if (a.extraDamage) desc += " (extra damage)";
	} else if (detail && kind === "spell") {
		// Plan §5.1: name = [\$ ]name ~ [Check] + modifier ~ Cost ~ Target ~ Duration
		const s = detail as SpellDetail;
		name =
			(s.offensive ? "$ " : "") +
			s.name +
			(s.attr1 ? ` ~ [${s.attr1}]${s.attr2 ? ` + ${s.attr2}` : ""}` : "") +
			` ~ ${s.mp} ~ ${s.target} ~ ${s.duration}`;
		// desc is the free-text effect; nothing extra to append.
		desc = s.effect;
	} else if (detail && kind === "skill") {
		desc = (detail as SkillDetail).effect;
	}

	const lines = [`${indent}- name: ${yamlQuote(name)}`];
	if (desc.length > 0) {
		lines.push(`${indent}desc: ${yamlQuote(desc)}`);
	}
	return lines.join("\n");
}

function serializeList(
	key: string,
	entries: StatListEntry[],
	details: Record<string, AttackDetail | SpellDetail | SkillDetail> | undefined,
	kind: "attack" | "spell" | "skill"
): string[] {
	if (entries.length === 0) return [];
	const lines = [`${key}:`];
	for (const entry of entries) {
		lines.push(
			serializeEntry("  ", entry, details?.[entry.name] ?? null, kind)
		);
	}
	return lines;
}

/** Serialize the frontmatter of a plugin-generated file. */
export function serializeFrontmatter(
	npc: Adversary,
	template: TemplateFormat,
	marker: string
): string {
	const lines: string[] = ["---"];

	// Template frontmatter fields, in template order (raw lines preserved).
	for (const rawLine of template.frontmatter.rawLines) {
		lines.push(rawLine);
	}
	// Plugin marker (plan Q7).
	lines.push(marker);

	// Plugin extension: sp_costs (plan §4.3).
	if (npc.spCosts && npc.spCosts.length > 0) {
		lines.push("sp_costs:");
		for (const entry of npc.spCosts) {
			lines.push(`  - name: ${yamlQuote(entry.name)}`);
			lines.push(`    spCost: ${entry.spCost}`);
		}
	}
	// Plugin extension: cached derived SP pool (plan §4.3).
	if (npc.spPool !== undefined) {
		lines.push(`sp_pool: ${npc.spPool}`);
	}

	lines.push("---");
	return lines.join("\n");
}
/**
 * Serialize the statblock body. Section order follows the template SOT;
 * optional sections without entries are omitted.
 */
export function serializeStatblock(npc: Adversary, template: TemplateFormat): string {
	const block: string[] = ["layout: Fabula Ultima NPC"];

	const affinityLine = (key: (typeof AFFINITY_KEYS)[number]): string[] => {
		const value = npc.affinities[key];
		return value ? [`${key}: ${value}`] : [];
	};

	const sections: Record<string, () => string[]> = {
		layout: () => ["layout: Fabula Ultima NPC"],
		name: () => [`name: ${yamlQuote(npc.name)}`],
		rank: () => (npc.rank ? [`rank: ${npc.rank}`] : []),
		level: () => [`level: ${npc.level}`],
		species: () => [`species: ${yamlQuote(npc.species)}`],
		description: () =>
			npc.description ? [`description: ${yamlQuote(npc.description)}`] : [],
		traits: () => (npc.traits ? [`traits: ${yamlQuote(npc.traits)}`] : []),
		typicaltraits: () =>
			npc.typicaltraits ? [`typicaltraits: ${yamlQuote(npc.typicaltraits)}`] : [],
		DEX: () => [`DEX: ${npc.DEX}`],
		INS: () => [`INS: ${npc.INS}`],
		MIG: () => [`MIG: ${npc.MIG}`],
		WLP: () => [`WLP: ${npc.WLP}`],
		HP: () => [`HP: ${npc.HP}`],
		MP: () => [`MP: ${npc.MP}`],
		DEF: () => [`DEF: ${npc.DEF}`],
		MDEF: () => [`MDEF: ${npc.MDEF}`],
		initiative: () => (npc.initiative ? [`initiative: ${npc.initiative}`] : []),
		physical: () => affinityLine("physical"),
		air: () => affinityLine("air"),
		bolt: () => affinityLine("bolt"),
		dark: () => affinityLine("dark"),
		earth: () => affinityLine("earth"),
		fire: () => affinityLine("fire"),
		ice: () => affinityLine("ice"),
		light: () => affinityLine("light"),
		poison: () => affinityLine("poison"),
		"attacks-m": () =>
			serializeList("attacks-m", npc.attacksMelee, npc.attackDetails, "attack"),
		"attacks-r": () =>
			serializeList("attacks-r", npc.attacksRanged, npc.attackDetails, "attack"),
		spells: () => serializeList("spells", npc.spells, npc.spellDetails, "spell"),
		skills: () => serializeList("skills", npc.skills, npc.skillDetails, "skill"),
		rules: () => serializeList("rules", npc.rules, undefined, "skill"),
	};

	// Emit in template section order; append any section the template lacks.
	const emitted = new Set<string>(["layout"]);
	for (const key of template.sectionOrder) {
		if (emitted.has(key)) continue;
		const emit = sections[key];
		if (emit) {
			const lines = emit();
			if (lines.length > 0) {
				block.push(...lines);
				emitted.add(key);
			}
		}
	}
	for (const key of Object.keys(sections)) {
		if (!emitted.has(key)) {
			block.push(...sections[key]());
			emitted.add(key);
		}
	}

	return ["```statblock", ...block, "```"].join("\n");
}

/**
 * Serialize the full adversary to a Markdown file (frontmatter + blank
 * line + statblock). This is the single output path of the plugin.
 */
export function serialize(npc: Adversary, template: TemplateFormat, marker: string): string {
	return (
		serializeFrontmatter(npc, template, marker) +
		"\n\n" +
		serializeStatblock(npc, template) +
		"\n"
	);
}

