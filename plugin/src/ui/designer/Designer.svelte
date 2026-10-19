<script>
	import { createAdversary } from "../../core/model";
	import Affinities from "./Affinities.svelte";
	import SpPanel from "./SpPanel.svelte";

	export let ops; // DesignerOps

	let a = ops.newAdversary();
	let currentPath = "";
	let files = [];
	let filePick = "";
	let status = "";
	let busy = false;
	let dirty = false;

	function touch() {
		dirty = true;
	}

	function renameDetail(map, entry, oldName) {
		if (map && oldName !== entry.name && map[oldName]) {
			map[entry.name] = map[oldName];
			delete map[oldName];
		}
	}

	/**
	 * Live lookup of a detail object inside a name-keyed map. Returns the
	 * actual reference so template handlers can read AND write through it
	 * (a {@const ...} binding would be read-only in Svelte).
	 */
	function det(map, key) {
		return map ? map[key] : undefined;
	}

	async function doNew() {
		a = createAdversary();
		currentPath = "";
		filePick = "";
		status = "New adversary.";
		touch();
	}

	async function doOpen() {
		if (!filePick) return;
		busy = true;
		status = "…";
		try {
			const f = await ops.openFile(filePick);
			a = f.adversary;
			currentPath = f.path;
			status = f.marked
				? `Opened ${f.path}`
				: `Opened ${f.path} (unmarked)`;
			dirty = false;
		} catch (e) {
			status = `Open failed: ${e.message}`;
		} finally {
			busy = false;
		}
	}

	async function doSave() {
		if (!a.name) {
			status = "No name – cannot save.";
			return;
		}
		busy = true;
		status = "Saving…";
		try {
			const path = currentPath || ops.pathFor(a.name);
			await ops.saveAdversary(path, a);
			currentPath = path;
			status = `Saved ${path}`;
			dirty = false;
		} catch (e) {
			status = `Save failed: ${e.message}`;
		} finally {
			busy = false;
		}
	}

	async function doDuplicate() {
		busy = true;
		status = "Duplicating…";
		try {
			const p = await ops.duplicate(a);
			status = `Duplicated to ${p}`;
		} catch (e) {
			status = `Duplicate failed: ${e.message}`;
		} finally {
			busy = false;
		}
	}

	async function refreshFiles() {
		files = await ops.listFiles();
		filePick = files[0] || "";
	}

	refreshFiles();
