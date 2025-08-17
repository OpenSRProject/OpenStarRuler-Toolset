# OpenSR Toolset

Performs a number of useful functions related to modding Star Ruler 2.

## How to Install

If you're looking for the latest published version, go to the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=OpenStarRuler.opensr-toolset) and install it there.

If you can't install it from the Marketplace for some reason, or you want to build and install from source, a couple of helper scripts have been provided in the [GitHub repo](https://github.com/OpenSRProject/OpenStarRuler-Toolset) that should do the trick. Simply run `install.bat` (Windows) or `install.sh` (Linux/MacOS) and let it take care of the rest!

## Features

- Cloning files from another mod
    - Base game
    - Ancestor mods (if any), with fallback to base game
    - Other mods and their ancestors
- Comparing files with another mod
    - Supports the same sources as file cloning
    - The diff is editable, like the "Working Copy" diffs provided by VSCode's Git support.
    - Green was added by the currently active mod.
    - Red was removed by (or never existed in) the currently active mod.
    - As of 0.4.0, has the ability to compare the currently active file without having to input a file path, via the "Compare Current File to..." command family.
    
## Requirements

If installing from the Marketplace: Arguably a copy of Star Ruler 2. The extension will work without it, but won't be able to fall back to vanilla files, and will make this known by prompting you to find them every time it becomes relevant.

If installing from source: As above, plus:
- Yarn 1 (VSCE claims Yarn 2 is unsupported)
- Node 20+
- VSCode (you'll have nothing to install *to* without that!)
    - The install script expects VSCode to be accessible from the command line via `code`. 

## Extension Settings

- `opensr-toolset.baseGameFolder`: string
    - Path to Star Ruler 2 installation folder.
- `opensr-toolset.registeredMods`: dictionary (JSON object)
    - Maps mod names from the UI to the paths of their respective mod folders.

## Known Issues

* Cross-repo comparisons may cause your Source Control pane to detect and open Git repositories unrelated to your project.
    - This is related to the `Git: Auto Repository Detection` (JSON: `git.autoRepositoryDetection`) setting. VSCode defaults this setting to `true`, which scans both subfolders of the current workspace and parent folders of currently opened files for Git repositories.

    Setting it to `false` or `subFolders` will resolve the problem.
* Comparisons don't yet have graceful handling for cases where one or both files are nonexistent.

### For more information

Visit the OpenSR Discord: https://discord.gg/sUJKJDc