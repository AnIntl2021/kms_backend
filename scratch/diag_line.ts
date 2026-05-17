import fs from 'fs';

const content = fs.readFileSync('c:/xampp/htdocs/fresh_n_fast_frontend/src/pages/MenuPage.tsx', 'utf8');
const lines = content.split(/\r?\n/);
const line514 = lines[513]; // 0-indexed

console.log('Line 514 content:');
console.log(JSON.stringify(line514));
console.log('Length:', line514.length);
