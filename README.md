# OpenSR Toolset

Performs a number of useful functions related to modding Star Ruler 2.

## Features

* Cloning files from another mod
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

N/A

## Extension Settings

* `opensr-file-cloning.baseGameFolder`: string
    - Path to Star Ruler 2 installation folder.
* `opensr-file-cloning.registeredMods`: dictionary (JSON object)
    - Maps mod names from the UI to the paths of their respective mod folders.

## Known Issues

* Cross-repo comparisons may cause your Source Control pane to detect and open Git repositories unrelated to your project.
    - This is related to the `Git: Auto Repository Detection` (JSON: `git.autoRepositoryDetection`) setting. VSCode defaults this setting to `true`, which scans both subfolders of the current workspace and parent folders of currently opened files for Git repositories.

    Setting it to `false` or `subFolders` will resolve the problem.
* Comparisons don't yet have graceful handling for cases where one or both files are nonexistent.

### For more information

Visit the OpenSR Discord: https://discord.gg/sUJKJDc