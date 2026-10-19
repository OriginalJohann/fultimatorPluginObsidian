/**
 * Fultimator `TypeNpc` JSON → Adversary model (plan §8).
 *
 * Conscious, one-time lossy transformation:
 * - `wind` affinity key is renamed to `air`.
 * - Armor/shield collapse into flat DEF/MDEF (armor bonus only; the
 *   structure itself is dropped).
 * - `weaponattacks` are merged into `attacks-m`/`attacks-r` as text
 *   (weapon damage/precision are folded into the free-text fields).
 * - `actions`/`special` become `skills` entries; their `spCost` moves to
 *   the frontmatter `sp_costs` extension.
 * - Dropped (reported): armor/sheild structures, raregear, immunities
 *   (status conditions), notes, tags, imgurl, label, sizes, id/uid.
 *
 * Headless: no Obsidian imports.
 */
import {
	Adversary,
	AffinityKey,
	AffinityValue,
	AttackDetail,
	SpellDetail,
	createAdversary,
} from "./model";

/** Mirror of fultimator-fork/src/types/Npcs.ts (JSON input schema). */
export interface TypeNpcAttack {
	name: string;
	range?: string;
	attr1: string;
	attr2: string;
	type: string;
	special?: string[];
	extraDamage?: boolean;
}

export interface TypeNpcWeaponAttack {
	name: string;
	type: string;
	special?: string[];
	extraDamage?: boolean;
	weapon?: { damage?: number; prec?: number };
}

export interface TypeNpcSpell {
	name: string;
	range?: string;
	type?: string | null;
	damagetype?: string;
	attr1?: string;
	attr2?: string;
	mp?: string;
	special?: string[];
	target?: string;
	duration?: string;
	effect?: string;
}

export interface TypeNpcAction {
	name: string;
	effect?: string;
	spCost?: number;
}

export interface TypeNpc {
	id?: string;
	uid?: string;
	name: string;
	lvl: number;
	imgurl?: string;
	attacks?: TypeNpcAttack[];
	affinities?: Record<string, string>;
	immunities?: Record<string, boolean>;
	attributes: { might: number; insight: number; will: number; dexterity: number };
	species: string;
	sizes?: string;
	traits?: string;
	actions?: TypeNpcAction[];
	extra?: {
		init?: boolean;
		precision?: boolean;
		hp?: string;
		magic?: boolean;
		def?: number;
		mDef?: number;
		defOverride?: boolean;
		mDefOverride?: boolean;
	};
	rank?: string;
	spells?: TypeNpcSpell[];
	special?: TypeNpcAction[];
	weaponattacks?: TypeNpcWeaponAttack[];
	description?: string;
	armor?: { def?: number; mdefbonus?: number };
	sheild?: { def?: number; mdefbonus?: number };
	raregear?: { name: string; effect: string }[];
	label?: string;
	notes?: { name: string; effect: string }[];
	tags?: { name: string }[];
}

/** Per-file import report: transformed + dropped fields (plan §8). */
export interface ImportReport {
	/** Fields that were transformed (renamed/merged). */
	transformed: string[];
	/** Fields that were dropped on purpose. */
	dropped: string[];
}

const AFFINITY_MAP: Record<string, AffinityValue> = {
	rs: "RS",
	vu: "VU",
	ab: "AB",
	im: "IM",
	no: null,
};

const AFFINITY_KEY_MAP: Record<string, AffinityKey> = {
	physical: "physical",
	wind: "air", // plan §8: `wind` → `air` rename
	bolt: "bolt",
	dark: "dark",
	earth: "earth",
	fire: "fire",
	ice: "ice",
	light: "light",
	poison: "poison",
};
/** Map one Fultimator attack into a statblock entry + structured detail. */
function mapAttack(attack: TypeNpcAttack): {
	entry: { name: string; desc: string };
	detail: AttackDetail;
} {
	// Damage formula is free text in R1; the JSON carries no formula,
	// so the level-free base is used (user-adjustable in the designer).
	const detail: AttackDetail = {
		attr1: attack.attr1,
		attr2: attack.attr2,
		type: attack.type,
		damage: "HR + 10",
		special: attack.special ?? [],
		extraDamage: attack.extraDamage ?? false,
	};
	return { entry: { name: attack.name, desc: "" }, detail };
}

/** Map one Fultimator spell into a statblock entry + structured detail. */
function mapSpell(spell: TypeNpcSpell): {
	entry: { name: string; desc: string };
	detail: SpellDetail;
} {
	const detail: SpellDetail = {
		name: spell.name,
		offensive: spell.type === "offensive",
		attr1: spell.attr1 ?? "",
		attr2: spell.attr2 ?? "",
		mp: spell.mp ?? "",
		target: spell.target ?? "",
		duration: spell.duration ?? "",
		damagetype: spell.damagetype ?? "",
		special: spell.special ?? [],
		effect: spell.effect ?? "",
	};
	return { entry: { name: spell.name, desc: "" }, detail };
}

/**
 * Transform a Fultimator `TypeNpc` into the template-based Adversary model.
 * Returns the model plus a report of transformed/dropped fields.
 */
