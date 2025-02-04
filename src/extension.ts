import { commands, window, ExtensionContext }  from 'vscode';
import { readdir } from 'node:fs/promises';
import { buildBaseFileOperation, buildModFileOperation } from './targetTypes';
import { cloneFile, diffFile } from './operations';
import { includesAll, updateConfig, getConfig, RegisteredModList } from './utils';

const { executeCommand, registerCommand } = commands;
const { showErrorMessage, showInputBox, showOpenDialog } = window;

export function activate(context: ExtensionContext) {	
	const findBaseFiles = registerCommand('opensr-file-cloning.findBaseFiles', async () => {
		const uris = await showOpenDialog({ canSelectFolders: true, canSelectFiles: false, title: "Find SR2 Installation", openLabel: "Select Folder", canSelectMany: false });
		if(!uris)
			{return;};
		const gameUri = uris[0];
		const gameFolder = await readdir(gameUri.fsPath);
		const isValidInstall = includesAll(gameFolder, "data", "locales", "mods", "scripts", "maps");
		if(isValidInstall) {
			updateConfig("opensr-file-cloning.baseGameFolder", gameUri.fsPath);
			return true;
		} else {
			await showErrorMessage(
				`Not a valid SR2 installation! Locate the folder containing the "data", "locales", "mods", "maps" and "scripts" folders!`,
				{modal: true}
			);
			executeCommand("opensr-file-cloning.findBaseFiles");
			return;
		}
	});

	const registerMod = registerCommand('opensr-file-cloning.registerMod', async () => {
		const uris = await showOpenDialog({ canSelectFolders: true, canSelectFiles: false, title: "Find Mod Folder", openLabel: "Select Folder", canSelectMany: false });
		if(!uris)
			{return;}
		const modUri = uris[0];
		const modFolder = await readdir(modUri.fsPath);
		const isValidMod = modFolder.includes("modinfo.txt");
		if(isValidMod) {
			const name = await showInputBox({title: "Input Mod Name", prompt: "Input a name under which to register the mod"});
			if(!name)
				{return;}
			let config = getConfig("opensr-file-cloning.registeredMods") as RegisteredModList;
			if(config) {
				config[name] = modUri.fsPath;
			} else {
				config = {[name]: modUri.fsPath};
			}
			await updateConfig("opensr-file-cloning.registeredMods", config);
			return true;
		} else {
			await showErrorMessage(`Not a valid SR2 mod! Locate a folder containing a "modinfo.txt" file!`, { modal: true });
			executeCommand("opensr-file-cloning.registerMod");
			return;
		}
	});

	const cloneBaseFile = registerCommand("opensr-file-cloning.cloneBaseFile", buildBaseFileOperation("clone", cloneFile));

	const cloneModFile = registerCommand("opensr-file-cloning.cloneModFile", buildModFileOperation("clone", cloneFile));

	const compareBaseFile = registerCommand("opensr-file-cloning.compareBaseFile", buildBaseFileOperation("compare", diffFile));

	const compareModFile = registerCommand("opensr-file-cloning.compareModFile", buildModFileOperation("compare", diffFile));

	context.subscriptions.push(findBaseFiles);
	context.subscriptions.push(registerMod);
	context.subscriptions.push(cloneBaseFile);
	context.subscriptions.push(cloneModFile);
	context.subscriptions.push(compareBaseFile);
	context.subscriptions.push(compareModFile);
}

export function deactivate() {}
