import { constants as fsConstants, copyFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { commands, Uri, window } from 'vscode';

import {
	COMMANDS,
	CONFIGS,
	LOGGER,
	ModFile,
	ModInfo,
	resolvePath,
} from './types';
import {
	getConfig,
	pickMod,
	queryModinfo,
	RegisteredModList,
	updateConfig,
} from './utils';

const { executeCommand } = commands;
const { showErrorMessage, showWarningMessage, showOpenDialog } = window;
const { keys } = Object;

export async function cloneFile(
	source: ModFile,
	destination: ModFile,
	overwrite = false,
) {
	try {
		LOGGER.debug(
			`cloneFile: Copying from "${resolvePath(source)}" to "${resolvePath(
				destination,
			)}"...`,
		);
		await mkdir(`${destination.modPath}/${dirname(destination.path)}`, {
			recursive: true,
		});
		await copyFile(
			resolvePath(source),
			resolvePath(destination),
			overwrite ? 0 : fsConstants.COPYFILE_EXCL,
		);
	} catch (error: any) {
		if (error.code === 'EEXIST') {
			LOGGER.info(
				`cloneFile: File "${destination.path}" already exists in mod filesystem at "${destination.modPath}". Prompting user to overwrite...`,
			);
			const tryAgain =
				(await showWarningMessage(
					`The destination file already exists. Overwrite?`,
					{ modal: true },
					'Yes',
					'No',
				)) === 'Yes';

			if (tryAgain) {
				LOGGER.debug(`cloneFile: Retrying clone in overwrite mode...`);
				await cloneFile(source, destination, true);
			}
		} else {
			LOGGER.error(
				`cloneFile: Encountered unexpected error while copying file`,
				error,
			);
			await showErrorMessage(
				`Failed to clone file!\n\nError: ${error.message}`,
				{ modal: true },
			);
		}
	}
}

export async function diffFile(source: ModFile, destination: ModFile) {
	if (resolvePath(source) === resolvePath(destination)) {
		// Flag this as an error for extra attention: I can't imagine how this would happen.
		LOGGER.error(
			`diffFile: User somehow triggered self-diff on "${resolvePath(
				source,
			)}", aborting diff...`,
		);
		await showErrorMessage('Cannot compare a file to itself!', {
			modal: true,
		});
	}

	executeCommand(
		'vscode.diff',
		Uri.file(resolvePath(source)),
		Uri.file(resolvePath(destination)),
		`${destination.path}: ${source.modName} ↔ ${destination.modName}`,
		{ preview: true },
	);
}

export async function reregisterMod() {
	LOGGER.debug(`reregisterMod: Command executed...`);
	const modinfo = await pickMod('reregister');
	if (!modinfo) {
		LOGGER.debug(`reregisterMod: No mod selected, user must have canceled...`);
		return;
	}
	return await registerModImpl(modinfo);
}

export async function registerMod() {
	LOGGER.debug('registerMod: Command executed...');
	await registerModImpl();
}

async function registerModImpl(modinfo?: ModInfo) {
	// Are we registering or reregistering?
	const isFirstTime = !modinfo;
	let config = getConfig(CONFIGS.REGISTERED_MODS) as RegisteredModList;
	let modPath;

	if (isFirstTime) {
		LOGGER.debug('registerMod: Prompting user for mod folder location...');
		const uris = await showOpenDialog({
			canSelectFolders: true,
			canSelectFiles: false,
			title: 'Find Mod Folder',
			openLabel: 'Select Folder',
			canSelectMany: false,
		});
		if (!uris) {
			LOGGER.debug(
				'registerMod: No folder selected, user must have canceled...',
			);
			return;
		}
		modPath = uris[0].fsPath;
	} else {
		LOGGER.debug(
			`reregisterMod: Mod "${modinfo.modName}" is located at "${modinfo.modPath}"`,
		);
		modPath = modinfo.modPath;
	}

	const name = await queryModinfo(modPath, 'Name');
	if (name) {
		if (config) {
			config[name] = modPath;
			if (!isFirstTime) {
				if (name != modinfo.modName) {
					LOGGER.info(
						`reregisterMod: Deleting old mod entry for ${modinfo.modName}...`,
					);
					config = keys(config)
						.filter((modName) => modName != modinfo.modName)
						.reduce((newConfig, modName) => {
							newConfig[modName] = config[modName];
							return newConfig;
						}, {} as RegisteredModList);
				} else {
					LOGGER.info(
						`reregisterMod: ${modinfo.modName} still has the same name, no change is needed...`,
					);
					return;
				}
			}
		} else {
			config = { [name]: modPath };
		}
		LOGGER.info(
			`${isFirstTime ? '' : 're'}registerMod: Updating config ${
				CONFIGS.REGISTERED_MODS
			}[${name}] to "${modPath}"...`,
		);
		await updateConfig(CONFIGS.REGISTERED_MODS, config);
		return true;
	} else if (isFirstTime) {
		LOGGER.info(
			`registerMod: Invalid or missing modinfo at ${modPath}, retrying...`,
		);
		await showErrorMessage(
			`Not a valid SR2 mod! Locate a folder containing a "modinfo.txt" file!`,
			{ modal: true },
		);
		executeCommand(COMMANDS.REGISTER_MOD);
		return;
	} else {
		LOGGER.error(
			`reregisterMod: Invalid or missing modinfo for ${modinfo.modName}!`,
		);
		await showErrorMessage(
			`Mod ${modinfo.modName} no longer exists! It may have been moved or deleted.`,
			{ modal: true },
		);
		return;
	}
}
