const fs = require('fs');
const path = require('path');

const files = [
  'models/leaders/_manifest.json',
  'models/leaders/xi-jinping.json',
  'models/leaders/vladimir-putin.json',
  'models/leaders/us-president.json',
  'models/leaders/eu-chancellor.json',
  'models/leaders/narendra-modi.json',
  'models/leaders/fumio-kishida.json',
  'models/leaders/ali-khamenei.json',
  'models/leaders/kim-jong-un.json',
  'models/leaders/mbti/compatibility-matrix.json'
];

let errors = 0;
files.forEach(f => {
  try {
    JSON.parse(fs.readFileSync(f, 'utf8'));
    console.log('✅ ' + f);
  } catch (e) {
    console.log('❌ ' + f + ': ' + e.message);
    errors++;
  }
});
console.log('\n' + files.length + ' files checked, ' + errors + ' errors');
process.exit(errors);
