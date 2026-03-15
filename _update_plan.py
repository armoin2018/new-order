#!/usr/bin/env python3
"""Mark completed plan items as DONE in PLAN.json."""
import json

with open('.project/PLAN.json') as f:
    plan = json.load(f)

# Epics and their story IDs to mark DONE
COMPLETED_EPICS = {
    'CNFL-0033': 'Turn Duration Engine',
    'CNFL-0034': 'Currency Exchange Engine',
    'CNFL-0035': 'Turn Budget Engine',
    'CNFL-0036': 'Dimension Prompt Engine',
    'CNFL-0037': 'Enhanced AI Config Engine',
    'CNFL-0038': 'Simulation Persistence Engine',
    'CNFL-0039': 'Web State Gathering Engine',
    'CNFL-0040': 'Queue-Based Scenario Runner',
    'CNFL-0041': 'Elections & Leadership Transitions',
    'CNFL-0042': 'Scenario Lifecycle Management',
    'CNFL-0043': 'Dynamic Rankings Engine',
    'CNFL-0044': 'Expanded Nation Roster',
}

updated = 0
for item in plan['items']:
    # Check if item's epic or item itself should be marked done
    item_id = item.get('id', '')
    parent_id = item.get('epicId', '')
    
    if item_id in COMPLETED_EPICS or parent_id in COMPLETED_EPICS:
        if item.get('status') != 'DONE':
            item['status'] = 'DONE'
            updated += 1

# Count stats
done = sum(1 for i in plan['items'] if i.get('status') == 'DONE')
todo = sum(1 for i in plan['items'] if i.get('status') == 'TODO')
total = len(plan['items'])

print(f"Updated {updated} items to DONE")
print(f"Total: {total}, DONE: {done}, TODO: {todo}")

with open('.project/PLAN.json', 'w') as f:
    json.dump(plan, f, indent=2)
    f.write('\n')

print("PLAN.json updated successfully!")
