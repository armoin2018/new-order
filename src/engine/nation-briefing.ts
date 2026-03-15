/**
 * Nation Briefing Engine — FR-1206
 *
 * Compiles a comprehensive briefing for a selected nation, summarizing
 * leader profile, power base, intelligence capabilities, military forces,
 * geographic posture, vulnerabilities, relationships, and strategic
 * recommendations. All data is sourced from the scenario definition and
 * the player's (possibly customized) leader profile.
 *
 * @see FR-1206
 */

import type {
  FactionId,
  LeaderProfile,
  NationState,
  GeographicPosture,
  IntelligenceCapabilityMatrix,
  MilitaryForceStructure,
  ScenarioDefinition,
  AIProfileConfig,
} from '@/data/types';

// ── Exported Types ──────────────────────────────────────────────────────────

/**
 * Identifies one of the eight briefing sections.
 * @see FR-1206
 */
export type BriefingSectionId =
  | 'leaderProfile'
  | 'powerBase'
  | 'intelligence'
  | 'military'
  | 'geography'
  | 'vulnerabilities'
  | 'relationships'
  | 'strategies';

/**
 * A single key-value entry within a briefing section.
 * @see FR-1206
 */
export interface BriefingEntry {
  readonly label: string;
  readonly value: string | number;
  readonly detail?: string;
}

/**
 * A titled section of the nation briefing containing labelled entries.
 * @see FR-1206
 */
export interface BriefingSection {
  readonly id: BriefingSectionId;
  readonly title: string;
  readonly entries: readonly BriefingEntry[];
}

/**
 * Summarises the bilateral relationship with another faction.
 * @see FR-1206
 */
export interface RelationshipSummary {
  readonly factionId: FactionId;
  readonly factionLabel: string;
  readonly tensionLevel: number;
  readonly classification: 'Ally' | 'Neutral' | 'Rival' | 'Hostile';
}

/**
 * A single strategic recommendation with priority, category, and rationale.
 * @see FR-1206
 */
export interface StrategicRecommendation {
  readonly priority: 'high' | 'medium' | 'low';
  readonly category: string;
  readonly recommendation: string;
  readonly rationale: string;
}

/**
 * The complete nation briefing delivered after faction selection.
 * @see FR-1206
 */
