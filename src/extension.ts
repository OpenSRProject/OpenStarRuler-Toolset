import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as paths from 'node:path';

function includesAll<T>(array: Array<T>, ...vals: T[]): boolean {
	return vals.every((val: T) => array.includes(val));
}

function findModinfos(currentDirPath: string): string[] {
	let results: string[] = [];
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = paths.join(currentDirPath.toString(), name);
        var stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
            results.push(...findModinfos(filePath));
        } else if(name === "modinfo.txt") {
			results.push(currentDirPath);
		}
    });
	return results;
}

async function getDestinationMod(): Promise<string | undefined> {
	const modinfoPaths = findModinfos(vscode.workspace.workspaceFolders![0].uri.fsPath);
	let modinfoPath: string | undefined = vscode.workspace.workspaceFolders![0].uri.fsPath;
	if(modinfoPaths.length === 1) {
		modinfoPath = modinfoPaths[0];
	}
	else if(modinfoPaths.length > 1) {
		modinfoPath = await vscode.window.showQuickPick(modinfoPaths, { canPickMany: false, title: "Select Destination Mod" });
	}
	return modinfoPath;
}

async function getGamePath(purpose: string, isInternal?: boolean): Promise<string | null | undefined> {
	const gamePath = vscode.workspace.getConfiguration().get("opensr-file-cloning.baseGameFolder") as string;
	if(!gamePath) {
		if(isInternal)
			return null;
		else {
			await vscode.window.showErrorMessage(`Cannot ${purpose} from unknown location! Set your base game path first!`, { modal: true });
			if(await vscode.commands.executeCommand("opensr-file-cloning.findBaseFiles"))
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
			path = await vscode.window.showInputBox({
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
	if(!fs.existsSync(resolvedPath)) {
		if(isInternal) {
			return null;
		} else {
			await vscode.window.showErrorMessage("The specified file does not exist! Are you sure you specified the right path?", { modal: true });
			return await findBaseFile(purpose, gamePath, usePath, isInternal);
		}
	}
	return path;
}

async function pickMod(purpose: string): Promise<string | undefined> {
	const registeredMods = vscode.workspace.getConfiguration().get("opensr-file-cloning.registeredMods") as object;
	if(!registeredMods) {
		await vscode.window.showErrorMessage(`Must have a mod to ${purpose} from!`, { modal: true });
		if(await vscode.commands.executeCommand("opensr-file-cloning.registerMod"))
			return await pickMod(purpose);
		return;
	}
	
	let mod: string | undefined;
	if(Object.keys(registeredMods).length === 1) {
		mod = Object.keys(registeredMods)[0];
	} else {
		mod = await vscode.window.showQuickPick(Object.keys(registeredMods), { canPickMany: false, title: "Select Source Mod" });
		if(!mod)
			{return;}
	}
	return registeredMods[mod];
}

async function findModFile(purpose: string, modPath: string, usePath?: string): Promise<string | undefined> {
	let path = await vscode.window.showInputBox({
		title: "File Path", 
		prompt: `Input the path to the file to ${purpose}, e.g. "data/objects.txt"`,
		value: usePath,
	});
	if(!path)
		{return;}
	if(path.startsWith("/") || path.startsWith("\\"))
		{path = path.substring(1);}
	const resolvedPath = `${modPath}/${path}`;
	if(!fs.existsSync(resolvedPath)) {
		const gamePath = await getGamePath(purpose, true);
		const resolvedGamePath = await findBaseFile(purpose, gamePath, path, true);
		if(!resolvedGamePath) {
			await vscode.window.showErrorMessage("The specified file does not exist! Are you sure you specified the right path?", { modal: true });
			return await findModFile(purpose, modPath, usePath);
		}
		return resolvedGamePath;
	}
	return path;
}

type FileOperation = (pathToSource: string, destination: string) => Promise<void>;

async function cloneFile(pathToSource: string, destination: string) {
	const modinfoPath = getDestinationMod();
	if(!modinfoPath)
		return;
	try {
		fs.copyFileSync(pathToSource, `${modinfoPath}/${destination}`, fs.constants.COPYFILE_EXCL);
	} catch {
		const tryAgain = (await vscode.window.showWarningMessage(
			`The destination file already exists. Overwrite?`,
			{ modal: true },
			"Yes", "No"
		)) === "Yes";
		if(tryAgain) {
			fs.copyFileSync(pathToSource, `${modinfoPath}/${destination}`);
		}
	}
}

async function diffFile(pathToSource: string, destination: string) {
	const modinfoPath = await getDestinationMod();
	if(!modinfoPath)
		return;
	vscode.commands.executeCommand(
		"vscode.diff", 
		vscode.Uri.file(pathToSource), 
		vscode.Uri.file(`${modinfoPath}/${destination}`),
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

export function activate(context: vscode.ExtensionContext) {	
	const findBaseFiles = vscode.commands.registerCommand('opensr-file-cloning.findBaseFiles', async () => {
		const uris = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, title: "Find SR2 Installation", openLabel: "Select Folder", canSelectMany: false });
		if(!uris)
			{return;};
		const gameUri = uris[0];
		const gameFolder = fs.readdirSync(gameUri.fsPath);
		const isValidInstall = includesAll(gameFolder, "data", "locales", "mods", "scripts", "maps");
		if(isValidInstall) {
			await vscode.workspace.getConfiguration().update("opensr-file-cloning.baseGameFolder", gameUri.fsPath, true);
			return true;
		} else {
			await vscode.window.showErrorMessage(
				`Not a valid SR2 installation! Locate the folder containing the "data", "locales", "mods", "maps" and "scripts" folders!`,
				{modal: true}
			);
			vscode.commands.executeCommand("opensr-file-cloning.findBaseFiles");
		}
	});

	const registerMod = vscode.commands.registerCommand('opensr-file-cloning.registerMod', async () => {
		const uris = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, title: "Find Mod Folder", openLabel: "Select Folder", canSelectMany: false });
		if(!uris)
			{return;}
		const modUri = uris[0];
		const modFolder = fs.readdirSync(modUri.fsPath);
		const isValidMod = modFolder.includes("modinfo.txt");
		if(isValidMod) {
			const name = await vscode.window.showInputBox({title: "Input Mod Name", prompt: "Input a name under which to register the mod"});
			if(!name)
				{return;}
			let config = vscode.workspace.getConfiguration().get("opensr-file-cloning.registeredMods");
			if(typeof config === "object" && config !== null) {
				config[name] = modUri.fsPath;
			} else {
				config = {[name]: modUri.fsPath};
			}
			await vscode.workspace.getConfiguration().update("opensr-file-cloning.registeredMods", config, true);
			return true;
		} else {
			await vscode.window.showErrorMessage(`Not a valid SR2 mod! Locate a folder containing a "modinfo.txt" file!`, { modal: true });
			vscode.commands.executeCommand("opensr-file-cloning.registerMod");
		}
	});

	const cloneBaseFile = vscode.commands.registerCommand("opensr-file-cloning.cloneBaseFile", buildBaseFileOperation("clone", cloneFile));

	const cloneModFile = vscode.commands.registerCommand("opensr-file-cloning.cloneModFile", buildModFileOperation("clone", cloneFile));

	const compareBaseFile = vscode.commands.registerCommand("opensr-file-cloning.compareBaseFile", buildBaseFileOperation("compare", diffFile));

	const compareModFile = vscode.commands.registerCommand("opensr-file-cloning.compareModFile", buildModFileOperation("compare", diffFile));

	context.subscriptions.push(findBaseFiles);
	context.subscriptions.push(registerMod);
	context.subscriptions.push(cloneBaseFile);
	context.subscriptions.push(cloneModFile);
	context.subscriptions.push(compareBaseFile);
	context.subscriptions.push(compareModFile);
}

export function deactivate() {}
