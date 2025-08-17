import { Stats } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join as joinPath } from 'node:path';
import { commands, window, workspace } from 'vscode';

import {
	COMMANDS,
	CONFIGS,
	FileFindable,
	FileFinder,
	LOGGER,
	ModFile,
	MODINFO,
	ModInfo,
	ModinfoField,
	resolvePath,
	unresolvePath,
} from './types';

const { getConfiguration, workspaceFolders } = workspace;
const { executeCommand } = commands;
const { showErrorMessage, showInputBox, showQuickPick } = window;
const { entries } = Object;

export type RegisteredModList = {
	[modName: string]: string;
};

export function includesAll<T>(array: Array<T>, ...vals: T[]): boolean {
	return vals.every((val) => array.includes(val));
}

export function getConfig(key: string): any {
	return getConfiguration().get(key);
}

export async function updateConfig(key: string, value: any) {
	await getConfiguration().update(key, value, true);
}

// Like `stat()`, but returns `undefined` on a missing file instead of throwing an error.
async function safeStat(file: string): Promise<Stats | undefined> {
	try {
		return await stat(file);
	} catch (error: any) {
		if (error.code === 'ENOENT') {
			LOGGER.debug(`safeStat: File "${file}" doesn't exist!`);
			return undefined;
		}
		LOGGER.error(
			`safeStat: Encountered unknown error fetching stats for "${file}"`,
			error,
		);
		throw error;
	}
}

export async function findModinfos(currentDirPath: string): Promise<ModInfo[]> {
	const results: ModInfo[] = [];
	const names = await readdir(currentDirPath);
	await Promise.all(
		names.map(async function (name) {
			const filePath = joinPath(currentDirPath, name);
			if ((await safeStat(filePath))?.isDirectory()) {
				results.push(...(await findModinfos(filePath)));
			} else if (name === MODINFO) {
				const modName = await queryModinfo(currentDirPath, 'Name');
				if (modName)
					results.push({
						modPath: currentDirPath,
						modName,
					});
			}
		}),
	);
	return results;
}

export async function pickModinfo(
	modinfos: ModInfo[],
	title: string,
): Promise<ModInfo | undefined> {
	const modinfo = await showQuickPick(
		modinfos.map((modinfo) => {
			LOGGER.debug(
				`pickModinfo: Option "${modinfo.modName}" maps to "${modinfo.modPath}"`,
			);
			return {
				label: modinfo.modName,
				description: modinfo.modPath,
			};
		}),
		{ canPickMany: false, title },
	);
	return modinfo && { modName: modinfo.label, modPath: modinfo.description };
}

export async function getDestinationMod(
	fromCurrentFile: boolean,
): Promise<ModInfo | undefined> {
	if (!workspaceFolders) {
		LOGGER.info('getDestinationMod: No folders in workspace, aborting...');
		await showErrorMessage('You must open a folder to execute this command!', {
			modal: true,
		});
		return;
	}

	let modinfos = await findModinfos(workspaceFolders[0].uri.fsPath);
	if (fromCurrentFile) {
		const currentFile = window.activeTextEditor?.document.fileName;
		if (currentFile) {
			LOGGER.info(
				`getDestinationMod: Requesting modinfo for current file ${currentFile}...`,
			);
			modinfos = modinfos.filter(({ modPath }) => {
				const isRightMod = currentFile?.includes(modPath);
				LOGGER.debug(
					`getDestinationMod: ${modPath} leads to current file: ${isRightMod}`,
				);
				return isRightMod;
			});
		}
	}

	if (modinfos.length === 1) {
		LOGGER.info(
			`getDestinationMod: Only one mod in workspace, defaulting to "${modinfos[0].modName}" at "${modinfos[0].modPath}"`,
		);
		return modinfos[0];
	} else if (modinfos.length > 1) {
		const modinfo = await pickModinfo(modinfos, 'Select Destination Mod');
		if (modinfo)
			LOGGER.info(
				`getDestinationMod: User selected "${modinfo.modName}" at "${modinfo.modPath}"`,
			);
		return modinfo;
	}
	LOGGER.error('getDestinationMod: No mods found in workspace!');
	return;
}

