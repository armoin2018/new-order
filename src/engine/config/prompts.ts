/**
 * New Order — AI Dimension Prompt Configuration
 *
 * Defines dimension metadata (labels, icons, descriptions), default prompt
 * templates for each of the 10 AI-driven simulation dimensions, and version
 * history limits.
 *
 * @see FR-4001 — Prompt Dimensions
 * @see FR-4002 — Default Prompt Templates
 * @see FR-4003 — Template Variable Substitution
 * @see FR-4004 — Prompt Version History
 * @see NFR-204 — All game formulas configurable via constants
 */

export const promptsConfig = {
  /** Maximum number of prompt versions retained per dimension (FR-4004) */
  maxVersions: 20,

  /** Metadata for each prompt dimension */
  dimensions: {
    diplomacy: {
      label: 'Diplomacy',
      description: 'Governs bilateral negotiations, treaty proposals, and alliance management.',
      icon: '🤝',
    },
    markets: {
      label: 'Markets',
      description: 'Controls stock-market sentiment, sector performance, and trade-flow analysis.',
      icon: '📈',
    },
    indexes: {
      label: 'Indexes',
      description: 'Drives composite index scoring including GFSI, tech-index, and resource-security.',
      icon: '📊',
    },
    currency: {
      label: 'Currency',
      description: 'Manages exchange-rate modelling, currency attacks, and reserve-currency dynamics.',
      icon: '💱',
    },
    technology: {
      label: 'Technology',
      description: 'Guides R&D prioritisation, tech-bloc alignment, and export-control impact.',
      icon: '🔬',
    },
    military: {
      label: 'Military',
      description: 'Shapes force-posture evaluation, combat-readiness, and escalation-risk assessment.',
      icon: '⚔️',
    },
    education: {
      label: 'Education',
      description: 'Evaluates human-capital development, STEM pipeline, and literacy-campaign outcomes.',
      icon: '🎓',
    },
    religion: {
      label: 'Religion',
      description: 'Assesses religious-tension dynamics, sectarian fault-lines, and faith-based influence.',
      icon: '🕌',
    },
    decisionModel: {
      label: 'Decision Model',
      description: 'Constructs the cognitive model used by AI leaders when weighing strategic options.',
      icon: '🧠',
    },
    decisionSelection: {
      label: 'Decision Selection',
      description: 'Selects the final action from ranked options using leader psychology and risk appetite.',
      icon: '🎯',
    },
  },

  /** Default prompt templates per dimension (FR-4002) */
  defaultPrompts: {
    diplomacy:
      'Analyse the current diplomatic landscape for {{nationName}} on turn {{turnNumber}}. ' +
      'Consider {{leaderProfile}} and existing alliances when proposing treaty or negotiation actions. ' +
      'Reference {{recentEvents}} to identify leverage points and emerging threats. ' +
      'Output a ranked list of diplomatic options with risk assessments.',

    markets:
      'Evaluate the stock-market outlook for {{nationName}} given {{gameState}} on turn {{turnNumber}}. ' +
      'Factor in sector sentiment from {{dimensionData}} and any recent shocks in {{recentEvents}}. ' +
      'Provide projected market-movement direction and confidence level.',

    indexes:
      'Compute composite index scores for {{nationName}} using {{dimensionData}} as of turn {{turnNumber}}. ' +
      'Weight contributing factors according to {{gameState}} and highlight any threshold breaches. ' +
      'Summarise key drivers behind score changes since the previous turn.',

    currency:
      'Model exchange-rate dynamics for {{nationName}} on turn {{turnNumber}}. ' +
      'Incorporate reserve levels, trade balances from {{dimensionData}}, and sanctions pressure in {{recentEvents}}. ' +
      'Assess vulnerability to currency manipulation and recommend defensive postures.',

    technology:
      'Assess R&D progress and tech-bloc alignment for {{nationName}} on turn {{turnNumber}}. ' +
      'Use {{dimensionData}} for current research pipeline and {{gameState}} for export-control context. ' +
      'Identify breakthrough opportunities and decoupling risks based on {{recentEvents}}.',

    military:
      'Evaluate the military posture of {{nationName}} on turn {{turnNumber}} using {{dimensionData}}. ' +
      'Consider {{leaderProfile}} for doctrine preferences and risk tolerance. ' +
      'Identify force-structure gaps and recommend readiness adjustments given {{recentEvents}}.',

    education:
      'Analyse human-capital development for {{nationName}} on turn {{turnNumber}}. ' +
      'Review education-programme effectiveness from {{dimensionData}} and labour-market trends in {{gameState}}. ' +
      "Recommend investment priorities that align with the leader's strategic vision in {{leaderProfile}}.",

    religion:
      'Assess religious and sectarian dynamics within {{nationName}} on turn {{turnNumber}}. ' +
      'Use {{dimensionData}} for demographic composition and {{recentEvents}} for emerging tensions. ' +
      'Gauge the impact of faith-based movements on political stability described in {{gameState}}.',

    decisionModel:
      'Construct a cognitive decision model for the leader of {{nationName}} on turn {{turnNumber}}. ' +
      'Integrate personality traits from {{leaderProfile}} with situational pressures from {{gameState}}. ' +
      'Account for cognitive biases, stress responses, and historical patterns in {{recentEvents}}. ' +
      'Output a weighted preference matrix across all strategic dimensions.',

    decisionSelection:
      'Select the optimal action for {{nationName}} from the ranked option set on turn {{turnNumber}}. ' +
      "Apply the leader's risk appetite from {{leaderProfile}} and current political capital in {{gameState}}. " +
      'Factor in {{recentEvents}} for time-sensitive opportunities and output a final decision with rationale.',
  },
} as const;
