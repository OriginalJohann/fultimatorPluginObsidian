<script>
	import {
		calcAvailableSkills,
		calcUsedSkills,
		calcHP,
		calcMP,
		calcDef,
		calcMDef,
		calcInit,
	} from "../../core/sp";

	export let npc; // Adversary

	$: spPool = calcAvailableSkills(npc);
	$: spUsed = calcUsedSkills(npc);
	$: over = spUsed > spPool;
	$: hp = calcHP(npc);
	$: mp = calcMP(npc);
	$: def = calcDef(npc);
	$: mdef = calcMDef(npc);
	$: init = calcInit(npc);
</script>

<div class="fu-sp-panel">
	<div class="fu-sp-row">
		<span class="fu-sp-label">SP Budget</span>
		<span class="fu-sp-value {over ? 'fu-over' : ''}">{spUsed} / {spPool}</span>
	</div>
	{#if over}
		<div class="fu-sp-warning">⚠ Over budget: {spUsed - spPool} SP</div>
	{/if}
	<div class="fu-sp-derived">
		<span title="HP preview">HP {hp}</span>
		<span title="MP preview">MP {mp}</span>
		<span title="DEF">DEF {def}</span>
		<span title="MDEF">MDEF {mdef}</span>
		<span title="Initiative">Init {init}</span>
	</div>
</div>
<style>
	.fu-sp-panel { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.6rem; background: var(--background-secondary, #222); border-radius: 6px; }
	.fu-sp-row { display: flex; justify-content: space-between; }
	.fu-sp-value { font-weight: 600; }
	.fu-sp-value.fu-over { color: var(--text-danger, #e66); }
	.fu-sp-warning { color: var(--text-danger, #e66); font-size: 0.85rem; }
	.fu-sp-derived { display: flex; gap: 0.6rem; flex-wrap: wrap; font-size: 0.8rem; color: var(--text-muted, #aaa); }
</style>