// NOTE: Does not work on multi-line data.
// That's fine, though, since we only need to read Name and Derives From,
// which are both single-liners.
export async function queryModinfo(
	pathToMod: string,
	field: ModinfoField,
): Promise<string | undefined> {
	const modinfoPath = pathToMod.endsWith(MODINFO)
		? pathToMod
		: joinPath(pathToMod, MODINFO);
	try {
		const modinfo = await readFile(modinfoPath, { encoding: 'utf8' });
		LOGGER.trace(modinfo);
		return modinfo.match(
			new RegExp(`^[ \t]*${field}[ \t]*:[ \t]*(.*?)[ \t]*$`, 'im'),
		)?.[1];
	} catch (error: any) {
		if (error.code === 'ENOENT') {
			LOGGER.error(`queryModinfo: Modinfo not found at ${modinfoPath}!`);
			return undefined;
		}
		LOGGER.error(
			`queryModinfo: Encountered unknown error reading modinfo at "${modinfoPath}"`,
			error,
		);
		throw error;
	}
}

export async function getGamePath(
	purpose: string,
	isInternal?: boolean,
): Promise<string | undefined> {
	const gamePath = getConfig(CONFIGS.BASE_GAME_FOLDER) as string;
	if (!gamePath) {
		if (isInternal) {
			LOGGER.info(
				'getGamePath: No game path in config, but isInternal is set. Aborting...',
			);
			return;
		} else {
			LOGGER.info(
				'getGamePath: No game path in config. Prompting user for game path...',
			);
			await showErrorMessage(
				`Cannot ${purpose} from unknown location! Set your base game path first!`,
				{ modal: true },
			);
			if (await executeCommand(COMMANDS.FIND_BASE_FILES))
				return getGamePath(purpose, isInternal);
			LOGGER.info(
				'getGamePath: findBaseFiles returned undefined, user must have canceled...',
			);
			return;
		}
	}
	return gamePath;
}

export async function requestFilePath(
	purpose: string,
	defaultPath?: string,
	isInternal?: boolean,
): Promise<string | undefined> {
	let path: string | undefined;
	if (!isInternal) {
		path = await showInputBox({
			title: 'File Path',
			prompt: `Input the path to the file to ${purpose}, e.g. "data/objects.txt"`,
			value: defaultPath,
		});
	} else {
		path = defaultPath;
	}
	if (path?.startsWith('/') || path?.startsWith('\\')) path = path.substring(1);
	return path;
}

export async function findBaseFile(
	purpose: string,
	destinationMod: ModInfo,
	gamePath?: string,
	usePath?: string,
	isInternal?: boolean,
): Promise<ModFile | undefined> {
	if (!gamePath) {
		LOGGER.info('findBaseFile: No game path provided, aborting...');
		return;
	}
	const path = await requestFilePath(purpose, usePath, isInternal);
	if (!path) {
		LOGGER.info('findBaseFile: No file path provided, aborting...');
		return;
	}
	const file = {
		modPath: gamePath,
		modName: 'Base',
		path,
	};
	if (!(await safeStat(resolvePath(file)))?.isFile()) {
		if (isInternal) {
			LOGGER.info(
				`findBaseFile: File "${path}" does not exist in "${gamePath}", but isInternal is set. Aborting...`,
			);
			return;
		} else {
			LOGGER.info(
				`findBaseFile: File "${path}" does not exist in "${gamePath}". Retrying...`,
			);
			await showErrorMessage(
				'The specified file does not exist! Are you sure you specified the right path?',
				{ modal: true },
			);
			return await findBaseFile(purpose, destinationMod, gamePath, usePath);
		}
	}
	return file;
}

export async function pickMod(
	purpose: string,
	modName?: string,
): Promise<ModInfo | undefined> {
	const registeredMods = getConfig(
		CONFIGS.REGISTERED_MODS,
	) as RegisteredModList;
	if (modName) {
		LOGGER.debug(`pickMod: Autoselecting "${modName}"...`);
		return registeredMods
			? { modName, modPath: registeredMods[modName] }
			: undefined;
	}
	if (!entries(registeredMods)?.length) {
		LOGGER.info(
			`pickMod: No registered mods, prompting user to register one...`,
		);
		await showErrorMessage(`Must have a mod to ${purpose} from!`, {
			modal: true,
		});
		if (await executeCommand(COMMANDS.REGISTER_MOD))
			return await pickMod(purpose);
		return;
	}

	const modinfos = entries(registeredMods).map(([modName, modPath]) => {
		return {
			modName,
			modPath,
		};
	});
	if (modinfos.length === 1) {
		LOGGER.info(
			`pickMod: Only one registered mod, defaulting to "${modinfos[0].modName}" at "${modinfos[0].modPath}"`,
		);
		return modinfos[0];
	} else {
		const modinfo = await pickModinfo(modinfos, 'Select Source Mod');
		if (modinfo)
			LOGGER.info(
				`pickMod: User selected "${modinfo.modName}" at "${modinfo.modPath}"`,
			);
		else LOGGER.info('pickMod: No mod selected, user must have canceled...');
		return modinfo;
	}
}

