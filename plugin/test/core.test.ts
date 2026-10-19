/**
 * Core tests (plan §11/Q16): serialize/parse round-trip against the real
 * vault template, tolerant parsing of foreign files, SP/HP/MP calculations,
 * filename collision rules. Headless – no Obsidian imports.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Adversary, createAdversary } from "../src/core/model";
import { parseTemplate } from "../src/core/template";
import { serialize, yamlQuote } from "../src/core/serialize";
import {
	parseAdversary,
	hasMarker,
	decodeAttackDesc,
	decodeSpellName,
} from "../src/core/parse";
import {
	calcAvailableSkills,
	calcUsedSkills,
	calcHP,
	calcMP,
	calcInit,
} from "../src/core/sp";
import { sanitizeName, resolveSavePath } from "../src/core/filename";

/** Marker and template as configured for the test vault (plan Q7/Q4). */
const MARKER = "generator: fultimator";
const TEMPLATE = readFileSync(resolve(__dirname, "fixtures/template.md"), "utf-8");
const template = parseTemplate(TEMPLATE);

/** The plan sample adversary, fully populated (structured subfields set). */
function sample(): Adversary {
	const n = createAdversary();
	n.name = "Kampfrobe";
	n.level = 10;
	n.species = "Golem";
	n.rank = "elite";
	n.DEX = 3;
	n.INS = 4;
	n.MIG = 6;
	n.WLP = 5;
	n.DEF = 4;
	n.MDEF = 2;
	n.description = "Eine uralte Wächterfigur aus dunklem Stein.";
	n.traits = "Unbeugsam";
	n.affinities.earth = "RS";
	n.attacksMelee = [{ name: "Schlag", desc: "" }];
	n.attacksRanged = [{ name: "Steinschleuder", desc: "" }];
	n.spells = [{ name: "Steinpfeil", desc: "" }];
	n.skills = [{ name: "Steinhaut", desc: "" }];
	n.attackDetails = {
		"Schlag": { attr1: "MIG", attr2: "4", type: "physical", damage: "3W6", special: [], extraDamage: false },
		"Steinschleuder": { attr1: "DEX", attr2: "4", type: "physical", damage: "2W6", special: ["Ranged"], extraDamage: false },
	};
	n.spellDetails = {
		"Steinpfeil": {
			name: "Steinpfeil",
			offensive: true,
			attr1: "INS",
			attr2: "4",
			mp: "4 MP",
			target: "One creature",
			duration: "Instant",
			damagetype: "bolt",
			special: [],
			effect: "Fügt bolt Schaden zu.",
		},
	};
	n.skillDetails = { "Steinhaut": { spCost: 1, effect: "Reagiert auf alle Angriffe mit DEF." } };
	n.spCosts = [{ name: "Steinhaut", spCost: 1 }];
	return n;
}


describe("template SOT", () => {
	it("parses the real vault template (frontmatter + section order)", () => {
		expect(template.frontmatter.fields["statblock"]).toBe("inline");
		expect(template.frontmatter.fields["tags"]).toEqual(["NPCs", "homebrew"]);
		expect(template.sectionOrder.slice(0, 4)).toEqual([
			"layout",
			"name",
			"rank",
			"level",
		]);
		expect(template.sectionOrder).toContain("attacks-m");
		expect(template.sectionOrder).toContain("rules");
	});
});

describe("serialize / parse round-trip", () => {
	it("round-trips the sample adversary through the real template", () => {
		const text = serialize(sample(), template, MARKER);
		const back = parseAdversary(text, MARKER);
		const n = back.npc;
		expect(n.name).toBe("Kampfrobe");
		expect(n.level).toBe(10);
		expect(n.species).toBe("Golem");
		expect(n.rank).toBe("elite");
		expect(n.DEX).toBe(3);
		expect(n.INS).toBe(4);
		expect(n.MIG).toBe(6);
		expect(n.WLP).toBe(5);
		expect(n.DEF).toBe(4);
		expect(n.MDEF).toBe(2);
		expect(n.description).toBe("Eine uralte Wächterfigur aus dunklem Stein.");
		expect(n.traits).toBe("Unbeugsam");
		expect(n.affinities.earth).toBe("RS");
		expect(n.affinities.air).toBeNull();

		// Structured subfields survive the round-trip.
		expect(n.attackDetails!["Schlag"]).toEqual({
			attr1: "MIG",
			attr2: "4",
			type: "physical",
			damage: "3W6",
			special: [],
			extraDamage: false,
		});
		expect(n.attackDetails!["Steinschleuder"].special).toEqual(["Ranged"]);
		const spell = n.spellDetails!["$ Steinpfeil ~ [INS] + 4 ~ 4 MP ~ One creature ~ Instant"];
		expect(spell.offensive).toBe(true);
		expect(spell.name).toBe("Steinpfeil");
		expect(spell.mp).toBe("4 MP");
		expect(spell.target).toBe("One creature");
		expect(spell.duration).toBe("Instant");
		expect(spell.effect).toBe("Fügt bolt Schaden zu.");
		expect(n.skillDetails!["Steinhaut"].effect).toBe(
			"Reagiert auf alle Angriffe mit DEF."
		);
		expect(n.spCosts).toEqual([{ name: "Steinhaut", spCost: 1 }]);
		expect(back.marked).toBe(true);
	});

	it("serialized output is idempotent (serialize(parse(serialize)) === serialize)", () => {
		const once = serialize(sample(), template, MARKER);
		const twice = serialize(parseAdversary(once, MARKER).npc, template, MARKER);
		expect(twice).toBe(once);
	});

	it("keeps the generator marker in serialized output", () => {
		expect(hasMarker(serialize(sample(), template, MARKER), MARKER)).toBe(true);
	});

	it("quotes scalars with special characters safely", () => {
		expect(yamlQuote('a "quoted" \\ string')).toBe('"a \\"quoted\\" \\\\ string"');
	});
});

