/**
 * Emergent Technology Configuration — FR-6100
 *
 * Tunable parameters for per-nation tech profiles, emergent technology
 * generation, maturity progression, cross-industry impacts, and
 * nation-specific affinities.
 *
 * All emergent tech formulas are tunable here without code changes.
 *
 * @see NFR-204 — All game formulas shall be configurable via constants.
 * @see FR-6100 — Emergent Technology & Per-Nation Tech Differentiation
 */

import type { FactionId, TechDomain } from '@/data/types/enums';
import type { ResearchFocus, IndustrySector, EmergentTechMaturity } from '@/data/types/emergent-tech.types';

// ---------------------------------------------------------------------------
// Nation-Specific Tech Affinities
// ---------------------------------------------------------------------------

/**
 * Default research foci and domain efficiency for each faction.
 * These reflect real-world tech specialisations as of 2025.
 */
export interface NationTechAffinity {
  /** Primary research focus areas. */
  defaultFoci: ResearchFocus[];
  /** Domain efficiency multipliers (1.0 = average). */
  domainMultipliers: Record<TechDomain, number>;
  /** Base innovation culture score. */
  baseInnovationCulture: number;
  /** Base R&D spending % of GDP. */
  baseRdSpendingPct: number;
  /** Base talent flow score. */
  baseTalentFlow: number;
  /** Base research institution count. */
  baseResearchInstitutions: number;
}

export const nationTechAffinities: Record<FactionId, NationTechAffinity> = {
  us: {
    defaultFoci: ['ai', 'space', 'biotech'],
    domainMultipliers: { AI: 1.4, Semiconductors: 1.2, Space: 1.3, Cyber: 1.2, Biotech: 1.3, Quantum: 1.1 },
    baseInnovationCulture: 85,
    baseRdSpendingPct: 3.4,
    baseTalentFlow: 30,
    baseResearchInstitutions: 250,
  },
  china: {
    defaultFoci: ['semiconductors', 'ai', 'quantum'],
    domainMultipliers: { AI: 1.3, Semiconductors: 1.4, Space: 1.1, Cyber: 1.2, Biotech: 1.0, Quantum: 1.3 },
    baseInnovationCulture: 70,
    baseRdSpendingPct: 2.4,
    baseTalentFlow: -5,
    baseResearchInstitutions: 200,
  },
  russia: {
    defaultFoci: ['cyber', 'space', 'hypersonics'],
    domainMultipliers: { AI: 0.8, Semiconductors: 0.6, Space: 1.2, Cyber: 1.4, Biotech: 0.7, Quantum: 0.8 },
    baseInnovationCulture: 55,
    baseRdSpendingPct: 1.1,
    baseTalentFlow: -20,
    baseResearchInstitutions: 80,
  },
  japan: {
    defaultFoci: ['semiconductors', 'autonomous_systems', 'materials_science'],
    domainMultipliers: { AI: 1.1, Semiconductors: 1.3, Space: 1.0, Cyber: 1.0, Biotech: 1.2, Quantum: 1.1 },
    baseInnovationCulture: 75,
    baseRdSpendingPct: 3.3,
    baseTalentFlow: -10,
    baseResearchInstitutions: 120,
  },
  eu: {
    defaultFoci: ['climate_tech', 'biotech', 'quantum'],
    domainMultipliers: { AI: 1.1, Semiconductors: 1.0, Space: 1.1, Cyber: 1.0, Biotech: 1.2, Quantum: 1.2 },
    baseInnovationCulture: 72,
    baseRdSpendingPct: 2.2,
    baseTalentFlow: 5,
    baseResearchInstitutions: 180,
  },
  iran: {
    defaultFoci: ['cyber', 'autonomous_systems', 'energy_systems'],
    domainMultipliers: { AI: 0.6, Semiconductors: 0.4, Space: 0.7, Cyber: 1.1, Biotech: 0.6, Quantum: 0.3 },
    baseInnovationCulture: 40,
    baseRdSpendingPct: 0.8,
    baseTalentFlow: -30,
    baseResearchInstitutions: 25,
  },
  dprk: {
    defaultFoci: ['cyber', 'hypersonics', 'space'],
    domainMultipliers: { AI: 0.3, Semiconductors: 0.2, Space: 0.6, Cyber: 0.9, Biotech: 0.2, Quantum: 0.1 },
    baseInnovationCulture: 15,
    baseRdSpendingPct: 0.3,
    baseTalentFlow: -40,
    baseResearchInstitutions: 8,
  },
  syria: {
    defaultFoci: ['energy_systems', 'cyber', 'autonomous_systems'],
    domainMultipliers: { AI: 0.2, Semiconductors: 0.1, Space: 0.1, Cyber: 0.5, Biotech: 0.2, Quantum: 0.1 },
    baseInnovationCulture: 10,
    baseRdSpendingPct: 0.1,
    baseTalentFlow: -45,
    baseResearchInstitutions: 3,
  },
} as const;

