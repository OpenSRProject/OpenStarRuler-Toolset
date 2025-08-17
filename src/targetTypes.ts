import { FileOperation, LOGGER } from './types';
import {
	findAncestorFile,
	findBaseFile,
	findForCurrentFile,
	findModFile,
	getDestinationMod,
	getGamePath,
	pickMod,
	queryModinfo,
} from './utils';

export function buildBaseFileOperation(
	purpose: string,
	operation: FileOperation,
	forCurrent = false,
): () => Promise<void> {
	const fileFinder = forCurrent
		? findForCurrentFile(findBaseFile)
		: findBaseFile;
	return async () => {
		const modinfo = await getDestinationMod(forCurrent);
		if (!modinfo) {
			LOGGER.info(
				'baseFileOperation: No destination mod selected, aborting...',
			);
			return;
		}
		const gamePath = await getGamePath(purpose);
		const file = await fileFinder(purpose, modinfo, gamePath);
		if (!file) {
			LOGGER.info('baseFileOperation: Source file not found, aborting...');
			return;
		}
		operation(file, { ...modinfo, path: file.path });
	};
}

export function buildAncestorFileOperation(
	purpose: string,
	operation: FileOperation,
	forCurrent = false,
): () => Promise<void> {
	const fileFinder = forCurrent
		? findForCurrentFile(findAncestorFile)
		: findAncestorFile;
	return async () => {
		const modinfo = await getDestinationMod(forCurrent);
		if (!modinfo) {
			LOGGER.info(
				'ancestorFileOperation: No destination mod selected, aborting...',
			);
			return;
		}
		const file = await fileFinder(
			purpose,
			modinfo,
			await queryModinfo(modinfo.modPath, 'Derives From'),
		);
		if (!file) {
			LOGGER.info('ancestorFileOperation: Source file not found, aborting...');
			return;
		}
		operation(file, { ...modinfo, path: file.path });
	};
}

export function buildModFileOperation(
	purpose: string,
	operation: FileOperation,
	forCurrent = false,
): () => Promise<void> {
	const fileFinder = forCurrent ? findForCurrentFile(findModFile) : findModFile;
	return async () => {
		const destinationMod = await getDestinationMod(forCurrent);
		if (!destinationMod) {
			LOGGER.info('modFileOperation: No destination mod selected, aborting...');
			return;
		}
		const sourceMod = await pickMod(purpose);
		if (!sourceMod) {
			LOGGER.info('modFileOperation: No source mod selected, aborting...');
			return;
		}
		const file = await fileFinder(purpose, destinationMod, sourceMod);
		if (!file) {
			LOGGER.info('modFileOperation: Source file not found, aborting...');
			return;
		}
		operation(file, { ...destinationMod, path: file.path });
	};
}
