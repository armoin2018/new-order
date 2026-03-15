/**
 * Web State Gathering Configuration — FR-4300 (DR-190)
 *
 * Default directory layout, dimension metadata, search terms, data sources,
 * and application mode descriptions for the web gathering engine.
 *
 * All web-gathering tuning is centralised here — no code changes required.
 *
 * @see NFR-204  — All game formulas shall be configurable via constants.
 * @see FR-4301  — Settings panel for AI-powered web state gathering
 * @see FR-4302  — Enrichment model file format
 * @see FR-4303  — Dimension-specific gathering
 * @see FR-4304  — Apply gathered data to active scenarios
 * @see DR-190   — Enrichment model file format
 */

export const webGatheringConfig = {
  /**
   * Root directory under the user's home for enrichment models.
   * Sub-folders per dimension: `{modelDirectory}/{dimension}/{description}.json`
   * @see FR-4302, DR-190
   */
  modelDirectory: '~/.newOrder/models',

  /** Maximum enrichment models stored per dimension before pruning. */
  maxModelsPerDimension: 50,

  /** Default max results returned per gathering query. */
  defaultMaxResults: 10,

  /**
   * Minimum confidence score (0–1) for a data point to be included.
   * Points below this threshold are discarded during processing.
   */
  confidenceThreshold: 0.3,

  // ── Per-dimension metadata & defaults ───────────────────────────────────

  /** @see FR-4303 */
  dimensions: {
    economic: {
      label: 'Economic',
      description: 'Macroeconomic indicators, trade data, and financial metrics',
      defaultSearchTerms: [
        'GDP growth',
        'inflation rates',
        'trade balance',
        'unemployment rate',
        'central bank interest rate',
        'sovereign debt levels',
      ],
      defaultDataSources: [
        {
          name: 'World Bank',
          url: 'https://data.worldbank.org',
          description: 'Global economic indicators and development data',
          enabled: true,
        },
        {
          name: 'IMF',
          url: 'https://www.imf.org/en/Data',
          description: 'International monetary and fiscal data',
          enabled: true,
        },
        {
          name: 'Trading Economics',
          url: 'https://tradingeconomics.com',
          description: 'Real-time economic indicators by country',
          enabled: true,
        },
      ],
    },
    military: {
      label: 'Military',
      description: 'Defense capabilities, deployments, and military spending',
      defaultSearchTerms: [
        'military deployment',
        'defense spending',
        'arms procurement',
        'military exercises',
        'force readiness',
        'weapons systems development',
      ],
      defaultDataSources: [
        {
          name: 'SIPRI',
          url: 'https://www.sipri.org',
          description: 'Arms transfers and military expenditure database',
          enabled: true,
        },
        {
          name: 'IISS',
          url: 'https://www.iiss.org',
          description: 'Military balance and strategic assessments',
          enabled: true,
        },
        {
          name: 'Jane\'s Defence',
          url: 'https://www.janes.com',
          description: 'Defence intelligence and analysis',
          enabled: true,
        },
      ],
    },
    political: {
      label: 'Political',
      description: 'Elections, governance changes, and political stability',
      defaultSearchTerms: [
        'elections',
        'political crisis',
        'government formation',
        'regime stability',
        'protest movements',
        'constitutional reform',
      ],
      defaultDataSources: [
        {
          name: 'Freedom House',
          url: 'https://freedomhouse.org',
          description: 'Freedom and democracy indices worldwide',
          enabled: true,
        },
        {
          name: 'V-Dem Institute',
          url: 'https://www.v-dem.net',
          description: 'Varieties of democracy data',
          enabled: true,
        },
        {
          name: 'ACLED',
          url: 'https://acleddata.com',
          description: 'Armed conflict and political violence data',
          enabled: true,
        },
      ],
    },
    technology: {
      label: 'Technology',
      description: 'Emerging tech, R&D, and technology competition',
      defaultSearchTerms: [
        'AI development',
        'semiconductor production',
        'quantum computing',
        'cyber capabilities',
        'space technology',
        'biotech advances',
      ],
      defaultDataSources: [
        {
          name: 'OECD Science & Tech',
          url: 'https://www.oecd.org/science',
          description: 'Science, technology, and innovation statistics',
          enabled: true,
        },
        {
          name: 'ASPI Critical Tech Tracker',
          url: 'https://www.aspi.org.au/report/critical-technology-tracker',
          description: 'Critical technology leadership tracking',
          enabled: true,
        },
        {
          name: 'Semiconductor Industry Association',
          url: 'https://www.semiconductors.org',
          description: 'Semiconductor market data and policy',
          enabled: true,
        },
      ],
    },
    diplomatic: {
      label: 'Diplomatic',
      description: 'Treaties, alliances, sanctions, and diplomatic relations',
      defaultSearchTerms: [
        'treaty',
        'alliance',
        'sanctions',
        'diplomatic relations',
        'international agreements',
        'UN resolutions',
      ],
      defaultDataSources: [
        {
          name: 'UN Treaty Collection',
          url: 'https://treaties.un.org',
          description: 'International treaties and agreements database',
          enabled: true,
        },
        {
          name: 'Council on Foreign Relations',
          url: 'https://www.cfr.org',
          description: 'Foreign policy analysis and global affairs',
          enabled: true,
        },
        {
          name: 'Crisis Group',
          url: 'https://www.crisisgroup.org',
          description: 'Conflict prevention and diplomatic analysis',
          enabled: true,
        },
      ],
    },
  },

  // ── Application mode metadata ──────────────────────────────────────────

  /** @see FR-4304 */
  applicationModes: {
    initialConditions: {
      label: 'Initial Conditions',
      description:
        'Update the starting conditions of a scenario with real-world data before the game begins',
    },
    midGameEvent: {
      label: 'Mid-Game Event',
      description:
        'Inject gathered data as an event during an ongoing game turn',
    },
    scenarioPreset: {
      label: 'Scenario Preset',
      description:
        'Create a reusable scenario preset from the gathered enrichment data',
    },
  },
} as const;
