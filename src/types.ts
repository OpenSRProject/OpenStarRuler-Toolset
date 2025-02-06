import { window } from "vscode";

export enum CONFIGS {
    BASE_GAME_FOLDER = "opensr-file-cloning.baseGameFolder",
    REGISTERED_MODS = "opensr-file-cloning.registeredMods",
};

export enum COMMANDS {
    FIND_BASE_FILES = "opensr-file-cloning.findBaseFiles",
    REGISTER_MOD = "opensr-file-cloning.registerMod",
    REREGISTER_MOD = "opensr-file-cloning.reregisterMod",
    CLONE_BASE_FILE = "opensr-file-cloning.cloneBaseFile",
    CLONE_MOD_FILE = "opensr-file-cloning.cloneModFile",
    CLONE_ANCESTOR_FILE = "opensr-file-cloning.cloneAncestorFile",
    COMPARE_BASE_FILE = "opensr-file-cloning.compareBaseFile",
    COMPARE_MOD_FILE = "opensr-file-cloning.compareModFile",
    COMPARE_ANCESTOR_FILE = "opensr-file-cloning.compareAncestorFile",
};

export const LOGGER = window.createOutputChannel("OpenSR Toolset", { log: true });
export const MODINFO = "modinfo.txt";

export interface ModFile {
    modPath: string;
    modName: string;
    path: string;
}
export type ModInfo = Omit<ModFile, 'path'>;
export function resolvePath(file: ModFile) {
    return `${file.modPath}/${file.path || MODINFO}`;
}

export type ModinfoField = "Derives From" | "Name";
export type FileOperation = (source: ModFile, destination: ModFile) => Promise<void>;