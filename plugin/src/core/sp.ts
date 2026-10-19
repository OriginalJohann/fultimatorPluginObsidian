/**
 * SP-pool & derived-value calculation, ported 1:1 from
 * fultimator-fork/src/libs/npcs.js (plan §7), adapted to the Adversary
 * model. Field mapping: lvl→level, attributes→DEX/INS/MIG/WLP,
 * affinities wind→air, affinity values lower→uppercase.
 *
 * Dropped in Release 1 (model does not carry them): armor/shield,
 * weaponattacks, extra.* overrides, immunities (status conditions).
 *
 * Headless: no Obsidian imports.
 */
import { Adversary } from "./model";

/** Derived SP budget (plan §7): species + level + vulnerabilities + rank. */
export function calcAvailableSkills(npc: Adversary): number {
	return (
		fromSpecies(npc) +
		fromLevel(npc) +
		fromVulnerabilities(npc) +
		fromRank(npc)
	);
}

function fromSpecies(npc: Adversary): number {
	let number = 4;
	if (
		npc.species === "Construct" ||
		npc.species === "Elemental" ||
		npc.species === "Undead"
	) {
		number = 2;
	}
	if (
		npc.species === "Demon" ||
		npc.species === "Plant" ||
		npc.species === "Humanoid"
	) {
		number = 3;
	}
	if (npc.species === "Variant Humanoid") {
		number = 4;
	}
	return number;
}

function fromLevel(npc: Adversary): number {
	return Math.floor(npc.level / 10);
}

function fromVulnerabilities(npc: Adversary): number {
	let sum = 0;
	for (const [key, value] of Object.entries(npc.affinities)) {
		if (value === "VU") sum++;
	}
	// NOTE: ported exactly from the web app – this intentionally double-counts
	// a physical vulnerability (original quirk preserved, plan §7 "exact logic").
	if (npc.affinities.physical === "VU") {
		sum++;
	}
	// Undeads are vulnerable to light
	if (npc.species === "Undead" && npc.affinities.light === "VU") {
		sum = sum - 1;
	}
	// Plants have a free vulnerability
	if (
		npc.species === "Plant" &&
		(npc.affinities.fire ||
			npc.affinities.air ||
			npc.affinities.ice ||
			npc.affinities.bolt)
	) {
		sum = sum - 1;
	}
	if (sum < 0) sum = 0;
	return sum;
}

function fromRank(npc: Adversary): number {
	if (npc.rank === "elite") return 1;
	if (npc.rank === "champion1") return 1;
	if (npc.rank === "champion2") return 2;
	if (npc.rank === "champion3") return 3;
	if (npc.rank === "champion4") return 4;
	if (npc.rank === "champion5") return 5;
	if (npc.rank === "champion6") return 6;
	if (npc.rank === "groupvehicle") return 3;
	return 0;
}

/** SP cost of everything the adversary actually uses (plan §7). */
export function calcUsedSkills(npc: Adversary): number {
	return (
		fromSpecialAttacks(npc) +
		fromResistances(npc) +
		fromImmunities(npc) +
		fromAbsorbs(npc) +
		fromSkills(npc) +
		fromSpells(npc)
	);
}

function fromSpecialAttacks(npc: Adversary): number {
	let sum = 0;
	for (const entry of [...npc.attacksMelee, ...npc.attacksRanged]) {
		const detail = npc.attackDetails?.[entry.name];
		if (detail) {
			sum += detail.special.length;
			if (detail.extraDamage) sum++;
		}
	}
	return sum;
}

function fromResistances(npc: Adversary): number {
	let sum = 0;
	for (const [key, value] of Object.entries(npc.affinities)) {
		if (value !== "RS") continue;
		// Don't count earth for Construct
		if (npc.species === "Construct" && key === "earth") continue;
		sum++;
	}
	// Demons have two free resistances
	if (npc.species === "Demon") sum = sum - 2;
	if (sum < 0) sum = 0;
	return sum / 2;
}

