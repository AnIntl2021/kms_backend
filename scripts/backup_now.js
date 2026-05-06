
import { runBackup } from '../src/utils/backup.js';

async function main() {
    console.log('--- Manual Backup Trigger ---');
    const result = await runBackup();
    if (result.success) {
        console.log('Done!');
        process.exit(0);
    } else {
        process.exit(1);
    }
}

main();
