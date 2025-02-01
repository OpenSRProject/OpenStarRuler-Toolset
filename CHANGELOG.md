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