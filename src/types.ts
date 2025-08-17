import { window } from 'vscode';

export const PREFIX = 'opensr-file-cloning';

export enum CONFIGS {
	BASE_GAME_FOLDER = `${PREFIX}.baseGameFolder`,
	REGISTERED_MODS = `${PREFIX}.registeredMods`,
}

export enum COMMANDS {
	FIND_BASE_FILES = `${PREFIX}.findBaseFiles`,
	REGISTER_MOD = `${PREFIX}.registerMod`,
	REREGISTER_MOD = `${PREFIX}.reregisterMod`,
	CLONE_BASE_FILE = `${PREFIX}.cloneBaseFile`,
	CLONE_MOD_FILE = `${PREFIX}.cloneModFile`,
	CLONE_ANCESTOR_FILE = `${PREFIX}.cloneAncestorFile`,
	COMPARE_BASE_FILE = `${PREFIX}.compareBaseFile`,
	COMPARE_MOD_FILE = `${PREFIX}.compareModFile`,
	COMPARE_ANCESTOR_FILE = `${PREFIX}.compareAncestorFile`,
	COMPARE_TO_BASE = `${PREFIX}.compareToBase`,
	COMPARE_TO_MOD = `${PREFIX}.compareToMod`,
	COMPARE_TO_ANCESTOR = `${PREFIX}.compareToAncestor`,
}

export const LOGGER = window.createOutputChannel('OpenSR Toolset', {
	log: true,
});
export const MODINFO = 'modinfo.txt';

export interface ModFile {
	modPath: string;
	modName: string;
	path: string;
}
export type ModInfo = Omit<ModFile, 'path'>;
export function resolvePath(file: ModFile) {
	return `${file.modPath}/${file.path || MODINFO}`;
}

export type StringOptional = string | undefined;
export type ModinfoField = 'Derives From' | 'Name';
export type FileFindable = StringOptional | ModInfo;
export type FileOperation = (
	source: ModFile,
	destination: ModFile,
) => Promise<void>;
export type FileFinder<T extends FileFindable> = (
	purpose: string,
	modinfo: T,
	usePath?: string,
	isInternal?: boolean,
) => Promise<ModFile | undefined>;
