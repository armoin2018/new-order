# Contributing to Conflict 2026

Thank you for your interest in contributing to Conflict 2026! This document provides guidelines and information for contributors.

---

## 🛠️ Development Environment

### Prerequisites

- **Node.js** 22+ (LTS)
- **npm** 10+
- **Git** 2.40+

### Setup

```bash
git clone https://github.com/your-org/NewOrder.git
cd NewOrder
npm install
```

### Verify Setup

```bash
npm run typecheck   # Should exit cleanly
npm run lint        # Should report 0 errors
npm test            # Should pass all 3,621 tests
npm run build       # Should produce ~70KB gzip bundle
```

---

## 📐 Code Standards

### TypeScript

- **Strict mode** — All strict flags are enabled. Do not use `as any`, `@ts-ignore`, or disable strict checks.
- **No unused code** — `noUnusedLocals` and `noUnusedParameters` are enforced. Prefix intentionally unused parameters with `_`.
- **Safe indexing** — `noUncheckedIndexedAccess` is enabled. Always handle potential `undefined` from index access.
- **Verbatim modules** — Use `import type` for type-only imports.

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `nuclear-escalation.ts` |
| Types/Interfaces | PascalCase | `NationState`, `FactionId` |
| Functions | camelCase | `computeStability()` |
| Constants | UPPER_SNAKE | `GAME_CONFIG` |
| Enums | PascalCase (members too) | `EscalationStage.Grumbling` |
| Test files | `*.test.ts` / `*.test.tsx` | `combat.test.ts` |

### Engine Modules

All engine modules must follow these principles:

1. **Pure functions** — No side effects, no mutation of arguments
2. **Deterministic** — Same inputs always produce same outputs (use seeded PRNG)
3. **JSDoc documented** — All exported functions, types, and constants must have JSDoc
4. **Tested** — 90%+ coverage for lines, functions, and branches

### Path Aliases

Use path aliases instead of relative imports when crossing module boundaries:

```typescript
// ✅ Good
import { GAME_CONFIG } from '@/engine/config';
import type { FactionId } from '@/data/types';

// ❌ Bad
import { GAME_CONFIG } from '../../engine/config';
```

---

## 🧪 Testing

### Requirements

- All new engine modules must have corresponding test files
- Tests go in `src/engine/__tests__/` for engine code
- Minimum **90% coverage** for `src/engine/**`
- Use descriptive `describe`/`it` blocks with clear assertion messages

### Running Tests

```bash
npm test                  # All tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
npm run test:e2e          # Playwright E2E
```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../my-module';

describe('myFunction', () => {
  it('handles base case', () => {
    const result = myFunction(baseInput);
    expect(result.score).toBe(50);
  });

  it('clamps output to valid range', () => {
    const result = myFunction(extremeInput);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
```

---

## 🔀 Pull Request Process

1. **Create a feature branch** from `develop`:
   ```bash
   git checkout -b feature/your-feature-name develop
   ```

2. **Make your changes** following the code standards above.

3. **Run the full quality check** before pushing:
   ```bash
   npm run typecheck && npm run lint && npm test && npm run build
   ```

4. **Write a clear PR description** including:
   - What the change does
   - Which requirement IDs it addresses (e.g., `FR-1301`, `NFR-204`)
   - Any new configuration constants added to `GAME_CONFIG`

5. **All CI checks must pass** — typecheck, lint, build, and tests.

---

## 🏗️ Architecture Guidelines

### Adding a New Engine Module

1. Create `src/engine/my-engine.ts` with pure-function exports
2. Add JSDoc to all exported symbols
3. Create `src/engine/__tests__/my-engine.test.ts` with comprehensive tests
4. Add re-exports to `src/engine/index.ts`
5. Add configuration constants to the appropriate `src/engine/config/*.ts` file
6. Update `GAME_CONFIG` type if needed

### Adding Configuration

All game constants go in `src/engine/config/`. Pick the appropriate domain file:

- `meta.ts` — Game meta (turns, factions, dates)
- `stability.ts` — Stability, civil unrest, power base
- `military.ts` — Nuclear, combat, force structure
- `ai.ts` — AI decision engine, difficulty scaling
- `intelligence.ts` — Intel ops, fog of war, double agents
- `psychology.ts` — Emotions, bias, personality drift
- `information-warfare.ts` — Narrative, media, virality
- `economy.ts` — Financial warfare, technology race
- `geopolitics.ts` — Resources, climate, proxy wars, diplomacy
- `systems.ts` — Advisory, victory/loss, post-game, UI systems

### Game State Changes

When adding new state:

1. Add the TypeScript type to `src/data/types/`
2. Add default value to `EMPTY_GAME_STATE` in `store.ts`
3. Add scenario initialization in `initializeFromScenario`
4. Add AJV validation schema if applicable

---

## 📝 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(engine): add pandemic-diplomacy scoring engine
fix(nuclear): correct MAD threshold calculation
test(proxy): add arms bazaar blowback tests
docs: update architecture diagram in README
chore: bump Vitest to 4.0.18
```

---

## ❓ Questions?

Open a discussion in the GitHub repository or contact the maintainers.