describe("tolerant parsing (plan §5.3.3)", () => {
	it("preserves unknown statblock keys verbatim", () => {
		const foreign = TEMPLATE.replace(
			"```statblock\n",
			"```statblock\nfoo: bar\n"
		);
		const back = parseAdversary(foreign, MARKER);
		expect(back.unknownBlockLines).toContain("foo: bar");
		expect(back.marked).toBe(false);
	});

	it("falls back to raw text for unparseable attack desc", () => {
		expect(decodeAttackDesc("Handwritten free text, no formula")).toBeNull();
	});

	it("decodes structured attack descs", () => {
		const d = decodeAttackDesc(
			"**[MIG + 4] ~ [3W6] physical** damage, Ranged (extra damage)"
		);
		expect(d).toEqual({
			attr1: "MIG",
			attr2: "4",
			damage: "3W6",
			type: "physical",
			special: ["Ranged"],
			extraDamage: true,
		});
	});

	it("decodes structured spell names (5-segment serializer grammar)", () => {
		const withCheck = decodeSpellName(
			"$ Steinpfeil ~ [INS] + 4 ~ 4 MP ~ One creature ~ Instant"
		);
		expect(withCheck!.spell.offensive).toBe(true);
		expect(withCheck!.spell.attr1).toBe("INS");
		expect(withCheck!.spell.attr2).toBe("4");
		expect(withCheck!.spell.mp).toBe("4 MP");
		expect(withCheck!.spell.target).toBe("One creature");
		expect(withCheck!.spell.duration).toBe("Instant");
		const noCheck = decodeSpellName("Nebel ~ 2 MP ~ All ~ 1 minute");
		expect(noCheck!.spell.name).toBe("Nebel");
		expect(noCheck!.spell.attr1).toBe("");
		expect(noCheck!.spell.mp).toBe("2 MP");
	});
});

describe("sp", () => {
	it("available skills: Demon level 20 → 3 + 2 + 0 + 0 = 5", () => {
		const n = createAdversary();
		n.level = 20;
		n.species = "Demon";
		expect(calcAvailableSkills(n)).toBe(5);
	});

	it("used skills: imm 1, resist 2 (→1, ported /2 quirk), absorb 4, skill 1, spell 0.5 → 7.5", () => {
		const n = createAdversary();
		n.affinities.air = "IM";
		n.affinities.bolt = "RS";
		n.affinities.earth = "RS";
		n.affinities.fire = "AB";
		n.affinities.ice = "AB";
		n.skills = [{ name: "A1", desc: "" }];
		n.spells = [{ name: "S1", desc: "" }];
		// 1 (IM) + 2/2 (RS, ported /2 from web app) + 4 (AB) + 1 (skill) + 0.5 (spell)
		expect(calcUsedSkills(n)).toBe(7.5);
	});

	it("Construct poison immunity is not counted (plan §7)", () => {
		const a = createAdversary();
		a.species = "Construct";
		a.affinities.poison = "IM";
		const b = createAdversary();
		b.species = "Demon";
		b.affinities.poison = "IM";
		expect(calcUsedSkills(a)).toBe(0);
		expect(calcUsedSkills(b)).toBe(1);
	});

	it("Construct earth resistance is not counted, Demon gets 2 free", () => {
		const a = createAdversary();
		a.species = "Construct";
		a.affinities.earth = "RS";
		const b = createAdversary();
		b.species = "Demon";
		b.affinities.earth = "RS";
		b.affinities.fire = "RS";
		expect(calcUsedSkills(a)).toBe(0);
		expect(calcUsedSkills(b)).toBe(0); // 2 RS − 2 free
	});

	it("HP: level 20, MIG 6, elite → (2·20 + 5·6) × 2 = 140", () => {
		const n = createAdversary();
		n.level = 20;
		n.MIG = 6;
		n.rank = "elite";
		expect(calcHP(n)).toBe(140);
	});

	it("MP: level 10, WLP 4 → 30", () => {
		const n = createAdversary();
		n.level = 10;
		n.WLP = 4;
		expect(calcMP(n)).toBe(30);
	});

	it("Init: DEX 4, INS 4, elite → 4 + 2 = 6", () => {
		const n = createAdversary();
		n.DEX = 4;
		n.INS = 4;
		n.rank = "elite";
		expect(calcInit(n)).toBe(6);
	});
});

describe("filename", () => {
	it("sanitizes forbidden characters", () => {
		expect(sanitizeName('a/b \\ c:d*e?f"g<h>i|j')).toBe("a b c d e f g h i j");
	});

	it("reuses a marked file in place (plan Q7)", () => {
		const existing = new Set(["6. Bestiary/a.md", "6. Bestiary/b.md"]);
		const isMarked = (p: string) => p === "6. Bestiary/a.md";
		expect(resolveSavePath("a", "6. Bestiary", existing, isMarked)).toBe(
			"6. Bestiary/a.md"
		);
	});

	it("skips foreign files and suffixes collisions", () => {
		const existing = new Set(["6. Bestiary/a.md", "6. Bestiary/a (2).md"]);
		const isMarked = () => false;
		expect(resolveSavePath("a", "6. Bestiary", existing, isMarked)).toBe(
			"6. Bestiary/a (3).md"
		);
	});
});