</script>
<div class="fu-designer">
	<header class="fu-designer-header">
		<button class="fu-btn" onclick={doNew} disabled={busy}>New</button>
		<select class="fu-filepick" value={filePick} on:change={(e) => (filePick = e.target.value)}>
			<option value="">— open file —</option>
			{#each files as f (f)}
				<option value={f}>{f}</option>
			{/each}
		</select>
		<button class="fu-btn" onclick={doOpen} disabled={busy || !filePick}>Open</button>
		<button class="fu-btn fu-btn-primary" onclick={doSave} disabled={busy}>Save</button>
		<button class="fu-btn" onclick={doDuplicate} disabled={busy}>Duplicate</button>
	</header>

	{#if status}
		<div class="fu-status {dirty ? 'fu-dirty' : ''}">{status}</div>
	{/if}

	<SpPanel npc={a} />

	<section class="fu-section">
		<h3>Basics</h3>
		<label>Name <input value={a.name} on:input={(e) => { a.name = e.target.value; touch(); }} /></label>
		<div class="fu-grid">
			<label>Rank <input value={a.rank} on:input={(e) => { a.rank = e.target.value; touch(); }} placeholder="elite / champion2…" /></label>
			<label>Level <input type="number" value={a.level} on:input={(e) => { a.level = +e.target.value; touch(); }} /></label>
			<label>Species <input value={a.species} on:input={(e) => { a.species = e.target.value; touch(); }} /></label>
			<label>Initiative <input type="number" value={a.initiative} on:input={(e) => { a.initiative = +e.target.value; touch(); }} /></label>
		</div>
		<label>Description <textarea rows="3" value={a.description} on:input={(e) => { a.description = e.target.value; touch(); }} /></label>
		<label>Traits <input value={a.traits} on:input={(e) => { a.traits = e.target.value; touch(); }} /></label>
		<label>Typical Traits <input value={a.typicaltraits} on:input={(e) => { a.typicaltraits = e.target.value; touch(); }} /></label>
	</section>

	<section class="fu-section">
		<h3>Attributes &amp; Defense</h3>
		<div class="fu-grid">
			{#each ["DEX", "INS", "MIG", "WLP", "HP", "MP", "DEF", "MDEF"] as attr (attr)}
				<label>{attr}
					<input type="number" value={a[attr]} on:input={(e) => { a[attr] = +e.target.value; touch(); }} />
				</label>
			{/each}
		</div>
	</section>

	<section class="fu-section">
		<h3>Affinities</h3>
		<Affinities values={a.affinities} on:change={() => touch()} />
	</section>
	{#each ["attacksMelee", "attacksRanged"] as listKey (listKey)}
		<section class="fu-section">
			<h3>{listKey === "attacksMelee" ? "Attacks (Melee)" : "Attacks (Ranged)"}</h3>
			{#each a[listKey] as entry, i (i)}
				<div class="fu-list-item">
					<input class="fu-li-name" value={entry.name}
						on:input={(e) => { const old = entry.name; entry.name = e.target.value; renameDetail(a.attackDetails, entry, old); touch(); }} />
					<button class="fu-li-del" onclick={() => { a[listKey].splice(i, 1); touch(); }}>×</button>
					{#if det(a.attackDetails, entry.name)}
						<div class="fu-grid">
							<label>Attr1 <input value={det(a.attackDetails, entry.name).attr1} on:input={(e) => { det(a.attackDetails, entry.name).attr1 = e.target.value; touch(); }} /></label>
							<label>Attr2 <input value={det(a.attackDetails, entry.name).attr2} on:input={(e) => { det(a.attackDetails, entry.name).attr2 = e.target.value; touch(); }} /></label>
							<label>Type <input value={det(a.attackDetails, entry.name).type} on:input={(e) => { det(a.attackDetails, entry.name).type = e.target.value; touch(); }} /></label>
							<label>Damage <input value={det(a.attackDetails, entry.name).damage} on:input={(e) => { det(a.attackDetails, entry.name).damage = e.target.value; touch(); }} /></label>
						</div>
						<label>Special <input value={det(a.attackDetails, entry.name).special.join(", ")} on:input={(e) => { det(a.attackDetails, entry.name).special = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); touch(); }} /></label>
						<label class="fu-check"><input type="checkbox" checked={det(a.attackDetails, entry.name).extraDamage} on:change={(e) => { det(a.attackDetails, entry.name).extraDamage = e.target.checked; touch(); }} /> Extra damage</label>
					{/if}
					<label class="fu-li-desc">Desc <input value={entry.desc} on:input={(e) => { entry.desc = e.target.value; touch(); }} /></label>
				</div>
			{/each}
			<button class="fu-btn fu-btn-add" onclick={() => { a[listKey].push({ name: "", desc: "" }); touch(); }}>+ Add attack</button>
		</section>
	{/each}
	<section class="fu-section">
		<h3>Spells</h3>
		{#each a.spells as entry, i (i)}
			<div class="fu-list-item">
				<input class="fu-li-name" value={entry.name}
					on:input={(e) => { const old = entry.name; entry.name = e.target.value; renameDetail(a.spellDetails, entry, old); touch(); }} />
				<button class="fu-li-del" onclick={() => { a.spells.splice(i, 1); touch(); }}>×</button>
				{#if det(a.spellDetails, entry.name)}
					<label class="fu-check"><input type="checkbox" checked={det(a.spellDetails, entry.name).offensive} on:change={(e) => { det(a.spellDetails, entry.name).offensive = e.target.checked; touch(); }} /> Offensive ($)</label>
					<div class="fu-grid">
						<label>Attr1 <input value={det(a.spellDetails, entry.name).attr1} on:input={(e) => { det(a.spellDetails, entry.name).attr1 = e.target.value; touch(); }} /></label>
						<label>Attr2 <input value={det(a.spellDetails, entry.name).attr2} on:input={(e) => { det(a.spellDetails, entry.name).attr2 = e.target.value; touch(); }} /></label>
						<label>MP <input value={det(a.spellDetails, entry.name).mp} on:input={(e) => { det(a.spellDetails, entry.name).mp = e.target.value; touch(); }} /></label>
						<label>Target <input value={det(a.spellDetails, entry.name).target} on:input={(e) => { det(a.spellDetails, entry.name).target = e.target.value; touch(); }} /></label>
						<label>Duration <input value={det(a.spellDetails, entry.name).duration} on:input={(e) => { det(a.spellDetails, entry.name).duration = e.target.value; touch(); }} /></label>
						<label>Dmg type <input value={det(a.spellDetails, entry.name).damagetype} on:input={(e) => { det(a.spellDetails, entry.name).damagetype = e.target.value; touch(); }} /></label>
					</div>
					<label>Effect <textarea rows="2" value={det(a.spellDetails, entry.name).effect} on:input={(e) => { det(a.spellDetails, entry.name).effect = e.target.value; entry.desc = e.target.value; touch(); }} /></label>
				{/if}
			</div>
		{/each}
		<button class="fu-btn fu-btn-add" onclick={() => {
			const nm = "";
			a.spells.push({ name: nm, desc: "" });
			a.spellDetails = a.spellDetails || {};
			a.spellDetails[nm] = { name: nm, offensive: false, attr1: "", attr2: "", mp: "", target: "", duration: "", damagetype: "", special: [], effect: "" };
			touch();
		}}>+ Add spell</button>
	</section>

	<section class="fu-section">
		<h3>Skills / Actions</h3>
		{#each a.skills as entry, i (i)}
			<div class="fu-list-item">
				<input class="fu-li-name" value={entry.name}
					on:input={(e) => { const old = entry.name; entry.name = e.target.value; renameDetail(a.skillDetails, entry, old); touch(); }} />
				<button class="fu-li-del" onclick={() => { a.skills.splice(i, 1); touch(); }}>×</button>
				{#if det(a.skillDetails, entry.name)}
					<label>SP <input type="number" value={det(a.skillDetails, entry.name).spCost} on:input={(e) => { det(a.skillDetails, entry.name).spCost = +e.target.value; touch(); }} /></label>
					<label class="fu-li-desc">Effect <input value={det(a.skillDetails, entry.name).effect} on:input={(e) => { det(a.skillDetails, entry.name).effect = e.target.value; entry.desc = e.target.value; touch(); }} /></label>
				{/if}
			</div>
		{/each}
		<button class="fu-btn fu-btn-add" onclick={() => {
			const nm = "";
			a.skills.push({ name: nm, desc: "" });
			a.skillDetails = a.skillDetails || {};
			a.skillDetails[nm] = { spCost: 1, effect: "" };
			touch();
		}}>+ Add skill</button>
	</section>

	<section class="fu-section">
		<h3>Rules</h3>
		{#each a.rules as entry, i (i)}
			<div class="fu-list-item">
				<input class="fu-li-name" value={entry.name} on:input={(e) => { entry.name = e.target.value; touch(); }} />
				<button class="fu-li-del" onclick={() => { a.rules.splice(i, 1); touch(); }}>×</button>
				<label class="fu-li-desc">Desc <input value={entry.desc} on:input={(e) => { entry.desc = e.target.value; touch(); }} /></label>
			</div>
		{/each}
		<button class="fu-btn fu-btn-add" onclick={() => { a.rules.push({ name: "", desc: "" }); touch(); }}>+ Add rule</button>
	</section>
</div>
<style>
	.fu-designer { padding: 0.5rem 1rem; display: flex; flex-direction: column; gap: 1rem; }
	.fu-designer-header { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.fu-filepick { flex: 1; min-width: 160px; }
	.fu-btn { padding: 0.25rem 0.6rem; }
	.fu-btn-primary { font-weight: 600; }
	.fu-status { font-size: 0.85rem; color: var(--text-muted, #888); }
	.fu-status.fu-dirty::before { content: "● "; color: var(--text-accent, #888); }
	.fu-section { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--background-modifier-border, #333); padding-top: 0.75rem; }
	.fu-section h3 { margin: 0; font-size: 1rem; }
	.fu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.5rem; }
	.fu-section label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.85rem; color: var(--text-muted, #aaa); }
	.fu-check { flex-direction: row; align-items: center; gap: 0.4rem; }
	.fu-list-item { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.5rem; border: 1px solid var(--background-modifier-border, #333); border-radius: 6px; }
	.fu-li-name { font-weight: 600; }
	.fu-li-desc { flex-direction: row; align-items: center; gap: 0.4rem; }
	.fu-li-del { align-self: flex-end; background: none; border: none; color: var(--text-danger, #e66); cursor: pointer; font-size: 1rem; }
	.fu-btn-add { align-self: flex-start; }
</style>