export interface NationBriefing {
  readonly factionId: FactionId;
  readonly leader: LeaderProfile;
  readonly sections: readonly BriefingSection[];
  readonly relationships: readonly RelationshipSummary[];
  readonly strategies: readonly StrategicRecommendation[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Classify a tension value into a human-readable relationship category.
 *
 * Thresholds:
 *   0–20  → Ally
 *  21–50  → Neutral
 *  51–75  → Rival
 *  76–100 → Hostile
 */
function classifyTension(tension: number): RelationshipSummary['classification'] {
  if (tension <= 20) return 'Ally';
  if (tension <= 50) return 'Neutral';
  if (tension <= 75) return 'Rival';
  return 'Hostile';
}

/**
 * Return a relevance score for a decision-style / recommendation-category
 * pairing so recommendations can be ordered by leadership fit.
 */
function decisionStyleRelevance(style: string, category: string): number {
  const matrix: Record<string, Record<string, number>> = {
    Transactional: { economic: 3, diplomacy: 2, military: 1, domestic: 2, technology: 1, leadership: 2 },
    Analytical:    { economic: 2, diplomacy: 2, military: 2, domestic: 2, technology: 3, leadership: 1 },
    Intuitive:     { economic: 1, diplomacy: 2, military: 3, domestic: 2, technology: 1, leadership: 2 },
    Ideological:   { economic: 1, diplomacy: 1, military: 2, domestic: 3, technology: 1, leadership: 3 },
  };
  const row = matrix[style];
  if (!row) return 1;
  const score = row[category];
  return score ?? 1;
}

// ── Engine ──────────────────────────────────────────────────────────────────

/**
 * Stateless engine that compiles a full {@link NationBriefing} from scenario
 * data and a leader profile.
 *
 * @see FR-1206
 */
export class NationBriefingEngine {
  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Compile a complete nation briefing for the given faction.
   *
   * Orchestrates all eight section builders, relationship mapping, and
   * strategic recommendation generation.
   *
   * @param factionId  - The selected faction.
   * @param leader     - The (possibly customised) leader profile.
   * @param scenario   - The loaded scenario definition.
   * @returns A fully populated {@link NationBriefing}.
   * @see FR-1206
   */
  compileBriefing(
    factionId: FactionId,
    leader: LeaderProfile,
    scenario: ScenarioDefinition,
  ): NationBriefing {
    const sections: BriefingSection[] = [
      this.buildLeaderSection(leader),
      this.buildPowerBaseSection(leader),
      this.buildIntelligenceSection(factionId, scenario),
      this.buildMilitarySection(factionId, scenario),
      this.buildGeographySection(factionId, scenario),
      this.buildVulnerabilitiesSection(leader),
      this.buildRelationshipsSection(factionId, scenario),
      this.buildStrategiesSection(factionId, leader, scenario),
    ];

    const relationships = this.buildRelationships(factionId, scenario);
    const strategies = this.generateStrategies(factionId, leader, scenario);

    return {
      factionId,
      leader,
      sections,
      relationships,
      strategies,
    };
  }

  // ── Relationship Builder ────────────────────────────────────────────────

  /**
   * Build relationship summaries for every other faction.
   *
   * Reads tension levels from the scenario relationship matrix and
   * resolves each opposing faction's leader name as the label.
   *
   * @param factionId - The player's faction.
   * @param scenario  - The loaded scenario definition.
   * @returns An array of {@link RelationshipSummary} for each other faction.
   * @see FR-1206
   */
  buildRelationships(
    factionId: FactionId,
    scenario: ScenarioDefinition,
  ): readonly RelationshipSummary[] {
    const row: Record<FactionId, number> | undefined =
      scenario.relationshipMatrix[factionId];

    return scenario.factions
      .filter((f) => f !== factionId)
      .map((otherFactionId): RelationshipSummary => {
        const tension: number = row?.[otherFactionId] ?? 50;

        const aiProfile: AIProfileConfig | undefined =
          scenario.aiProfiles[otherFactionId];
        const label = aiProfile?.leader.identity.name ?? String(otherFactionId);

        return {
          factionId: otherFactionId,
          factionLabel: label,
          tensionLevel: tension,
          classification: classifyTension(tension),
        };
      });
  }

  // ── Strategy Generator ──────────────────────────────────────────────────

  /**
   * Generate 3-5 strategic recommendations based on national
   * strengths, weaknesses, and the leader's psychology.
   *
   * @param factionId - The player's faction.
   * @param leader    - The leader profile.
   * @param scenario  - The loaded scenario definition.
   * @returns Ordered array of {@link StrategicRecommendation}.
   * @see FR-1206
   */
  generateStrategies(
    factionId: FactionId,
    leader: LeaderProfile,
    scenario: ScenarioDefinition,
  ): readonly StrategicRecommendation[] {
    const nationState: NationState | undefined =
      scenario.nationStates[factionId];

    const candidates: StrategicRecommendation[] = [];

    if (nationState) {
      if (nationState.stability < 40) {
        candidates.push({
          priority: 'high',
          category: 'domestic',
          recommendation: 'Address domestic instability through economic reform',
          rationale: `National stability is critically low at ${String(nationState.stability)}. ` +
            'Without urgent reform the regime risks collapse.',
        });
      }

      if (nationState.militaryReadiness > 70) {
        candidates.push({
          priority: 'medium',
          category: 'military',
          recommendation: 'Leverage military strength for deterrence',
          rationale: `Military readiness of ${String(nationState.militaryReadiness)} provides a credible ` +
            'deterrent. Visible exercises and posture adjustments can discourage adversaries.',
        });
      }

      if (nationState.diplomaticInfluence > 60) {
        candidates.push({
          priority: 'medium',
          category: 'diplomacy',
          recommendation: 'Pursue alliance-building to strengthen position',
          rationale: `Diplomatic influence score of ${String(nationState.diplomaticInfluence)} creates ` +
            'opportunities for coalition-building and multilateral pressure.',
        });
      }

      if (nationState.techLevel > 70) {
        candidates.push({
          priority: 'medium',
          category: 'technology',
          recommendation: 'Invest in technology to maintain competitive edge',
          rationale: `Technology level of ${String(nationState.techLevel)} is a strategic asset. ` +
            'Continued investment prevents rivals from closing the gap.',
        });
      }

      if (nationState.treasury < 200) {
        candidates.push({
          priority: 'high',
          category: 'economic',
          recommendation: 'Secure economic foundations before external commitments',
          rationale: `Treasury reserves of ${String(nationState.treasury)}B are dangerously low. ` +
            'External adventures without economic backing risk catastrophic overextension.',
        });
      }
    }

    // Always include one recommendation derived from the leader's primary goal.
    candidates.push({
      priority: 'medium',
      category: 'leadership',
      recommendation: `Advance leader's primary objective: ${leader.motivations.primaryGoal}`,
      rationale: `The leader's core ambition — "${leader.motivations.primaryGoal}" — ` +
        'should inform long-term strategic planning and resource allocation.',
    });

    // Sort by decision-style relevance then by priority weight.
    const style = String(leader.psychology.decisionStyle);
    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };

    const sorted = [...candidates].sort((a, b) => {
      const relA = decisionStyleRelevance(style, a.category);
      const relB = decisionStyleRelevance(style, b.category);
      if (relB !== relA) return relB - relA;
      return (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
    });

    // Cap at 5 recommendations.
    return sorted.slice(0, 5);
  }

  // ── Private Section Builders ────────────────────────────────────────────

  /**
   * Build the Leader Profile briefing section.
   *
   * Includes name, title, ideology, decision style, stress response,
   * primary goal, and historical analog.
   */
  private buildLeaderSection(leader: LeaderProfile): BriefingSection {
    return {
      id: 'leaderProfile',
      title: 'Leader Profile',
      entries: [
        { label: 'Name', value: leader.identity.name },
        { label: 'Title', value: leader.identity.title },
        { label: 'Ideology', value: leader.identity.ideology },
        {
          label: 'Decision Style',
          value: String(leader.psychology.decisionStyle),
          detail: 'Governs how the leader weighs options under uncertainty.',
        },
        {
          label: 'Stress Response',
          value: String(leader.psychology.stressResponse),
          detail: 'Default behavioural mode when the regime is under pressure.',
        },
        {
          label: 'Primary Goal',
          value: leader.motivations.primaryGoal,
          detail: leader.motivations.legacyAmbition,
        },
        {
          label: 'Historical Analog',
          value: leader.historicalAnalog,
          detail: 'Historical figure whose leadership pattern this leader echoes.',
        },
      ],
    };
  }

  /**
   * Build the Power Base briefing section.
   *
   * Lists every domestic pillar of support with its loyalty score.
   */
  private buildPowerBaseSection(leader: LeaderProfile): BriefingSection {
    const pb = leader.powerBase;
    return {
      id: 'powerBase',
      title: 'Power Base',
      entries: [
        { label: 'Military Loyalty', value: pb.military, detail: 'Armed forces loyalty (0–100)' },
        { label: 'Oligarch Support', value: pb.oligarchs, detail: 'Economic elite support (0–100)' },
        { label: 'Party Cohesion', value: pb.party, detail: 'Ruling party/faction cohesion (0–100)' },
        { label: 'Clergy Support', value: pb.clergy, detail: 'Religious establishment support (0–100)' },
        { label: 'Public Approval', value: pb.public, detail: 'Popular approval rating (0–100)' },
        { label: 'Security Services', value: pb.securityServices, detail: 'Intelligence/secret police loyalty (0–100)' },
      ],
    };
  }

  /**
   * Build the Intelligence Capabilities briefing section.
   *
   * Draws HUMINT, SIGINT, CYBER, COVERT, and Counter-Intelligence scores
   * from the scenario's {@link IntelligenceCapabilityMatrix}.
   */
  private buildIntelligenceSection(
    factionId: FactionId,
    scenario: ScenarioDefinition,
  ): BriefingSection {
    const matrix: IntelligenceCapabilityMatrix | undefined =
      scenario.intelligenceCapabilities[factionId];
    const caps = matrix?.capabilities;

    return {
      id: 'intelligence',
      title: 'Intelligence Capabilities',
      entries: [
        { label: 'HUMINT', value: caps?.humint ?? 0, detail: 'Human intelligence capability (0–100)' },
        { label: 'SIGINT', value: caps?.sigint ?? 0, detail: 'Signals intelligence capability (0–100)' },
        { label: 'CYBER', value: caps?.cyber ?? 0, detail: 'Cyber operations capability (0–100)' },
        { label: 'COVERT', value: caps?.covert ?? 0, detail: 'Covert operations capability (0–100)' },
        { label: 'Counter-Intelligence', value: caps?.counterIntel ?? 0, detail: 'Counter-intelligence rating (0–100)' },
      ],
    };
  }

  /**
   * Build the Military Forces briefing section.
   *
   * Draws aggregate force data from the scenario's
   * {@link MilitaryForceStructure}.
   */
  private buildMilitarySection(
    factionId: FactionId,
    scenario: ScenarioDefinition,
  ): BriefingSection {
    const mfs: MilitaryForceStructure | undefined =
      scenario.militaryForceStructures[factionId];

    return {
      id: 'military',
      title: 'Military Forces',
      entries: [
        {
          label: 'Active Forces',
          value: mfs?.activeForces ?? 0,
          detail: 'Total active military personnel (thousands)',
        },
        {
          label: 'Nuclear Arsenal',
          value: mfs?.nuclearArsenal ?? 0,
          detail: 'Warhead count',
        },
        {
          label: 'Naval Power',
          value: mfs?.navalPower ?? 0,
          detail: 'Aggregate naval power score (0–100)',
        },
        {
          label: 'Air Power',
          value: mfs?.airPower ?? 0,
          detail: 'Aggregate air power score (0–100)',
        },
        {
          label: 'Special Capabilities',
          value: mfs?.specialCapability.join(', ') ?? 'None',
          detail: 'Notable asymmetric or advanced capabilities',
        },
        {
          label: 'Force Projection',
          value: mfs?.forceProjection ?? 0,
          detail: 'Ability to deploy power beyond borders (0–100)',
        },
        {
          label: 'Readiness',
          value: mfs?.readiness ?? 0,
          detail: 'Overall readiness state (0–100)',
        },
      ],
    };
  }

  /**
   * Build the Geographic Posture briefing section.
   *
   * Draws terrain, depth, chokepoints, and energy dependency from
   * the scenario's {@link GeographicPosture}.
   */
  private buildGeographySection(
    factionId: FactionId,
    scenario: ScenarioDefinition,
  ): BriefingSection {
    const geo: GeographicPosture | undefined =
      scenario.geographicPostures[factionId];

    return {
      id: 'geography',
      title: 'Geographic Posture',
      entries: [
        {
          label: 'Strategic Depth',
          value: geo?.strategicDepth ?? 0,
          detail: 'Buffer between borders and core centres (0–100)',
        },
        {
          label: 'Natural Defenses',
          value: geo?.naturalDefenses.join(', ') ?? 'None',
          detail: 'Mountains, rivers, and other defensive terrain',
        },
        {
          label: 'Key Vulnerabilities',
          value: geo?.keyVulnerabilities.join(', ') ?? 'None',
          detail: 'Known strategic weaknesses',
        },
        {
          label: 'Chokepoint Control',
          value: geo?.chokepointControl.join(', ') ?? 'None',
          detail: 'Strategic chokepoints controlled or contested',
        },
        {
          label: 'Terrain Advantage',
          value: geo?.terrainAdvantage ?? 0,
          detail: 'Net terrain modifier (−50 to +50)',
        },
        {
          label: 'Energy Dependency',
          value: geo?.energyDependency ?? 0,
          detail: 'Dependency on imported energy (0–100). Higher = more vulnerable',
        },
      ],
    };
  }

  /**
   * Build the Key Vulnerabilities briefing section.
   *
   * Surfaces structural weaknesses that could topple the regime.
   */
  private buildVulnerabilitiesSection(leader: LeaderProfile): BriefingSection {
    const v = leader.vulnerabilities;
    return {
      id: 'vulnerabilities',
      title: 'Key Vulnerabilities',
      entries: [
        { label: 'Health Risk', value: v.healthRisk, detail: 'Probability of incapacitation per turn (0–100)' },
        { label: 'Succession Clarity', value: v.successionClarity, detail: 'Orderliness of transition (0 = chaos, 100 = stable)' },
        { label: 'Coup Risk', value: v.coupRisk, detail: 'Probability of internal overthrow attempt (0–100)' },
        { label: 'Personal Scandal', value: v.personalScandal, detail: 'Exposure to damaging information (0–100)' },
      ],
    };
  }

  /**
   * Build a summary briefing section for Relationships (displayed alongside
   * the full {@link RelationshipSummary} array).
   */
  private buildRelationshipsSection(
    factionId: FactionId,
    scenario: ScenarioDefinition,
  ): BriefingSection {
    const summaries = this.buildRelationships(factionId, scenario);
    return {
      id: 'relationships',
      title: 'Starting Relationships',
      entries: summaries.map((r) => ({
        label: r.factionLabel,
        value: r.classification,
        detail: `Tension: ${String(r.tensionLevel)}`,
      })),
    };
  }

  /**
   * Build a summary briefing section for Recommended Strategies (displayed
   * alongside the full {@link StrategicRecommendation} array).
   */
  private buildStrategiesSection(
    factionId: FactionId,
    leader: LeaderProfile,
    scenario: ScenarioDefinition,
  ): BriefingSection {
    const recs = this.generateStrategies(factionId, leader, scenario);
    return {
      id: 'strategies',
      title: 'Recommended Strategies',
      entries: recs.map((r) => ({
        label: `[${r.priority.toUpperCase()}] ${r.category}`,
        value: r.recommendation,
        detail: r.rationale,
      })),
    };
  }
}