// ---------------------------------------------------------------------------
// Emergent Tech Generation Parameters
// ---------------------------------------------------------------------------

export const emergentTechConfig = {
  /**
   * Generation probability tunables.
   */
  generation: {
    /** Base % chance per faction per turn of generating an emergent tech. */
    baseChancePerTurn: 3,
    /** Hard ceiling on generation probability. */
    maxChancePerTurn: 25,
    /** Minimum domain score in primary domain to trigger generation. */
    minDomainScoreThreshold: 40,
    /** Minimum innovation culture to enable generation at all. */
    minInnovationCulture: 20,
    /** Bonus % per 10 points above threshold in primary domain. */
    domainScoreBonusPer10: 2,
    /** Bonus % per 1% R&D spending above 1%. */
    rdSpendingBonusPer1Pct: 1.5,
    /** Bonus % per 10 positive talent-flow points. */
    talentFlowBonusPer10: 1,
    /** Bonus % per existing breakthrough in primary domain. */
    breakthroughBonusPer: 0.5,
    /** Penalty multiplier when stability < 40 (0–1 range, multiplied). */
    lowStabilityPenalty: 0.5,
    /** Maximum emergent techs per nation per game. */
    maxPerNation: 15,
    /** Maximum emergent techs globally per game. */
    maxGlobal: 60,
    /** Minimum turns between emergent techs for the same nation. */
    cooldownTurns: 3,
  },

  /**
   * Maturity progression tunables.
   */
  maturity: {
    /** Progress gained per turn while faction invests. */
    progressPerTurn: 15,
    /** Base turns at each maturity stage before advancing. */
    stageProgression: {
      theoretical: 100,
      experimental: 100,
      prototype: 100,
      operational: 100,
      mature: Infinity, // Terminal stage
    } as Record<EmergentTechMaturity, number>,
    /** Efficiency multiplier from innovation culture (per 10 points above 50). */
    cultureBonus: 0.1,
    /** R&D spending multiplier (per 1% above 2%). */
    rdBonus: 0.15,
  },

  /**
   * Cross-industry impact tunables.
   */
  crossIndustry: {
    /** Number of industry sectors impacted by each emergent tech. */
    minSectorsImpacted: 1,
    maxSectorsImpacted: 4,
    /** Magnitude range for cross-industry impacts. */
    magnitudeRange: { min: -30, max: 40 },
    /** Probability that an impact is temporary. */
    temporaryProbability: 0.3,
    /** Duration range for temporary impacts (turns). */
    temporaryDurationRange: { min: 3, max: 12 },
    /** Delay range before impacts materialise (turns). */
    delayRange: { min: 0, max: 4 },
  },

  /**
   * Tech adoption / transfer tunables.
   */
  adoption: {
    /** Base probability per turn that an allied nation can adopt an operational+ tech. */
    baseAdoptionChance: 5,
    /** Minimum domain score difference from origin nation's level for adoption. */
    maxDomainGap: 30,
    /** Espionage bonus to adoption chance when intelligence capability is high. */
    espionageBonusPct: 10,
    /** Number of turns after generation before adoption becomes possible. */
    adoptionDelay: 2,
  },

  /**
   * Domain→sector impact mapping: which TechDomains tend to impact which sectors.
   */
  domainSectorAffinities: {
    AI: ['defense', 'finance', 'healthcare', 'manufacturing', 'intelligence'] as IndustrySector[],
    Semiconductors: ['manufacturing', 'communications', 'defense', 'finance'] as IndustrySector[],
    Space: ['defense', 'communications', 'space_commercial', 'intelligence'] as IndustrySector[],
    Cyber: ['defense', 'intelligence', 'finance', 'communications'] as IndustrySector[],
    Biotech: ['healthcare', 'agriculture', 'defense', 'education'] as IndustrySector[],
    Quantum: ['finance', 'intelligence', 'communications', 'defense'] as IndustrySector[],
  } as Record<TechDomain, IndustrySector[]>,

  /**
   * Global innovation velocity adjustments.
   */
  velocity: {
    /** Starting global innovation velocity. */
    initial: 1.0,
    /** Per-turn velocity increase (simulates accelerating innovation). */
    perTurnIncrease: 0.005,
    /** Maximum velocity cap. */
    maxVelocity: 2.0,
    /** Velocity boost per global discovery event. */
    discoveryBoost: 0.02,
  },
} as const;

