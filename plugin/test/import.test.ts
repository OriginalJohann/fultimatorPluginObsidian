/**
 * Import tests (plan §11/Q16): Fultimator TypeNpc JSON → template-based
 * Adversary mapping, affinity renames, dropped-field report, and the
 * finalize/serialize/parse round-trip of imported entries.
 */
import { describe, expect, it } from "vitest";
import { importNpc, finalizeImportedEntries, TypeNpc } from "../src/core/import-npc";
import { serialize } from "../src/core/serialize";
import { parseAdversary, hasMarker } from "../src/core/parse";
import { parseTemplate } from "../src/core/template";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MARKER = "generator: fultimator";
const TEMPLATE = readFileSync(resolve(__dirname, "fixtures/template.md"), "utf-8");
const template = parseTemplate(TEMPLATE);

/** The plan sample NPC (wind/water affinities, mixed attack lists). */
const sampleNpc: TypeNpc = {
	name: "Kampfrobe",
	lvl: 10,
	species: "Golem",
	attributes: { might: 6, dexterity: 3, will: 5, insight: 4 },
	affinities: { fire: "n", water: "im", poison: "rs" },
	armor: { def: 4, mdefbonus: 2 },
	attacks: [{ attr1: "MIG", attr2: "4", name: "Schlag", type: "physical", special: [], extraDamage: false }],
	weaponattacks: [{ name: "Steinschleuder", type: "physical", special: ["Ranged"], weapon: { damage: 10, prec: 2 } }],
	spells: [
		{
			name: "Steinpfeil",
			type: "offensive",
			attr1: "INS",
			attr2: "4",
			mp: "4 MP",
			target: "One creature",
			duration: "Instant",
			damagetype: "bolt",
			special: [],
			effect: "Fügt bolt Schaden zu.",
		},
	],
	special: [{ name: "Steinhaut", spCost: 1, effect: "Reagiert auf alle Angriffe mit DEF." }],
};

describe("importNpc", () => {
	it("maps core fields", () => {
		const { adversary } = importNpc(sampleNpc);
		expect(adversary.name).toBe("Kampfrobe");
		expect(adversary.level).toBe(10);
		expect(adversary.MIG).toBe(6);
		expect(adversary.DEX).toBe(3);
		expect(adversary.WLP).toBe(5);
		expect(adversary.INS).toBe(4);
	});

	it("renames wind→air and uppercases values; drops unmapped keys", () => {
		const { adversary } = importNpc({
			...sampleNpc,
			affinities: { wind: "ab", water: "im" },
		});
		expect(adversary.affinities.air).toBe("AB");
		// `water` is not part of the Fabula Ultima vocabulary → dropped.
		expect((adversary.affinities as Record<string, unknown>).water).toBeUndefined();
	});

	it("folds armor into flat DEF/MDEF and reports it", () => {
		const { adversary, report } = importNpc(sampleNpc);
		expect(adversary.DEF).toBe(4);
		expect(adversary.MDEF).toBe(2);
		expect(report.dropped).toContain("armor structure");
	});

	it("splits attacks by range and folds weapon attacks", () => {
		const { adversary } = importNpc(sampleNpc);
		expect(adversary.attacksMelee.map((a) => a.name)).toEqual(["Schlag"]);
		expect(adversary.attacksRanged.map((a) => a.name)).toEqual(["Steinschleuder"]);
		expect(adversary.attackDetails!["Steinschleuder"].damage).toBe("HR + 10");
		expect(adversary.attackDetails!["Steinschleuder"].special).toContain("precision 2");
	});

	it("maps spells with offensive flag and special into skills/spCosts", () => {
		const { adversary } = importNpc(sampleNpc);
		expect(adversary.spellDetails!["Steinpfeil"].offensive).toBe(true);
		expect(adversary.skills.map((s) => s.name)).toEqual(["Steinhaut"]);
		expect(adversary.spCosts).toEqual([{ name: "Steinhaut", spCost: 1 }]);
	});

	it("reports dropped fields", () => {
		const { report } = importNpc({
			...sampleNpc,
			imgurl: "x.png",
			id: "1",
			notes: [{ name: "n", effect: "e" }],
		});
		expect(report.dropped).toContain("imgurl");
		expect(report.dropped).toContain("notes");
		expect(report.dropped).toContain("id/uid (vault filename is identity)");
	});
});

describe("finalizeImportedEntries", () => {
	it("rebuilds entry names/descs in the serializer grammar", () => {
		const { adversary } = importNpc(sampleNpc);
		finalizeImportedEntries(adversary);
		expect(adversary.spells[0].name).toBe(
			"$ Steinpfeil ~ [INS] + 4 ~ 4 MP ~ One creature ~ Instant"
		);
		expect(adversary.spells[0].desc).toBe("Fügt bolt Schaden zu.");
		expect(adversary.attacksMelee[0].desc).toBe(
			"**[MIG + 4] ~ [HR + 10] physical** damage"
		);
		expect(adversary.attacksRanged[0].desc).toBe(
			"**[ + ] ~ [HR + 10] physical** damage, Ranged, precision 2"
		);
		expect(adversary.skills[0].desc).toBe("Reagiert auf alle Angriffe mit DEF.");
	});

	it("imported content survives a serialize/parse round-trip", () => {
		const { adversary } = importNpc(sampleNpc);
		finalizeImportedEntries(adversary);
		const text = serialize(adversary, template, MARKER);
		expect(hasMarker(text, MARKER)).toBe(true);
		const back = parseAdversary(text, MARKER).npc;
		expect(back.name).toBe("Kampfrobe");
		const spell = back.spellDetails!["$ Steinpfeil ~ [INS] + 4 ~ 4 MP ~ One creature ~ Instant"];
		expect(spell.offensive).toBe(true);
		expect(spell.effect).toBe("Fügt bolt Schaden zu.");
	});
});
