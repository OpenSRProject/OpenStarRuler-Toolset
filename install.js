const { exec } = require('child_process');
const { readFile } = require('node:fs/promises');

async function main() {
    const { name, version } = JSON.parse(await readFile('package.json'));
    exec(`code --install-extension ${name}-${version}.vsix`, (error, stdout, stderr) => {
        console.log(stdout);
        if(error)
            console.error(stderr);
    });
}

main();
