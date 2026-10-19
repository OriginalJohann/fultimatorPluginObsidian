/**
 * Adversary data model (Release 1).
 *
 * The model mirrors the template SOT (plan §4) plus the structured
 * subfields kept from the Fultimator `TypeNpc` schema (plan Q9/Q10).
 * This module is headless: no Obsidian imports, fully unit-testable.
 */

/** The nine Fabula Ultima damage affinities (template key order). */
export const AFFINITY_KEYS = [
	"physical",
	"air",
	"bolt",
	"dark",
	"earth",
	"fire",
	"ice",
	"light",
	"poison",
] as const;
export type AffinityKey = (typeof AFFINITY_KEYS)[number];

/**
 * Affinity value as it appears in the statblock (template SOT):
 * `RS` resistance, `VU` vulnerability, `AB` absorption, `IM` immunity.
 * `null` = absent (not printed on the sheet).
 */
export type AffinityValue = "RS" | "VU" | "AB" | "IM" | null;
export type Affinities = Record<AffinityKey, AffinityValue>;

export function createAffinities(): Affinities {
	return {
		physical: null,
		air: null,
		bolt: null,
		dark: null,
		earth: null,
		fire: null,
		ice: null,
		light: null,
		poison: null,
	};
}

/**
 * Structured subfields for attacks (`attacks-m` / `attacks-r`),
 * kept from `NpcAttack` (plan §4.2). Serialized as the deterministic
 * `~`-encoding inside the `desc` line (plan §5.2, grammar in serialize.ts).
 */
export interface AttackDetail {
	/** First check attribute, e.g. "MIG". */
	attr1: string;
	/** Second check attribute, e.g. "MIG". */
	attr2: string;
	/** Damage type, e.g. "physical". */
	type: string;
	/** Free-text damage formula, e.g. "HR + 10". */
	damage: string;
	/** Special attack keywords, e.g. ["precision", "magic"]. */
	special: string[];
	/** Extra damage skill (flat +5) – counted in the SP budget. */
	extraDamage: boolean;
}

/**
 * Structured subfields for spells, kept from `NpcSpell` (plan §4.2).
 * Serialized in the `~`-separated `name` line + `desc` (plan §5.1).
 */
export interface SpellDetail {
	/** Spell name (without the `$ ` offensive prefix). */
	name: string;
	/** Offensive spell: rendered with the `$` prefix in the name. */
	offensive: boolean;
	/** First check attribute ("" = none). */
	attr1: string;
	/** Second check attribute ("" = none). */
	attr2: string;
	/** MP cost, e.g. "5". */
	mp: string;
	/** Target description, e.g. "One creature". */
	target: string;
	/** Duration, e.g. "Until end of turn". */
	duration: string;
	/** Damage type for offensive spells, e.g. "bolt". */
	damagetype: string;
	/** Special spell keywords. */
	special: string[];
	/** Free-text effect – serialized as the `desc` line. */
	effect: string;
}

/**
 * Structured subfields for skills (actions/specials), kept from
 * `NpcAction`/`NpcSpecial` (plan §4.2). `spCost` lives in the
 * frontmatter `sp_costs` extension (plan §4.3), not in the block.
 */
export interface SkillDetail {
	/** Skill point cost, default 1. */
	spCost: number;
	/** Free-text effect – serialized as the `desc` line. */
	effect: string;
}

/** One entry of the frontmatter `sp_costs` extension. */
export interface SpCostEntry {
	name: string;
	spCost: number;
}

/** A plain statblock list entry (rules, or the serialized view of lists). */
export interface StatListEntry {
	name: string;
	desc: string;
}

/**
 * Full adversary model (plan §4). `hp`/`mp`/`def`/`mdef`/`initiative` are
 * derived previews in the UI (plan §7) but stored as plain values in the
 * file, mirroring the template fields.
 */
export interface Adversary {
	name: string;
	rank: string;
	level: number;
	species: string;
	description: string;
	traits: string;
	typicaltraits: string;
	DEX: number;
	INS: number;
	MIG: number;
	WLP: number;
	HP: number;
	MP: number;
	DEF: number;
	MDEF: number;
	initiative: number;
	affinities: Affinities;
	attacksMelee: StatListEntry[];
	attacksRanged: StatListEntry[];
	spells: StatListEntry[];
	skills: StatListEntry[];
	rules: StatListEntry[];
	/** Parsed structured subfields (undefined = tolerant raw-text fallback). */
	attackDetails?: Record<string, AttackDetail>;
	spellDetails?: Record<string, SpellDetail>;
	skillDetails?: Record<string, SkillDetail>;
	/** Frontmatter extension: spCost entries for actions/specials. */
	spCosts?: SpCostEntry[];
	/**
	 * Frontmatter extension: cached derived SP pool (plan §4.3). Always
	 * recomputed on save; never trusted over the calculation (plan §14).
	 */
	spPool?: number;
}

/** Create an empty adversary with sensible defaults. */
export function createAdversary(): Adversary {
	return {
		name: "",
		rank: "",
		level: 1,
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
		attacksMelee: [],
		attacksRanged: [],
		spells: [],
		skills: [],
		rules: [],
	};
}

/** Deep clone of an adversary (plain object structure). */
export function cloneAdversary(npc: Adversary): Adversary {
	return JSON.parse(JSON.stringify(npc)) as Adversary;
}