export async function findAncestorFile(
	purpose: string,
	destinationMod: ModInfo,
	modName?: string,
	usePath?: string,
	isInternal = false,
): Promise<ModFile | undefined> {
	if (!modName) {
		LOGGER.info(
			'findAncestorFile: No ancestor name provided, falling back to vanilla...',
		);
		return await findBaseFile(
			purpose,
			destinationMod,
			await getGamePath(purpose, isInternal),
			usePath,
			isInternal,
		);
	}
	const { modPath } = (await pickMod(purpose, modName)) || {};
	if (!modPath) {
		LOGGER.info(
			`findAncestorFile: Mod ${modName} not registered, falling back to vanilla...`,
		);
		return await findBaseFile(
			purpose,
			destinationMod,
			await getGamePath(purpose, isInternal),
			usePath,
			isInternal,
		);
	}
	const path = await requestFilePath(purpose, usePath, isInternal);
	if (!path) {
		LOGGER.info('findAncestorFile: No file path provided, aborting...');
		return;
	}
	const file = { modPath, modName, path };
	if (!(await safeStat(resolvePath(file)))?.isFile()) {
		const ancestorName = await queryModinfo(modPath, 'Derives From');
		const ancestorFile = await findAncestorFile(
			purpose,
			destinationMod,
			ancestorName,
			path,
			true,
		);
		if (!ancestorFile) {
			if (isInternal) {
				LOGGER.info(
					`findAncestorFile: File "${path}" does not exist in "${modName}" or its ancestors, but isInternal is set. Aborting...`,
				);
				return;
			} else {
				LOGGER.info(
					`findAncestorFile: File "${path}" does not exist in "${modName}" or its ancestors. Retrying...`,
				);
				await showErrorMessage(
					'The specified file does not exist! Are you sure you specified the right path?',
					{ modal: true },
				);
				return await findAncestorFile(
					purpose,
					destinationMod,
					modName,
					usePath,
				);
			}
		}
		return ancestorFile;
	}
	return file;
}

export async function findModFile(
	purpose: string,
	destinationMod: ModInfo,
	modinfo: ModInfo,
	usePath?: string,
	isInternal = false,
): Promise<ModFile | undefined> {
	const path = await requestFilePath(purpose, usePath, isInternal);
	if (!path) {
		LOGGER.info('findModFile: No file path provided, aborting...');
		return;
	}
	const file = { ...modinfo, path };
	if (!(await safeStat(resolvePath(file)))?.isFile()) {
		const ancestorName = await queryModinfo(modinfo.modPath, 'Derives From');
		const ancestorFile = await findAncestorFile(
			purpose,
			destinationMod,
			ancestorName,
			path,
			true,
		);
		if (!ancestorFile) {
			if (isInternal) {
				LOGGER.info(
					`findModFile: File "${path}" does not exist in "${modinfo.modName}" or its ancestors, but isInternal is set. Aborting...`,
				);
				return;
			} else {
				LOGGER.info(
					`findModFile: File "${path}" does not exist in "${modinfo.modName}" or its ancestors. Retrying...`,
				);
				await showErrorMessage(
					'The specified file does not exist! Are you sure you specified the right path?',
					{ modal: true },
				);
				return await findModFile(purpose, destinationMod, modinfo, usePath);
			}
		}
		return ancestorFile;
	}
	return file;
}

export function findForCurrentFile<T extends FileFindable>(
	fileFinder: FileFinder<T>,
) {
	return async (
		purpose: string,
		currentMod: ModInfo,
		source: T,
	): Promise<ModFile | undefined> => {
		const path = window.activeTextEditor?.document.fileName;
		if (!path) {
			LOGGER.info(`findforCurrentFile: No files open!`);
			await showErrorMessage(
				"You don't have any files open, what do you expect from an operation against the current file?",
				{ modal: true },
			);
			return;
		}

		const file = await fileFinder(
			purpose,
			currentMod,
			source,
			unresolvePath(currentMod, path),
			true,
		);
		if (!file) {
			LOGGER.info(
				`findCurrentFile: ${fileFinder.name} could not find file ${path}. Aborting...`,
			);
			await showErrorMessage(
				'The current file does not exist in the requested mod or its ancestors. Try a different mod?',
				{ modal: true },
			);
			return;
		}
		return file;
	};
}