export function importNpc(npc: TypeNpc): { adversary: Adversary; report: ImportReport } {
	const report: ImportReport = { transformed: [], dropped: [] };
	const adversary = createAdversary();

	adversary.name = npc.name;
	adversary.level = npc.lvl;
	adversary.species = npc.species;
	adversary.rank = npc.rank ?? "";
	adversary.description = npc.description ?? "";
	adversary.traits = npc.traits ?? "";
	adversary.DEX = npc.attributes.dexterity;
	adversary.INS = npc.attributes.insight;
	adversary.MIG = npc.attributes.might;
	adversary.WLP = npc.attributes.will;

	// Affinities: rename wind→air, lowercase→uppercase values.
	if (npc.affinities) {
		report.transformed.push("affinities (wind→air, values uppercased)");
		for (const [key, value] of Object.entries(npc.affinities)) {
			const mappedKey = AFFINITY_KEY_MAP[key];
			if (!mappedKey) continue;
			adversary.affinities[mappedKey] = AFFINITY_MAP[value] ?? null;
		}
	}

	// DEF/MDEF: armor bonus projection (Q9) – structure dropped.
	adversary.DEF =
		(npc.armor?.def ?? 0) +
		(npc.sheild?.def ?? 0) +
		(npc.extra?.defOverride ? npc.extra?.def ?? 0 : npc.extra?.def ?? 0);
	adversary.MDEF =
		(npc.armor?.mdefbonus ?? 0) +
		(npc.sheild?.mdefbonus ?? 0) +
		(npc.extra?.mDefOverride ? npc.extra?.mDef ?? 0 : npc.extra?.mDef ?? 0);
	if (npc.armor || npc.sheild) {
		report.dropped.push("armor structure", "sheild structure");
		report.transformed.push("armor/shield → flat DEF/MDEF");
	}

	// Attacks: melee → attacks-m, ranged → attacks-r (plan §8).
	adversary.attackDetails = {};
	for (const attack of npc.attacks ?? []) {
		const { entry, detail } = mapAttack(attack);
		adversary.attacksMelee.push(entry);
		adversary.attackDetails[entry.name] = detail;
	}
	for (const weapon of npc.weaponattacks ?? []) {
		// Weapon attacks carry no attribute checks in the JSON; fold weapon
		// damage/precision into the free-text damage formula.
		const detail: AttackDetail = {
			attr1: "",
			attr2: "",
			type: weapon.type,
			damage: `HR + ${weapon.weapon?.damage ?? 10}`,
			special: [...(weapon.special ?? [])],
			extraDamage: weapon.extraDamage ?? false,
		};
		if (weapon.weapon?.prec) detail.special.push(`precision ${weapon.weapon.prec}`);
		const entry = { name: weapon.name, desc: "" };
		adversary.attacksRanged.push(entry);
		adversary.attackDetails[entry.name] = detail;
		report.transformed.push("weaponattacks → attacks (weapon folded into text)");
	}

	// Spells.
	adversary.spellDetails = {};
	for (const spell of npc.spells ?? []) {
		const { entry, detail } = mapSpell(spell);
		adversary.spells.push(entry);
		adversary.spellDetails[entry.name] = detail;
	}

	// Actions + special → skills; spCost → frontmatter sp_costs (plan §8).
	adversary.skillDetails = {};
	adversary.spCosts = [];
	for (const action of [...(npc.actions ?? []), ...(npc.special ?? [])]) {
		const entry = { name: action.name, desc: "" };
		const detail = { spCost: action.spCost ?? 1, effect: action.effect ?? "" };
		adversary.skills.push(entry);
		adversary.skillDetails[entry.name] = detail;
		adversary.spCosts!.push({ name: action.name, spCost: detail.spCost });
	}

	// Dropped fields (plan §8, documented report).
	if (npc.immunities) report.dropped.push("immunities (status conditions)");
	if (npc.raregear) report.dropped.push("raregear");
	if (npc.notes) report.dropped.push("notes");
	if (npc.tags) report.dropped.push("tags");
	if (npc.imgurl) report.dropped.push("imgurl");
	if (npc.label) report.dropped.push("label");
	if (npc.sizes) report.dropped.push("sizes");
	if (npc.id || npc.uid) report.dropped.push("id/uid (vault filename is identity)");

	return { adversary, report };
}

/**
 * Rebuild `name`/`desc` lines from structured details after import (the
 * mapping produces empty placeholders). Mirrors the serializer grammar so
 * imported files round-trip identically.
 */
export function finalizeImportedEntries(adversary: Adversary): void {
	for (const entry of [...adversary.attacksMelee, ...adversary.attacksRanged]) {
		const d = adversary.attackDetails?.[entry.name];
		if (!d) continue;
		entry.desc = `**[${d.attr1} + ${d.attr2}] ~ [${d.damage}] ${d.type}** damage`;
		if (d.special.length > 0) entry.desc += `, ${d.special.join(", ")}`;
		if (d.extraDamage) entry.desc += " (extra damage)";
	}
	for (const entry of adversary.spells) {
		const d = adversary.spellDetails?.[entry.name];
		if (!d) continue;
		const check =
			d.attr1 && d.attr2 ? ` ~ [${d.attr1}] + ${d.attr2}` : "";
		entry.name =
			(d.offensive ? "$ " : "") +
			d.name +
			check +
			` ~ ${d.mp} ~ ${d.target} ~ ${d.duration}`;
		entry.desc = d.effect;
	}
	for (const entry of adversary.skills) {
		const d = adversary.skillDetails?.[entry.name];
		if (d) entry.desc = d.effect;
	}
}

