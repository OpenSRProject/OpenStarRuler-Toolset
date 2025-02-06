import { FileOperation, LOGGER } from './types';
import { getGamePath, findBaseFile, pickMod, findModFile, getDestinationMod, findAncestorFile, queryModinfo } from './utils';

export function buildBaseFileOperation(purpose: string, operation: FileOperation): () => Promise<void> {
    return async () => {
        const modinfo = await getDestinationMod();
        if(!modinfo) {
            LOGGER.info("baseFileOperation: No destination mod selected, aborting...")
            return;
        }
        const gamePath = await getGamePath(purpose);
        const file = await findBaseFile(purpose, gamePath);
        if(!file) {
            LOGGER.info("baseFileOperation: Source file not found, aborting...")
            return;
        }
        operation(file, { ...modinfo, path: file.path });
    }
}

export function buildAncestorFileOperation(purpose: string, operation: FileOperation): () => Promise<void> {
    return async () => {
        const modinfo = await getDestinationMod();
        if(!modinfo){
            LOGGER.info("ancestorFileOperation: No destination mod selected, aborting...")
            return;
        }
        const file = await findAncestorFile(purpose, await queryModinfo(modinfo.modPath, "Derives From"));
        if(!file) {
            LOGGER.info("ancestorFileOperation: Source file not found, aborting...")
            return;
        }
        operation(file, { ...modinfo, path: file.path });
    }
}

export function buildModFileOperation(purpose: string, operation: FileOperation): () => Promise<void> {
    return async () => {
        const destinationMod = await getDestinationMod();
        if(!destinationMod){
            LOGGER.info("modFileOperation: No destination mod selected, aborting...")
            return;
        }
        const sourceMod = await pickMod(purpose);
        if(!sourceMod) {
            LOGGER.info("modFileOperation: No source mod selected, aborting...");
            return;
        }
        const file = await findModFile(purpose, sourceMod);
        if(!file) {
            LOGGER.info("modFileOperation: Source file not found, aborting...")
            return;
        }
        operation(file, { ...destinationMod, path: file.path });
    }
}