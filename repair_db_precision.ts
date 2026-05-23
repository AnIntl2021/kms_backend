import pool from './src/config/db';

async function repair() {
    try {
        console.log('Starting DB repair...');
        
        // 1. Increase precision of multiplier
        await pool.execute(`
            ALTER TABLE inventory_item_packages 
            MODIFY COLUMN multiplier DECIMAL(18,8) DEFAULT 1.00000000
        `);
        console.log('Updated multiplier precision to DECIMAL(18,8)');

        // 2. Add parent_name column if it doesn't exist
        const [columns]: any = await pool.execute(`
            SHOW COLUMNS FROM inventory_item_packages LIKE 'parent_name'
        `);
        
        if (columns.length === 0) {
            await pool.execute(`
                ALTER TABLE inventory_item_packages 
                ADD COLUMN parent_name VARCHAR(255) DEFAULT NULL AFTER multiplier
            `);
            console.log('Added parent_name column');
        } else {
            console.log('parent_name column already exists');
        }

        console.log('DB repair completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('DB repair failed:', error);
        process.exit(1);
    }
}

repair();
