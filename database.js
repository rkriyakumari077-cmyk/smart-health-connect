// Our database is one JSON file: data/database.json
// Inside it there is one list for each table in our design:
// patients, doctors, appointments, prescriptions, labTests, bloodBank, donors ...
//
// When the server starts we read the file into the "data" object.
// Every time something changes we call save() to write it back to the file.
const fs = require('fs');
const path = require('path');
const createSampleData = require('./seed');

const FOLDER = path.join(__dirname, 'data');
const FILE = path.join(FOLDER, 'database.json');

let data;

if (fs.existsSync(FILE)) {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} else {
  // First run: fill the database with sample data for the demo
  data = createSampleData();
  save();
  console.log('Created a new database with sample data.');
}

function save() {
  fs.mkdirSync(FOLDER, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// Gives the next id for a list, for example 1, 2, 3 ...
function nextId(list) {
  let biggest = 0;
  for (const item of list) {
    if (item.id > biggest) biggest = item.id;
  }
  return biggest + 1;
}

module.exports = { data, save, nextId };