/**
 * Emergent tech name templates per domain combination.
 * Used by the generation engine to create thematic names.
 * Keys are `${primaryDomain}` or `${primary}+${secondary}`.
 */
export const emergentTechNameTemplates: Record<string, string[]> = {
  // Single-domain breakthroughs
  AI: [
    'Autonomous Strategic Reasoning',
    'Self-Improving Neural Architecture',
    'General Purpose AI Assistant',
    'AI-Driven Scientific Discovery',
    'Adaptive Warfare AI',
    'Predictive Governance Engine',
  ],
  Semiconductors: [
    'Carbon Nanotube Processors',
    'Neuromorphic Computing Chips',
    'Optical Interconnect Fabric',
    'Sub-1nm Gate Architecture',
    'Molecular-Scale Transistors',
    'Integrated Photonic Processors',
  ],
  Space: [
    'Orbital Manufacturing Platform',
    'Reusable Deep-Space Transport',
    'Lunar Resource Extraction',
    'Space-Based Solar Collector',
    'Autonomous Asteroid Mining',
    'In-Space Propellant Depot',
  ],
  Cyber: [
    'Autonomous Cyber Defense Grid',
    'Predictive Threat Intelligence',
    'Quantum-Resistant Infrastructure',
    'Zero-Trust National Network',
    'AI-Powered Counter-Disinformation',
    'Cognitive Cyber Warfare System',
  ],
  Biotech: [
    'Programmable mRNA Therapeutics',
    'Organ Bioprinting System',
    'Synthetic Biology Factory',
    'Pandemic Prediction Platform',
    'Gene Drive Pest Control',
    'Neural Repair Therapy',
  ],
  Quantum: [
    'Fault-Tolerant Quantum Computer',
    'Quantum Communication Network',
    'Quantum Sensing Array',
    'Quantum Machine Learning',
    'Post-Quantum Cryptography Standard',
    'Quantum Drug Discovery Engine',
  ],

  // Cross-domain breakthroughs (most interesting — these are the "outside existing" techs)
  'AI+Semiconductors': [
    'Neuromorphic AI Accelerator',
    'Self-Designing Chip Architecture',
    'In-Memory AI Compute Fabric',
  ],
  'AI+Biotech': [
    'Protein-Folding Drug Discovery',
    'AI-Guided Gene Therapy',
    'Computational Synthetic Biology',
  ],
  'AI+Quantum': [
    'Quantum Neural Network',
    'Hybrid Quantum-Classical AI',
    'Quantum-Enhanced Decision Engine',
  ],
  'AI+Cyber': [
    'Autonomous Penetration Framework',
    'Self-Healing Network Architecture',
    'Cognitive Influence Operations AI',
  ],
  'AI+Space': [
    'Autonomous Orbital Operations',
    'AI-Guided Deep Space Navigation',
    'Space Situational Awareness AI',
  ],
  'Semiconductors+Quantum': [
    'Photonic Quantum Chips',
    'Topological Qubit Processor',
    'Room-Temperature Quantum Device',
  ],
  'Biotech+Quantum': [
    'Quantum Molecular Simulation',
    'Quantum-Enhanced Protein Design',
    'Quantum Biosensor Array',
  ],
  'Cyber+Space': [
    'Orbital Cyber Warfare Platform',
    'Satellite-Based Secure Mesh',
    'Space-Grade Zero-Trust Network',
  ],
  'Cyber+Quantum': [
    'Quantum Key Distribution Network',
    'Quantum-Proof National Firewall',
    'Entangled Communication Grid',
  ],
  'Space+Biotech': [
    'Closed-Loop Space Life Support',
    'Microgravity Pharmaceutical Lab',
    'Radiation-Immune Bioengineering',
  ],
};

/**
 * Descriptions generated for emergent techs, keyed by template name.
 * The engine picks the matching description.
 */
