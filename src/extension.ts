import { commands, window, ExtensionContext }  from 'vscode';
import { readdir } from 'node:fs/promises';
import { buildAncestorFileOperation, buildBaseFileOperation, buildModFileOperation } from './targetTypes';
import { cloneFile, diffFile, registerMod, reregisterMod } from './operations';
import { includesAll, updateConfig } from './utils';
import { COMMANDS, CONFIGS, LOGGER } from './types';

const { executeCommand, registerCommand } = commands;
const { showErrorMessage, showOpenDialog } = window;

export function activate(context: ExtensionContext) {	
	const { subscriptions } = context;
	const findBaseFiles = registerCommand(COMMANDS.FIND_BASE_FILES, async () => {
		LOGGER.debug(`findBaseFiles: Command executed...`);
		const uris = await showOpenDialog({ canSelectFolders: true, canSelectFiles: false, title: "Find SR2 Installation", openLabel: "Select Folder", canSelectMany: false });
		if(!uris)
			{
				LOGGER.debug(`findBaseFiles: No folder selected, user must have canceled...`);
				return;
			};
		const { fsPath: gamePath } = uris[0];
		const gameFolder = await readdir(gamePath);
		const isValidInstall = includesAll(gameFolder, "data", "locales", "mods", "scripts", "maps");
		if(isValidInstall) {
			LOGGER.info(`findBaseFiles: SR2 detected, updating config ${CONFIGS.BASE_GAME_FOLDER} to "${gamePath}"...`);
			updateConfig(CONFIGS.BASE_GAME_FOLDER, gamePath);
			return true;
		} else {
			LOGGER.info(`findBaseFiles: Invalid SR2 folder, retrying...`);
			await showErrorMessage(
				`Not a valid SR2 installation! Locate the folder containing the "data", "locales", "mods", "maps" and "scripts" folders!`,
				{modal: true}
			);
			return await executeCommand(COMMANDS.FIND_BASE_FILES);
		}
	});

	const reregisterModCommand = registerCommand(COMMANDS.REREGISTER_MOD, reregisterMod);
	const registerModCommand = registerCommand(COMMANDS.REGISTER_MOD, registerMod);

	const cloneBaseFile = registerCommand(COMMANDS.CLONE_BASE_FILE, buildBaseFileOperation("clone", cloneFile));

	const cloneModFile = registerCommand(COMMANDS.CLONE_MOD_FILE, buildModFileOperation("clone", cloneFile));

	const cloneAncestorFile = registerCommand(COMMANDS.CLONE_ANCESTOR_FILE, buildAncestorFileOperation("clone", cloneFile));

	const compareBaseFile = registerCommand(COMMANDS.COMPARE_BASE_FILE, buildBaseFileOperation("compare", diffFile));

	const compareModFile = registerCommand(COMMANDS.COMPARE_MOD_FILE, buildModFileOperation("compare", diffFile));

	const compareAncestorFile = registerCommand(COMMANDS.COMPARE_ANCESTOR_FILE, buildAncestorFileOperation("compare", diffFile));

	subscriptions.push(findBaseFiles);
	subscriptions.push(reregisterModCommand);
	subscriptions.push(registerModCommand);
	subscriptions.push(cloneBaseFile);
	subscriptions.push(cloneModFile);
	subscriptions.push(cloneAncestorFile);
	subscriptions.push(compareBaseFile);
	subscriptions.push(compareModFile);
	subscriptions.push(compareAncestorFile);
}

export function deactivate() {}
