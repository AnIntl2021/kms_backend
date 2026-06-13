import db from './src/config/db';
async function run() {
    try {
        await db.query('ALTER TABLE employees ADD COLUMN basic_salary DECIMAL(10,3) DEFAULT 0.000, ADD COLUMN housing_allowance DECIMAL(10,3) DEFAULT 0.000, ADD COLUMN transportation_allowance DECIMAL(10,3) DEFAULT 0.000, ADD COLUMN other_allowances DECIMAL(10,3) DEFAULT 0.000');
        console.log('Columns added');
    }
    catch (e) {
        console.log('Error or already exists:', e.message);
    }
    process.exit();
}
run();