export const emergentTechDescriptions: Record<string, string> = {
  'Autonomous Strategic Reasoning': 'An AI system capable of autonomous strategic planning across military, economic, and diplomatic dimensions. Generates and evaluates multi-domain action plans without human direction.',
  'Self-Improving Neural Architecture': 'A neural network framework that iteratively optimises its own architecture, discovering novel computational structures that exceed human-designed models.',
  'General Purpose AI Assistant': 'A broadly capable AI assistant that can handle complex analytical tasks across government, research, and industrial domains with near-human reasoning.',
  'AI-Driven Scientific Discovery': 'An AI system that autonomously formulates hypotheses, designs experiments, and interprets results — accelerating scientific discovery by orders of magnitude.',
  'Adaptive Warfare AI': 'Military AI that adapts tactics in real-time based on battlefield conditions, enemy behaviour patterns, and strategic objectives.',
  'Predictive Governance Engine': 'An AI platform that models societal dynamics to predict policy outcomes, enabling evidence-based governance with unprecedented foresight.',
  'Carbon Nanotube Processors': 'Processors built entirely from carbon nanotubes, achieving 10× the energy efficiency and 3× the speed of silicon-based chips.',
  'Neuromorphic Computing Chips': 'Chips that mimic biological neural networks, enabling on-device AI inference with minimal power consumption.',
  'Optical Interconnect Fabric': 'All-optical data pathways between computing components, eliminating electronic bottlenecks and enabling exascale computing.',
  'Sub-1nm Gate Architecture': 'Transistors with sub-nanometre gate lengths using novel 2D materials, extending Moore\'s Law beyond its theoretical silicon limits.',
  'Molecular-Scale Transistors': 'Single-molecule switching devices that enable computing at the absolute physical limit of miniaturisation.',
  'Integrated Photonic Processors': 'Processors that use light instead of electricity for computation, achieving massive parallelism for AI and scientific workloads.',
  'Orbital Manufacturing Platform': 'A permanently crewed facility for manufacturing high-value goods in microgravity — from optical fibres to pharmaceutical crystals.',
  'Reusable Deep-Space Transport': 'Fully reusable spacecraft capable of routine transit between Earth, the Moon, and Mars with rapid turnaround.',
  'Lunar Resource Extraction': 'Autonomous systems for mining and processing lunar regolith, producing water, oxygen, and construction materials in situ.',
  'Space-Based Solar Collector': 'Orbital solar arrays that beam energy to ground receivers via microwave, providing continuous baseload power.',
  'Autonomous Asteroid Mining': 'Self-directed spacecraft that prospect, mine, and return rare-earth materials from near-Earth asteroids.',
  'In-Space Propellant Depot': 'Orbital fuel stations enabling extended deep-space missions without heavy launch-mass penalties.',
  'Autonomous Cyber Defense Grid': 'A self-healing national cyber defense system that detects, isolates, and neutralises threats faster than human operators.',
  'Predictive Threat Intelligence': 'AI-powered system that predicts cyber attacks 24–72 hours before they occur based on adversary behaviour modelling.',
  'Quantum-Resistant Infrastructure': 'National critical infrastructure upgraded with post-quantum cryptographic algorithms, immune to quantum computing attacks.',
  'Zero-Trust National Network': 'A nation-wide network architecture where every connection is verified continuously, eliminating lateral movement by adversaries.',
  'AI-Powered Counter-Disinformation': 'Automated system that detects, attributes, and counters state-sponsored disinformation campaigns in real time.',
  'Cognitive Cyber Warfare System': 'Offensive cyber platform that combines social engineering AI with technical exploitation for multi-vector influence operations.',
  'Programmable mRNA Therapeutics': 'A platform for rapidly designing and deploying mRNA treatments for any disease, reducing therapeutic development to weeks.',
  'Organ Bioprinting System': 'Functional organ fabrication using patient-derived cells, eliminating transplant waiting lists and rejection risk.',
  'Synthetic Biology Factory': 'Automated facilities that engineer microorganisms to produce fuels, materials, and pharmaceuticals from renewable feedstocks.',
  'Pandemic Prediction Platform': 'Global biosurveillance system using AI to detect and predict pandemic emergence 3–6 months before outbreak.',
  'Gene Drive Pest Control': 'Engineered gene drives that suppress disease-vector insect populations without ecological disruption.',
  'Neural Repair Therapy': 'Biotech treatments that regenerate damaged neural tissue, restoring function after spinal cord and brain injuries.',
  'Fault-Tolerant Quantum Computer': 'A quantum computer with sufficient error correction to run arbitrary algorithms reliably — the holy grail of quantum computing.',
  'Quantum Communication Network': 'Continent-spanning quantum key distribution network enabling physically unbreakable encrypted communications.',
  'Quantum Sensing Array': 'Ultra-sensitive quantum sensors deployed for navigation, mineral detection, and submarine tracking without GPS.',
  'Quantum Machine Learning': 'Quantum algorithms that solve specific ML problems exponentially faster than classical approaches.',
  'Post-Quantum Cryptography Standard': 'A completed national migration to quantum-resistant cryptographic standards across all government and critical infrastructure.',
  'Quantum Drug Discovery Engine': 'Quantum simulation of molecular interactions enabling rapid drug candidate identification and toxicity prediction.',
  'Neuromorphic AI Accelerator': 'A fusion of neuromorphic chip design and advanced AI models, enabling always-on edge AI in every device.',
  'Self-Designing Chip Architecture': 'AI that designs its own custom silicon, creating chip architectures no human engineer could conceive.',
  'In-Memory AI Compute Fabric': 'Processing-in-memory architecture that eliminates the data movement bottleneck for large-scale AI training.',
  'Protein-Folding Drug Discovery': 'AI system that predicts protein structures and designs novel drug molecules in hours rather than years.',
  'AI-Guided Gene Therapy': 'AI system that designs personalised gene therapies by modelling patient-specific genetic interactions.',
  'Computational Synthetic Biology': 'AI-driven design of synthetic biological circuits, enabling programmable living therapeutics.',
  'Quantum Neural Network': 'A hybrid computing architecture leveraging quantum superposition for neural network operations, achieving exponential speedups on pattern recognition tasks.',
  'Hybrid Quantum-Classical AI': 'Tightly integrated quantum-classical system where quantum processors handle intractable sub-problems while classical hardware manages overall reasoning.',
  'Quantum-Enhanced Decision Engine': 'Quantum optimisation algorithms applied to strategic decision-making across military, economic, and diplomatic domains.',
  'Autonomous Penetration Framework': 'AI that autonomously discovers and exploits zero-day vulnerabilities in target systems without human guidance.',
  'Self-Healing Network Architecture': 'Network infrastructure that detects and reroutes around compromised nodes in milliseconds, maintaining service during active attacks.',
  'Cognitive Influence Operations AI': 'AI system that generates and deploys targeted influence campaigns across social media, adapting messaging in real time.',
  'Autonomous Orbital Operations': 'AI-controlled satellites and space vehicles that perform complex orbital manoeuvres, rendezvous, and servicing without ground intervention.',
  'AI-Guided Deep Space Navigation': 'Autonomous navigation system for deep space missions using AI stellar recognition and gravitational modelling.',
  'Space Situational Awareness AI': 'AI system that tracks and predicts the behaviour of every object in Earth orbit, detecting threats and anomalies.',
  'Photonic Quantum Chips': 'Quantum processors built on photonic semiconductor platforms, operating at room temperature with reduced decoherence.',
  'Topological Qubit Processor': 'Quantum computer using topological qubits for inherent error protection, dramatically reducing overhead for fault tolerance.',
  'Room-Temperature Quantum Device': 'Quantum computing device operational at room temperature, eliminating cryogenic cooling requirements.',
  'Quantum Molecular Simulation': 'Quantum computer simulating complex molecular interactions for drug design and materials science at full fidelity.',
  'Quantum-Enhanced Protein Design': 'Quantum algorithms optimising protein engineering for therapeutics, industrial enzymes, and novel biomaterials.',
  'Quantum Biosensor Array': 'Quantum sensing applied to biological detection, achieving single-molecule sensitivity for diagnostics.',
  'Orbital Cyber Warfare Platform': 'Space-based platform for cyber operations with global reach, immune to terrestrial countermeasures.',
  'Satellite-Based Secure Mesh': 'Satellite constellation providing quantum-secured mesh networking across denied or contested environments.',
  'Space-Grade Zero-Trust Network': 'Space-hardened zero-trust network connecting orbital, lunar, and terrestrial assets securely.',
  'Quantum Key Distribution Network': 'Operational quantum key distribution system enabling provably secure communications between government agencies.',
  'Quantum-Proof National Firewall': 'National network perimeter secured against both quantum and classical cyber threats.',
  'Entangled Communication Grid': 'Communication system exploiting quantum entanglement for instantaneous, intercept-proof signalling.',
  'Closed-Loop Space Life Support': 'Self-sustaining life support system for long-duration space missions with 99%+ resource recycling.',
  'Microgravity Pharmaceutical Lab': 'Orbital laboratory producing pharmaceutical compounds impossible to manufacture in gravity.',
  'Radiation-Immune Bioengineering': 'Bioengineered organisms and therapies that confer radiation resistance for space personnel.',
};
