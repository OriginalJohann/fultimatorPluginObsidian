# Instructions for Fultimator Obsidian Plugin Development

## 1. Role & Objective
* **Goal:** Convert Fultimator (original: `https://github.com/fultimator/fultimator/tree/main`) into a fully functional Obsidian plugin.
* **Target Repository:** Develop directly on the fork: `https://github.com/OriginalJohann/fultimatorPluginObsidian.git`.
* **Test Environment:** Use the test vault `./flosFabUBox` for all local testing and validation.

## 2. Communication & Documentation Standards
* **User Communication:** Primary language for chat interface communication is **German**.
* **Code & Documentation:** Write ALL documentation, commit messages, code comments, system notes, and planning files in **English**.

## 3. Core Functional Requirements
* **Markdown Data Persistence:**
  * Store all entities and resources generated via Fultimator (e.g., enemy stat blocks) as individual `.md` (Markdown) files in the Obsidian Vault.
  * Implement bidirectional data sync: The plugin must generate Markdown files from UI inputs AND parse existing Markdown files back into Fultimator for editing.
* **Feature Parity:**
  * All original features and generator functionalities of Fultimator must remain functional using Obsidian as the native data backend.
* **Theme & Template Compatibility:**
  * Strict compatibility with the community theme located at `flosFabUBox/7. Blue` is mandatory.
  * Conform strictly to existing templates provided in `flosFabUBox/7. Blue/1. Basics/Templates` when formatting generated Markdown output.

## 4. Execution Guidelines & KI Constraints
* **Adherence to AGENTS.md:** Respect all workspace limits, planning steps (`./plans/`), execution logging (`./scratchpad/`), security rules, and stop conditions defined in `AGENTS.md`.
* **No Unverified Assumptions:** Ask the user before proceeding if data mappings, template fields, or edge cases in Markdown parsing are ambiguous.