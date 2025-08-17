# Change Log

## 0.1.0

First alpha build, only clones files.

## 0.2.0

Second alpha build. Extensive refactoring, and added the ability to compare files without cloning.

### 0.2.1

- Fixed an issue where file cloning would erroneously claim a file already exists because it ran into a different error.
- Fixed an issue where file cloning would always fail because a promise used to build the destination path wasn't being awaited.
- Fixed an issue where file cloning wouldn't create subfolders if necessary.
- Upgraded minimum VSCode version to 1.75 (January 2023, so still two years out of date) to simplify package.json.
- More refactoring using new habits and knowledge picked up over the past few years:
    - Destructured imports for brevity. VSCode APIs in particular have benefited from some deep destructuring, I'd say...
    - Replaced deprecated synchronous filesystem functions with promises (and obviously awaited them, still need them to be synchronous!)
    - Fixed a few TypeScript warnings related to the registered mod list.
- Started working on handling mod ancestry. Nothing actually functional yet, just dangling bits of code here and there for now.

## 0.3.0

- Cloning/comparing another mod's files now falls back to its ancestors (if any) before defaulting to the base game.
    - This process only checks the registered mod list. If an ancestor's name has not been registered with the OpenSR Toolset yet, it will not be detected and the operation will fall through to the base game.
- Added a third target type for clone/compare commands: Ancestor. Ancestor mode tries to clone or compare files from the current mod's ancestors (if any) or the base game.
- Mod registration now reads the mod name from `modinfo.txt` instead of requiring the user to supply a name themselves.
    - Added a `Reregister Mod` command to update the name of a previously registered mod.
- More refactoring: The extension was getting a little bloated and hard to navigate, so I broke it up into separate files.
- Added logging under `Output -> OpenSR Toolset`. This is subject to VSCode's log level, configurable via `Developer: Set Log Level...`.
- Added a custom editor title for compare operations, denoting the source and destination mods for the comparison. (The base game is labeled `Base`).

## 0.4.0

- Added a new command family: `Compare Current File to...`. This is a variant of the compare command that tries to compare the currently active file to its counterpart in the requested mod.

# 1.0.0

- Finally got around to figuring out how to publish to VSCode Marketplace.
- Added install scripts for localdev QoL. The batch/shell scripts will rebuild the extension, then tell VSCode to install it from the freshly-baked VSIX.
- **BREAKING**: Changed extension name from `opensr-file-cloning` to the more appropriate `OpenSRToolset`.
    - If you've previously used the old extension, you will need to rename all your settings to use the `OpenSRToolset` prefix. Sorry about that, shouldn't happen again.