/**
 * Filename sanitization + collision suffixing (plan Q13).
 *
 * - Sanitization: replace `/ \ : * ? " < > |` with space, collapse
 *   whitespace, trim.
 * - Collision: `Name.md` taken → `Name (2).md`, `Name (3).md`, …
 * - Hard invariant (plan Q7): a file without the plugin marker is never
 *   overwritten – `resolveSavePath` therefore only reuses an existing
 *   name when that file is marked.
 *
 * Headless: no Obsidian imports.
 */

/** Characters not allowed in vault filenames. */
const FORBIDDEN_CHARS = /[/\\:*?"<>|]/g;

/** Sanitize an adversary name into a safe basename (no extension). */
export function sanitizeName(name: string): string {
	return name
		.replace(FORBIDDEN_CHARS, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Resolve the save path for an adversary name inside `folder`.
 *
 * @param name          Adversary display name.
 * @param folder        Vault-relative target folder.
 * @param existing      Map of vault-relative file paths that exist.
 * @param isMarked      Predicate: does an existing file carry the plugin marker?
 * @returns             Vault-relative path, e.g. `6. Bestiary/Name (2).md`.
 */
export function resolveSavePath(
	name: string,
	folder: string,
	existing: Set<string>,
	isMarked: (path: string) => boolean
): string {
	const base = sanitizeName(name);
	const dir = folder.replace(/\/+$/, "");
	const prefix = dir ? `${dir}/` : "";

	// A marked file with this exact name may be overwritten in place (plan Q7).
	const plain = `${prefix}${base}.md`;
	if (existing.has(plain) && isMarked(plain)) return plain;

	// Otherwise find the first free `Name (n).md` suffix.
	for (let n = 2; ; n++) {
		const candidate = `${prefix}${base} (${n}).md`;
		// Never reuse a foreign (unmarked) file, even if the name matches.
		if (!existing.has(candidate) || isMarked(candidate)) return candidate;
	}
}
