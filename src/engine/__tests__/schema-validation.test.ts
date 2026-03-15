/**
 * Schema Validation Tests — CNFL-2901
 *
 * Validates all 8 JSON schemas against real model files to ensure
 * schema correctness and model compliance.
 */

import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Schema imports
import mbtiSchema from '@/data/schemas/mbti-type.schema.json';
import politicalSystemSchema from '@/data/schemas/political-system.schema.json';
import militaryEquipmentSchema from '@/data/schemas/military-equipment.schema.json';
import technologySchema from '@/data/schemas/technology.schema.json';
import educationSchema from '@/data/schemas/education-type.schema.json';
import populationSchema from '@/data/schemas/population.schema.json';
import religionSchema from '@/data/schemas/religion.schema.json';
import leaderProfileSchema from '@/data/schemas/leader-profile.schema.json';

const ajv = new Ajv2020({ allErrors: true, verbose: true });

/** Root path for model files. */
const MODELS_ROOT = resolve(__dirname, '..', '..', '..', 'models');

/** Helper: read and parse a JSON model file. */
function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/** Helper: list JSON files in a directory (excluding _manifest.json and other special files). */
function listModelFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json') && !f.startsWith('_') && !f.includes('compatibility'));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// MBTI Type Schema (DR-141)
// ---------------------------------------------------------------------------

