import { commands, window, Uri }  from 'vscode';
import { copyFile, constants as fsConstants } from 'node:fs/promises';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { getDestinationMod } from './utils';

const { executeCommand } = commands;
const { showErrorMessage, showWarningMessage } = window;

export type FileOperation = (pathToSource: string, destination: string) => Promise<void>;

export async function cloneFile(pathToSource: string, destination: string) {
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

export async function diffFile(pathToSource: string, destination: string) {
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