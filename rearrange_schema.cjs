const fs = require('fs');

let schema = fs.readFileSync('schema.sql', 'utf8');

// Find the branches table creation block
const branchRegex = /-- 4\.5 Branches Table \(Multi-Location Support\)[\s\S]*?\) ENGINE=InnoDB;/;
const branchMatch = schema.match(branchRegex);

if (branchMatch) {
    const branchBlock = branchMatch[0];
    // Remove it from its current location
    schema = schema.replace(branchBlock, '');
    
    // Find the Admins table
    const adminsRegex = /-- 2\. Admins Table/;
    
    // Insert branches before admins, and rename branches to 1.5
    const newBranchBlock = branchBlock.replace('-- 4.5', '-- 1.5');
    schema = schema.replace(adminsRegex, newBranchBlock + '\n\n-- 2. Admins Table');
    
    fs.writeFileSync('schema.sql', schema);
    console.log('Schema rearranged to put branches before admins.');
} else {
    console.log('Could not find branches table in schema.sql');
}
