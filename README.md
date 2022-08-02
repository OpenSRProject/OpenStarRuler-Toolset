# OpenSR Toolset

Performs a number of useful functions related to modding Star Ruler 2.

## Features

* Cloning base game files
* Cloning mod files (with fallback to base game)
* Comparing files with the base game
* Comparing files with a mod (with fallback to base game)

## Requirements

N/A

## Extension Settings

* `opensr-file-cloning.baseGameFolder`: string
    - Path to Star Ruler 2 installation folder.
* `opensr-file-cloning.registeredMods`: dictionary (JSON object)
    - Maps mod names from the UI to the paths of their respective mod folders.

## Known Issues

* Doesn't handle inter-mod dependencies yet. If a mod doesn't explicitly contain a file, fallback is always to the base game.
* Cross-mod comparison may cause your Source Control pane to detect and open Git repositories unrelated to your project.
    - This is related to the `Git: Auto Repository Detection` (JSON: `git.autoRepositoryDetection`) setting. VSCode defaults this setting to `true`, which scans both subfolders of the current workspace and parent folders of currently opened files for Git repositories.

    Setting it to `false` or `subFolders` will resolve the problem.

## Release Notes

### 0.1.0

First alpha build, only clones files.

### 0.2.0

Second alpha build. Extensive refactoring, and added the ability to compare files without cloning.

### For more information

Visit the OpenSR Discord: https://discord.gg/sUJKJDc