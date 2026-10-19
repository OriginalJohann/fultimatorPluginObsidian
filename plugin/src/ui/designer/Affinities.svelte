<script>
	/** 9 affinities × RS/VU/AB/IM/∅ (plan §10.1). */
	import { createEventDispatcher } from "svelte";
	import { AFFINITY_KEYS } from "../../core/model";

	export let values; // Affinities

	const dispatch = createEventDispatcher();
	const OPTS = ["", "RS", "VU", "AB", "IM"];

	function set(key, value) {
		values[key] = value === "" ? null : value;
		// Notify the parent (Designer) to mark the state dirty.
		dispatch("change");
	}
</script>

<div class="fu-affinities">
	{#each AFFINITY_KEYS as key (key)}
		<div class="fu-affinity-row">
			<span class="fu-affinity-key">{key}</span>
			{#each OPTS as opt (opt)}
				<button
					type="button"
					class="fu-affinity-opt fu-aff-{opt}"
					class:active={values[key] === (opt === "" ? null : opt)}
					onclick={() => set(key, opt)}
					title={opt === "" ? "none" : opt}>
					{opt === "" ? "∅" : opt}
				</button>
			{/each}
		</div>
	{/each}
</div>
<style>
	.fu-affinities { display: flex; flex-direction: column; gap: 0.3rem; }
	.fu-affinity-row { display: flex; align-items: center; gap: 0.4rem; }
	.fu-affinity-key { width: 70px; font-size: 0.85rem; color: var(--text-muted, #aaa); }
	.fu-affinity-opt { padding: 0.1rem 0.4rem; font-size: 0.8rem; }
	.fu-affinity-opt.active { outline: 2px solid var(--text-accent, #888); }
</style>