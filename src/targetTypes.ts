import { FileOperation } from './operations';
import { getGamePath, findBaseFile, pickMod, findModFile } from './utils';

export function buildBaseFileOperation(purpose: string, operation: FileOperation): () => Promise<void> {
    return async () => {
        const gamePath = await getGamePath(purpose);
        const path = await findBaseFile(purpose, gamePath);
        if(!path)
            return;
        operation(`${gamePath}/${path}`, path);
    }
}

export function buildModFileOperation(purpose: string, operation: FileOperation): () => Promise<void> {
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