describe('MBTI Type Schema Validation', () => {
  const validate = ajv.compile(mbtiSchema);
  const mbtiDir = join(MODELS_ROOT, 'leaders', 'mbti');
  const files = listModelFiles(mbtiDir);

  it('has at least 16 MBTI type model files', () => {
    expect(files.length).toBeGreaterThanOrEqual(16);
  });

  it.each(files)('validates %s against schema', (file) => {
    const data = loadJson(join(mbtiDir, file));
    const valid = validate(data);
    if (!valid) {
      const errors = (validate.errors ?? []).map(
        (e) => `${e.instancePath}: ${e.message}`,
      );
      expect.fail(`${file} failed validation:\n${errors.join('\n')}`);
    }
    expect(valid).toBe(true);
  });

  it('rejects model with invalid typeCode', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      typeCode: 'XXXX',
      typeName: 'Invalid',
      cognitiveStack: ['Te', 'Ni', 'Se', 'Fi'],
      strengthDomains: ['test'],
      blindSpots: ['test'],
      stressPattern: 'grip',
      decisionSpeed: 0,
      adaptability: 50,
      leadershipStyle: 'commanding',
      diplomaticApproach: 'transactional',
      conflictResponse: 'dominate',
    };
    expect(validate(invalid)).toBe(false);
  });

  it('rejects model with missing required field', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      typeCode: 'INTJ',
      // missing typeName, cognitiveStack, etc.
    };
    expect(validate(invalid)).toBe(false);
  });

  it('rejects model with out-of-range decisionSpeed', () => {
    const data = loadJson(join(mbtiDir, files[0]!));
    (data as Record<string, unknown>)['decisionSpeed'] = 999;
    expect(validate(data)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Political System Schema (DR-144)
// ---------------------------------------------------------------------------

describe('Political System Schema Validation', () => {
  const validate = ajv.compile(politicalSystemSchema);
  const dir = join(MODELS_ROOT, 'political-systems');
  const files = listModelFiles(dir);

  it('has at least 10 political system model files', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it.each(files)('validates %s against schema', (file) => {
    const data = loadJson(join(dir, file));
    const valid = validate(data);
    if (!valid) {
      const errors = (validate.errors ?? []).map(
        (e) => `${e.instancePath}: ${e.message}`,
      );
      expect.fail(`${file} failed validation:\n${errors.join('\n')}`);
    }
    expect(valid).toBe(true);
  });

  it('rejects model with civilLibertyIndex > 100', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      systemId: 'test',
      systemName: 'Test',
      description: 'Test system',
      decisionSpeedModifier: 0,
      stabilityBaseline: 0,
      civilLibertyIndex: 150,
      pressFreedomIndex: 50,
      corruptionBaseline: 50,
      successionRisk: 50,
      reformCapacity: 50,
    };
    expect(validate(invalid)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Military Equipment Schema (DR-145)
// ---------------------------------------------------------------------------

describe('Military Equipment Schema Validation', () => {
  const validate = ajv.compile(militaryEquipmentSchema);
  const categories = ['air', 'sea', 'ground', 'spy-covert', 'drone', 'domestic', 'cyber-offense', 'cyber-defense'];

  for (const category of categories) {
    const dir = join(MODELS_ROOT, 'military', category);
    const files = listModelFiles(dir);

    describe(`${category} category`, () => {
      it(`has at least 1 model file`, () => {
        expect(files.length).toBeGreaterThanOrEqual(1);
      });

      it.each(files)(`validates %s against schema`, (file) => {
        const data = loadJson(join(dir, file));
        const valid = validate(data);
        if (!valid) {
          const errors = (validate.errors ?? []).map(
            (e) => `${e.instancePath}: ${e.message}`,
          );
          expect.fail(`${category}/${file} failed validation:\n${errors.join('\n')}`);
        }
        expect(valid).toBe(true);
      });
    });
  }

  it('rejects equipment with purchaseCost < 1', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      equipmentId: 'test',
      name: 'Test Equipment',
      category: 'air',
      description: 'Test equipment description.',
      purchaseCost: 0,
      maintenanceCostPerTurn: 5,
      attackPower: 50,
      defensePower: 50,
      buildTime: 5,
    };
    expect(validate(invalid)).toBe(false);
  });

  it('rejects equipment with invalid category', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      equipmentId: 'test',
      name: 'Test',
      category: 'invalid-category',
      description: 'Test equipment description.',
      purchaseCost: 100,
      maintenanceCostPerTurn: 5,
      attackPower: 50,
      defensePower: 50,
      buildTime: 5,
    };
    expect(validate(invalid)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Technology Schema (DR-148)
// ---------------------------------------------------------------------------

describe('Technology Schema Validation', () => {
  const validate = ajv.compile(technologySchema);
  const dir = join(MODELS_ROOT, 'technology');
  const files = listModelFiles(dir);

  it('has at least 25 technology model files', () => {
    expect(files.length).toBeGreaterThanOrEqual(25);
  });

  it.each(files)('validates %s against schema', (file) => {
    const data = loadJson(join(dir, file));
    const valid = validate(data);
    if (!valid) {
      const errors = (validate.errors ?? []).map(
        (e) => `${e.instancePath}: ${e.message}`,
      );
      expect.fail(`${file} failed validation:\n${errors.join('\n')}`);
    }
    expect(valid).toBe(true);
  });

  it('rejects technology with invalid domain', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      techId: 'test',
      name: 'Test Tech',
      domain: 'nonexistent',
      description: 'Test technology description.',
      researchCost: 100,
      researchDurationTurns: 8,
      impactLevel: 'significant',
    };
    expect(validate(invalid)).toBe(false);
  });

  it('rejects technology with invalid impactLevel', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      techId: 'test',
      name: 'Test Tech',
      domain: 'ai',
      description: 'Test technology description.',
      researchCost: 100,
      researchDurationTurns: 8,
      impactLevel: 'game-breaking',
    };
    expect(validate(invalid)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Education Type Schema (DR-157)
// ---------------------------------------------------------------------------

describe('Education Type Schema Validation', () => {
  const validate = ajv.compile(educationSchema);
  const dir = join(MODELS_ROOT, 'education');
  const files = listModelFiles(dir);

  it('has at least 8 education model files', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files)('validates %s against schema', (file) => {
    const data = loadJson(join(dir, file));
    const valid = validate(data);
    if (!valid) {
      const errors = (validate.errors ?? []).map(
        (e) => `${e.instancePath}: ${e.message}`,
      );
      expect.fail(`${file} failed validation:\n${errors.join('\n')}`);
    }
    expect(valid).toBe(true);
  });

  it('rejects education with invalid category', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      educationId: 'test',
      name: 'Test',
      category: 'invalid',
      description: 'Test education description.',
      annualCostPerCapita: 100,
      implementationTurns: 4,
    };
    expect(validate(invalid)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Population Schema (DR-159)
// ---------------------------------------------------------------------------

describe('Population Schema Validation', () => {
  const validate = ajv.compile(populationSchema);
  const dir = join(MODELS_ROOT, 'population');
  const files = listModelFiles(dir);

  it('has at least 8 population model files', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files)('validates %s against schema', (file) => {
    const data = loadJson(join(dir, file));
    const valid = validate(data);
    if (!valid) {
      const errors = (validate.errors ?? []).map(
        (e) => `${e.instancePath}: ${e.message}`,
      );
      expect.fail(`${file} failed validation:\n${errors.join('\n')}`);
    }
    expect(valid).toBe(true);
  });

  it('rejects population with negative populationMillions', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      nationId: 'test',
      populationMillions: -5,
      growthRatePercent: 1.0,
      urbanizationPercent: 50,
      medianAge: 30,
      lifeExpectancy: 70,
      literacyRatePercent: 90,
    };
    expect(validate(invalid)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Religion Schema (DR-161)
// ---------------------------------------------------------------------------

describe('Religion Schema Validation', () => {
  const validate = ajv.compile(religionSchema);
  const dir = join(MODELS_ROOT, 'religion');
  const files = listModelFiles(dir);

  it('has at least 8 religion model files', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files)('validates %s against schema', (file) => {
    const data = loadJson(join(dir, file));
    const valid = validate(data);
    if (!valid) {
      const errors = (validate.errors ?? []).map(
        (e) => `${e.instancePath}: ${e.message}`,
      );
      expect.fail(`${file} failed validation:\n${errors.join('\n')}`);
    }
    expect(valid).toBe(true);
  });

  it('rejects religion with invalid politicalInfluence', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      religionId: 'test',
      name: 'Test',
      description: 'Test religion description.',
      adherentsGlobalPercent: 5,
      socialCohesionModifier: 10,
      politicalInfluence: 'extreme',
    };
    expect(validate(invalid)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Leader Profile Schema (DR-142, DR-143)
// ---------------------------------------------------------------------------

describe('Leader Profile Schema Validation', () => {
  const validate = ajv.compile(leaderProfileSchema);
  const dir = join(MODELS_ROOT, 'leaders');
  const files = listModelFiles(dir);

  it('has at least 8 leader profile model files', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files)('validates %s against schema', (file) => {
    const data = loadJson(join(dir, file));
    const valid = validate(data);
    if (!valid) {
      const errors = (validate.errors ?? []).map(
        (e) => `${e.instancePath}: ${e.message}`,
      );
      expect.fail(`${file} failed validation:\n${errors.join('\n')}`);
    }
    expect(valid).toBe(true);
  });

  it('rejects leader with invalid mbtiType', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      leaderId: 'test',
      name: 'Test Leader',
      factionId: 'test',
      mbtiType: 'XXXX',
      psychology: {
        decisionStyle: 'analytical',
        stressResponse: 'escalate',
        riskTolerance: 50,
        paranoia: 50,
        narcissism: 50,
        pragmatism: 50,
        patience: 50,
        vengefulIndex: 50,
      },
      motivations: { primary: 'power' },
      powerBase: { source: 'military' },
    };
    expect(validate(invalid)).toBe(false);
  });

  it('rejects leader with missing psychology fields', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      leaderId: 'test',
      name: 'Test Leader',
      factionId: 'test',
      mbtiType: 'INTJ',
      psychology: {
        decisionStyle: 'analytical',
        // missing other required fields
      },
      motivations: { primary: 'power' },
      powerBase: { source: 'military' },
    };
    expect(validate(invalid)).toBe(false);
  });
});