function fromImmunities(npc: Adversary): number {
	let sum = 0;
	for (const [key, value] of Object.entries(npc.affinities)) {
		if (value !== "IM") continue;
		// Don't count poison for Construct, Elemental, Undead
		if (
			(npc.species === "Construct" ||
				npc.species === "Elemental" ||
				npc.species === "Undead") &&
			key === "poison"
		) {
			continue;
		}
		// Don't count dark for Undead
		if (npc.species === "Undead" && key === "dark") continue;
		sum++;
	}
	// Elementals have a free immunity
	if (npc.species === "Elemental") sum = sum - 1;
	if (sum < 0) sum = 0;
	return Math.ceil(sum);
}

function fromAbsorbs(npc: Adversary): number {
	let sum = 0;
	for (const [, value] of Object.entries(npc.affinities)) {
		if (value === "AB") sum++;
	}
	if (sum < 0) sum = 0;
	return Math.ceil(sum) * 2;
}

function fromSkills(npc: Adversary): number {
	let sum = 0;
	for (const entry of npc.skills) {
		const detail = npc.skillDetails?.[entry.name];
		sum += detail ? detail.spCost : 1;
	}
	return sum;
}

function fromSpells(npc: Adversary): number {
	return npc.spells.length / 2;
}

/** Derived HP preview (plan §7), adapted: no extra.hp / companion rank in R1. */
export function calcHP(npc: Adversary): number {
	let hp = 2 * npc.level + 5 * npc.MIG;

	if (npc.rank === "champion1") hp = hp * 1;
	if (npc.rank === "elite" || npc.rank === "champion2") hp = hp * 2;
	if (npc.rank === "champion3") hp = hp * 3;
	if (npc.rank === "champion4") hp = hp * 4;
	if (npc.rank === "champion5") hp = hp * 5;
	if (npc.rank === "champion6") hp = hp * 6;
	if (npc.rank === "groupvehicle") hp = hp * 1;

	return hp;
}

/** Derived MP preview (plan §7), adapted: no extra.mp in R1. */
export function calcMP(npc: Adversary): number {
	let mp = npc.level + 5 * npc.WLP;
	if (
		npc.rank === "champion1" ||
		npc.rank === "champion2" ||
		npc.rank === "champion3" ||
		npc.rank === "champion4" ||
		npc.rank === "champion5" ||
		npc.rank === "champion6"
	) {
		mp = mp * 2;
	}
	return mp;
}

/** Derived initiative preview (plan §7), adapted: no extra.init / armor in R1. */
export function calcInit(npc: Adversary): number {
	let init = (npc.DEX + npc.INS) / 2;

	if (npc.rank === "champion1") init = init + 1;
	if (npc.rank === "elite" || npc.rank === "champion2") init = init + 2;
	if (npc.rank === "champion3") init = init + 3;
	if (npc.rank === "champion4") init = init + 4;
	if (npc.rank === "champion5") init = init + 5;
	if (npc.rank === "champion6") init = init + 6;
	if (npc.rank === "groupvehicle") init = 0;

	return init;
}

/**
 * Derived DEF preview (plan §7). In Release 1 armor/shield are dropped,
 * so DEF/MDEF are plain stored values; these previews return the stored
 * value, mirroring `extra.def`/`extra.mDef`-only computation.
 */
export function calcDef(npc: Adversary): number {
	return npc.DEF;
}

export function calcMDef(npc: Adversary): number {
	return npc.MDEF;
}

/**
 * Derived damage for an attack (ported from calcDamage, plan §7).
 * In R1 `damage` is a free-text formula; this returns the numeric base,
 * used for preview only.
 */
export function calcDamage(entryName: string, npc: Adversary): number {
	let number = 5;
	number = number + Math.floor(npc.level / 20) * 5;
	const detail = npc.attackDetails?.[entryName];
	if (detail?.extraDamage) number = number + 5;
	if (npc.rank === "groupvehicle") number = number + 5;
	return number;
}
