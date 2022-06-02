import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

function includesAll<T>(array: Array<T>, ...vals: T[]): boolean {
	return vals.every((val: T) => array.includes(val));
}

function findModinfos(currentDirPath: string): string[] {
	let results: string[] = [];
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath.toString(), name);
        var stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
            results.push(...findModinfos(filePath));
        } else if(name === "modinfo.txt") {
			results.push(currentDirPath);
		}
    });
	return results;
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
		} else {
			await vscode.window.showErrorMessage(`Not a valid SR2 mod! Locate a folder containing a "modinfo.txt" file!`, { modal: true });
			vscode.commands.executeCommand("opensr-file-cloning.registerMod");
		}
	});

	const cloneBaseFile = vscode.commands.registerCommand("opensr-file-cloning.cloneBaseFile", async (usePath?: string, isInternal?: boolean) => {
		const gamePath = vscode.workspace.getConfiguration().get("opensr-file-cloning.baseGameFolder");
		if(!gamePath && !isInternal) {
			await vscode.window.showErrorMessage("Cannot clone from unknown location! Set your base game path first!", { modal: true });
			vscode.commands.executeCommand("opensr-file-cloning.findBaseFiles");
		} else {
			let path: string | undefined;
			if(!isInternal) {
					path = await vscode.window.showInputBox({
					title: "File Path", 
					prompt: `Input the path to the file to clone, e.g. "data/objects.txt"`,
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
					return false;
				} else {
					await vscode.window.showErrorMessage("The specified file does not exist! Are you sure you specified the right path?", { modal: true });
					vscode.commands.executeCommand("opensr-file-cloning.cloneBaseFile", path);
				}
			} else {
				const modinfoPaths = findModinfos(vscode.workspace.workspaceFolders![0].uri.fsPath);
				let modinfoPath: string | undefined = vscode.workspace.workspaceFolders![0].uri.fsPath;
				if(modinfoPaths.length === 1) {
					modinfoPath = modinfoPaths[0];
				}
				else if(modinfoPaths.length > 1) {
					modinfoPath = await vscode.window.showQuickPick(modinfoPaths, { canPickMany: false, title: "Select Destination Mod" });
					if(!modinfoPath)
						{return true;}
				}
				try {
					fs.copyFileSync(resolvedPath, `${modinfoPath}/${path}`, fs.constants.COPYFILE_EXCL);
				} catch {
					const tryAgain = (await vscode.window.showWarningMessage(
						`The destination file already exists. Overwrite?`,
						{ modal: true },
						"Yes", "No"
					)) === "Yes";
					if(tryAgain) {
						fs.copyFileSync(resolvedPath, `${modinfoPath}/${path}`);
					}
				}
				return true;
			}
		}
	});

	const cloneModFile = vscode.commands.registerCommand("opensr-file-cloning.cloneModFile", async (usePath?: string) => {
		const registeredMods = vscode.workspace.getConfiguration().get("opensr-file-cloning.registeredMods") as object;
		if(!registeredMods) {
			await vscode.window.showErrorMessage("Must have a mod to clone from!", { modal: true });
			vscode.commands.executeCommand("opensr-file-cloning.registerMod");
		} else {
			let mod: string | undefined;
			if(Object.keys(registeredMods).length === 1) {
				mod = Object.keys(registeredMods)[0];
			} else {
				mod = await vscode.window.showQuickPick(Object.keys(registeredMods), { canPickMany: false, title: "Select Source Mod" });
				if(!mod)
					{return;}
			}
			const modPath = registeredMods[mod];

			let path = await vscode.window.showInputBox({
				title: "File Path", 
				prompt: `Input the path to the file to clone, e.g. "data/objects.txt"`,
				value: usePath,
			});
			if(!path)
				{return;}
			if(path.startsWith("/") || path.startsWith("\\"))
				{path = path.substring(1);}
			const resolvedPath = `${modPath}/${path}`;
			if(!fs.existsSync(resolvedPath)) {
				if(!(await vscode.commands.executeCommand("opensr-file-cloning.cloneBaseFile", path, true))) {
					await vscode.window.showErrorMessage("The specified file does not exist! Are you sure you specified the right path?", { modal: true });
					vscode.commands.executeCommand("opensr-file-cloning.cloneModFile", path);
				}
			} else {
				const modinfoPaths = findModinfos(vscode.workspace.workspaceFolders![0].uri.fsPath);
				let modinfoPath: string | undefined = vscode.workspace.workspaceFolders![0].uri.fsPath;
				if(modinfoPaths.length === 1) {
					modinfoPath = modinfoPaths[0];
				}
				else if(modinfoPaths.length > 1) {
					modinfoPath = await vscode.window.showQuickPick(modinfoPaths, { canPickMany: false, title: "Select Destination Mod" });
					if(!modinfoPath)
						{return;}
				}
				try {
					fs.copyFileSync(resolvedPath, `${modinfoPath}/${path}`, fs.constants.COPYFILE_EXCL);
				} catch {
					const tryAgain = (await vscode.window.showWarningMessage(
						`The destination file already exists. Overwrite?`,
						{ modal: true },
						"Yes", "No"
					)) === "Yes";
					if(tryAgain) {
						fs.copyFileSync(resolvedPath, `${modinfoPath}/${path}`);
					}
				}
			}
		}
	});

	context.subscriptions.push(findBaseFiles);
	context.subscriptions.push(registerMod);
	context.subscriptions.push(cloneBaseFile);
	context.subscriptions.push(cloneModFile);
}

export function deactivate() {}
