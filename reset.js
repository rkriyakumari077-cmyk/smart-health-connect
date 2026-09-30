// Run "npm run reset" to delete the database.
// The next "npm start" creates it again with fresh sample data.
const fs = require('fs');
fs.rmSync(__dirname + '/data', { recursive: true, force: true });
console.log('Database deleted. Run "npm start" to create fresh sample data.');
