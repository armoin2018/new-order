import fs from 'fs';
import path from 'path';

const schema = JSON.parse(fs.readFileSync('src/data/schemas/technology.schema.json', 'utf8'));
const required = schema.required;
const domainEnum = schema.properties.domain.enum;
const impactEnum = schema.properties.impactLevel.enum;
const exportEnum = schema.properties.knowledgeTransfer.properties.exportRestrictionLevel.enum;

const dir = 'models/technology';
const files = fs.readdirSync(dir).filter(f => f !== '_manifest.json' && f.endsWith('.json'));
let errors = 0;

files.forEach(f => {
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const issues = [];

  required.forEach(r => { if (!(r in data)) issues.push('missing: ' + r); });

  const expected = f.replace('.json', '');
  if (data.techId !== expected) issues.push('techId mismatch: ' + data.techId + ' vs ' + expected);

  if (!domainEnum.includes(data.domain)) issues.push('bad domain: ' + data.domain);
  if (!impactEnum.includes(data.impactLevel)) issues.push('bad impactLevel: ' + data.impactLevel);
  if (data.knowledgeTransfer && data.knowledgeTransfer.exportRestrictionLevel &&
      !exportEnum.includes(data.knowledgeTransfer.exportRestrictionLevel))
    issues.push('bad exportRestrictionLevel');

  if (data.tier && (data.tier < 1 || data.tier > 5)) issues.push('tier out of range');
  if (data.researchDurationTurns > 48) issues.push('duration > 48');

  // Check secondaryDomains
  if (data.secondaryDomains) {
    data.secondaryDomains.forEach(d => {
      if (!domainEnum.includes(d)) issues.push('bad secondaryDomain: ' + d);
    });
  }

  // Check prerequisites reference valid techIds
  if (data.prerequisites) {
    data.prerequisites.forEach(p => {
      if (!p.techId) issues.push('prereq missing techId');
    });
  }

  if (issues.length) { console.log('❌ ' + f + ': ' + issues.join(', ')); errors++; }
  else console.log('✅ ' + f);
});

console.log('\n' + files.length + ' files checked, ' + errors + ' with errors');

// Verify manifest
const manifest = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8'));
console.log('\nManifest lists ' + manifest.files.length + ' files, found ' + files.length + ' on disk');
const missing = manifest.files.filter(f => !files.includes(f));
const extra = files.filter(f => !manifest.files.includes(f));
if (missing.length) console.log('❌ Missing from disk: ' + missing.join(', '));
if (extra.length) console.log('❌ Not in manifest: ' + extra.join(', '));
if (!missing.length && !extra.length) console.log('✅ Manifest matches disk');
