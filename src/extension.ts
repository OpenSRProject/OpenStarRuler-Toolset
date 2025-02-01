import { workspace, commands, window, Uri, ExtensionContext }  from 'vscode';
import { readdir, stat, copyFile, constants as fsConstants } from 'node:fs/promises';
import { join as joinPath, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';

const { getConfiguration, workspaceFolders } = workspace;
const { executeCommand, registerCommand } = commands;
const { showErrorMessage, showInputBox, showOpenDialog, showWarningMessage, showQuickPick } = window;
const { keys } = Object;

type RegisteredModList = {
	[modName: string]: string;
}

function includesAll<T>(array: Array<T>, ...vals: T[]): boolean {
	return vals.every((val: T) => array.includes(val));
}

function getConfig(key: string): any {
	return getConfiguration().get(key);
}

async function updateConfig(key: string, value: any) {
	await getConfiguration().update(key, value, true);
}

async function findModinfos(currentDirPath: string): Promise<string[]> {
	const results: string[] = [];
    const names = await readdir(currentDirPath)
	await Promise.all(names.map(async function (name) {
        const filePath = joinPath(currentDirPath.toString(), name);
		if ((await stat(filePath)).isDirectory()) {
            results.push(...(await findModinfos(filePath)));
        } else if(name === "modinfo.txt") {
			results.push(currentDirPath);
		}
    }));
	return results;
}

async function getDestinationMod(): Promise<string | undefined> {
	const modinfoPaths = await findModinfos(workspaceFolders![0].uri.fsPath);
	let modinfoPath: string | undefined = workspaceFolders![0].uri.fsPath;
	if(modinfoPaths.length === 1) {
		modinfoPath = modinfoPaths[0];
	}
	else if(modinfoPaths.length > 1) {
		modinfoPath = await showQuickPick(modinfoPaths, { canPickMany: false, title: "Select Destination Mod" });
	}
	return modinfoPath;
}

async function getGamePath(purpose: string, isInternal?: boolean): Promise<string | null | undefined> {
	const gamePath = getConfig("opensr-file-cloning.baseGameFolder") as string;
	if(!gamePath) {
		if(isInternal)
			return null;
		else {
			await showErrorMessage(`Cannot ${purpose} from unknown location! Set your base game path first!`, { modal: true });
			if(await executeCommand("opensr-file-cloning.findBaseFiles"))
				return getGamePath(purpose, isInternal);
			return;
		}
	}
	return gamePath;
}

async function findBaseFile(purpose: string, gamePath?: string | null, usePath?: string, isInternal?: boolean): Promise<string | null | undefined> {
	if(!gamePath)
		return isInternal ? null : undefined;
	let path: string | undefined;
	if(!isInternal) {
			path = await showInputBox({
			title: "File Path", 
			prompt: `Input the path to the file to ${purpose}, e.g. "data/objects.txt"`,
			value: usePath,
		});
	} else {
		path = usePath;
	}
	if(!path)
		{return;}
	if(path.startsWith("/") || path.startsWith("\\"))
		{path = path.substring(1);}
	const resolvedPath = `${gamePath}/${path}`;
	if(!(await stat(resolvedPath)).isFile()) {
		if(isInternal) {
			return null;
		} else {
			await showErrorMessage("The specified file does not exist! Are you sure you specified the right path?", { modal: true });
			return await findBaseFile(purpose, gamePath, usePath, isInternal);
		}
	}
	return path;
}

async function pickMod(purpose: string, name?: string): Promise<string | undefined> {
	const registeredMods = getConfig("opensr-file-cloning.registeredMods") as RegisteredModList;
	if(name)
		return registeredMods ? registeredMods[name] : undefined;
	if(!registeredMods) {
		await showErrorMessage(`Must have a mod to ${purpose} from!`, { modal: true });
		if(await executeCommand("opensr-file-cloning.registerMod"))
			return await pickMod(purpose);
		return;
	}
	
	let mod: string | undefined;
	if(keys(registeredMods).length === 1) {
		mod = keys(registeredMods)[0];
	} else {
		mod = await showQuickPick(keys(registeredMods), { canPickMany: false, title: "Select Source Mod" });
		if(!mod)
			{return;}
	}
	return registeredMods[mod];
}

async function findModFile(purpose: string, modPath: string, usePath?: string, isInternal = false): Promise<string | undefined> {
	let path: string;
	if(!isInternal || usePath == null) {
		path = await showInputBox({
			title: "File Path", 
			prompt: `Input the path to the file to ${purpose}, e.g. "data/objects.txt"`,
			value: usePath,
		}) || '';
		if(!path)
			{return;}
	}
	else path = usePath;
	if(path.startsWith("/") || path.startsWith("\\"))
		{path = path.substring(1);}
	const resolvedPath = `${modPath}/${path}`;
	if(!(await stat(resolvedPath)).isFile()) {
		/* TODO: Finish ancestor resolution.
			TODO #2: Add new operation handler: Ancestor. Performs operations on the current mod's ancestor(s); if no current mod exists, ask the user which mod's ancestors they're interested in.
		let modinfoPath = await getDestinationMod();
		while(modinfoPath) {
			try {
				const modinfo = await readFile(modinfoPath, 'utf8');
			} catch {
				break;
			}
			const requires = modinfo.match(/^[ \t]*Derives From:(.*)$/i)?.[0];
			if(!requires)
				break;
		}*/

		const gamePath = await getGamePath(purpose, true);
		const resolvedGamePath = await findBaseFile(purpose, gamePath, path, true);
		if(!resolvedGamePath) {
			await showErrorMessage("The specified file does not exist! Are you sure you specified the right path?", { modal: true });
			return await findModFile(purpose, modPath, usePath);
		}
		return resolvedGamePath;
	}
	return path;
}

type FileOperation = (pathToSource: string, destination: string) => Promise<void>;

async function cloneFile(pathToSource: string, destination: string) {
	const modinfoPath = await getDestinationMod();
	if(!modinfoPath)
		return;
	try {
		await mkdir(`${modinfoPath}/${dirname(destination)}`, { recursive: true });
		await copyFile(pathToSource, `${modinfoPath}/${destination}`, fsConstants.COPYFILE_EXCL);
	} catch(error: any) {
		if(error.code === 'EEXIST') {
			const tryAgain = (await showWarningMessage(
				`The destination file already exists. Overwrite?`,
				{ modal: true },
				"Yes", "No"
			)) === "Yes";

			if(tryAgain) {
				await copyFile(pathToSource, `${modinfoPath}/${destination}`);
			}
		}
		else {
			await showErrorMessage(`Failed to clone file!\n\nError: ${error.message}`, { modal: true });
		}
	}
}

async function diffFile(pathToSource: string, destination: string) {
	const modinfoPath = await getDestinationMod();
	if(!modinfoPath)
		return;
	if(pathToSource === `${modinfoPath}/${destination}`)
		await showErrorMessage('Cannot compare a file to itself!', { modal: true });

	executeCommand(
		"vscode.diff", 
		Uri.file(pathToSource), 
		Uri.file(`${modinfoPath}/${destination}`),
		destination, 
		{preview: true}
	);
}

function buildBaseFileOperation(purpose: string, operation: FileOperation): () => Promise<void> {
	return async () => {
		const gamePath = await getGamePath(purpose);
		const path = await findBaseFile(purpose, gamePath);
		if(!path)
			return;
		operation(`${gamePath}/${path}`, path);
	}
}

function buildModFileOperation(purpose: string, operation: FileOperation): () => Promise<void> {
	return async () => {
		const mod = await pickMod(purpose);
		if(!mod)
			return;
		const path = await findModFile(purpose, mod);
		if(!path)
			return;
		operation(`${mod}/${path}`, path);
	}
}

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
