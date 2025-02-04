import { workspace, commands, window }  from 'vscode';
import { readdir, stat } from 'node:fs/promises';
import { join as joinPath } from 'node:path';

const { getConfiguration, workspaceFolders } = workspace;
const { executeCommand } = commands;
const { showErrorMessage, showInputBox, showQuickPick } = window;
const { keys } = Object;

export type RegisteredModList = {
	[modName: string]: string;
}

export function includesAll<T>(array: Array<T>, ...vals: T[]): boolean {
	return vals.every((val: T) => array.includes(val));
}

export function getConfig(key: string): any {
	return getConfiguration().get(key);
}

export async function updateConfig(key: string, value: any) {
	await getConfiguration().update(key, value, true);
}

export async function findModinfos(currentDirPath: string): Promise<string[]> {
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

export async function getDestinationMod(): Promise<string | undefined> {
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

export async function getGamePath(purpose: string, isInternal?: boolean): Promise<string | null | undefined> {
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

export async function findBaseFile(purpose: string, gamePath?: string | null, usePath?: string, isInternal?: boolean): Promise<string | null | undefined> {
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

export async function pickMod(purpose: string, name?: string): Promise<string | undefined> {
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

export async function findModFile(purpose: string, modPath: string, usePath?: string, isInternal = false): Promise<string | undefined> {
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