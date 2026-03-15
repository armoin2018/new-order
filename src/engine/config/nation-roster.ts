/**
 * Expanded Nation Roster Configuration — FR-4800
 *
 * Defines the 18-nation roster, 9 flashpoints, and bilateral relationship
 * seeds for the expanded game map.
 *
 * All roster tuning is centralised here — no code changes required.
 *
 * @see NFR-204 — All game formulas shall be configurable via constants.
 * @see FR-4801 — Nation roster definitions
 * @see FR-4802 — Regional groupings
 * @see FR-4803 — Alliance eligibility
 * @see FR-4804 — Exchange / currency mapping
 * @see FR-4805 — Default leader assignments
 * @see FR-4806 — Relationship seeds
 * @see FR-4807 — Flashpoint definitions
 */

import type {
  NationRosterEntry,
  FlashpointDefinition,
  ExpandedRelationshipSeed,
} from '@/data/types/nation-roster.types';

// ═══════════════════════════════════════════════════════════════════════════
// Nations                                                         FR-4801
// ═══════════════════════════════════════════════════════════════════════════

const nations: readonly NationRosterEntry[] = [
  // ── Original 8 ────────────────────────────────────────────────────────
  {
    id: 'us',
    displayName: 'United States',
    region: 'North America',
    defaultLeaderId: 'us-president',
    politicalSystem: 'federal-republic',
    exchangeId: 'nyse',
    currencyCode: 'USD',
    allianceEligibility: ['NATO', 'Five Eyes', 'Quad', 'AUKUS', 'USMCA'],
    isOriginal: true,
  },
  {
    id: 'china',
    displayName: 'China',
    region: 'East Asia',
    defaultLeaderId: 'xi-jinping',
    politicalSystem: 'one-party-state',
    exchangeId: 'sse',
    currencyCode: 'CNY',
    allianceEligibility: ['BRICS', 'SCO'],
    isOriginal: true,
  },
  {
    id: 'russia',
    displayName: 'Russia',
    region: 'Eurasia',
    defaultLeaderId: 'vladimir-putin',
    politicalSystem: 'authoritarian-republic',
    exchangeId: 'moex',
    currencyCode: 'RUB',
    allianceEligibility: ['BRICS', 'SCO', 'CSTO'],
    isOriginal: true,
  },
  {
    id: 'japan',
    displayName: 'Japan',
    region: 'East Asia',
    defaultLeaderId: 'fumio-kishida',
    politicalSystem: 'parliamentary-democracy',
    exchangeId: 'tse',
    currencyCode: 'JPY',
    allianceEligibility: ['Quad', 'G7'],
    isOriginal: true,
  },
  {
    id: 'iran',
    displayName: 'Iran',
    region: 'Middle East',
    defaultLeaderId: 'ali-khamenei',
    politicalSystem: 'theocracy',
    exchangeId: 'tse-ir',
    currencyCode: 'IRR',
    allianceEligibility: ['SCO', 'OPEC'],
    isOriginal: true,
  },
  {
    id: 'dprk',
    displayName: 'North Korea',
    region: 'East Asia',
    defaultLeaderId: 'kim-jong-un',
    politicalSystem: 'one-party-state',
    exchangeId: null,
    currencyCode: 'KPW',
    allianceEligibility: [],
    isOriginal: true,
  },
  {
    id: 'eu',
    displayName: 'European Union',
    region: 'Europe',
    defaultLeaderId: 'eu-chancellor',
    politicalSystem: 'liberal-democracy',
    exchangeId: 'euronext',
    currencyCode: 'EUR',
    allianceEligibility: ['NATO', 'G7'],
    isOriginal: true,
  },
  {
    id: 'syria',
    displayName: 'Syria',
    region: 'Middle East',
    defaultLeaderId: 'syria-leader',
    politicalSystem: 'authoritarian-republic',
    exchangeId: 'dse',
    currencyCode: 'SYP',
    allianceEligibility: ['Arab League'],
    isOriginal: true,
  },

  // ── New 10 (FR-4800) ─────────────────────────────────────────────────
  {
    id: 'mexico',
    displayName: 'Mexico',
    region: 'North America',
    defaultLeaderId: 'claudia-sheinbaum',
    politicalSystem: 'federal-republic',
    exchangeId: 'bmv',
    currencyCode: 'MXN',
    allianceEligibility: ['USMCA'],
    isOriginal: false,
  },
  {
    id: 'brazil',
    displayName: 'Brazil',
    region: 'South America',
    defaultLeaderId: 'lula-da-silva',
    politicalSystem: 'federal-republic',
    exchangeId: 'b3',
    currencyCode: 'BRL',
    allianceEligibility: ['BRICS'],
    isOriginal: false,
  },
  {
    id: 'australia',
    displayName: 'Australia',
    region: 'Asia-Pacific',
    defaultLeaderId: 'anthony-albanese',
    politicalSystem: 'parliamentary-democracy',
    exchangeId: 'asx',
    currencyCode: 'AUD',
    allianceEligibility: ['AUKUS', 'Five Eyes', 'Quad'],
    isOriginal: false,
  },
  {
    id: 'taiwan',
    displayName: 'Taiwan',
    region: 'East Asia',
    defaultLeaderId: 'lai-ching-te',
    politicalSystem: 'liberal-democracy',
    exchangeId: 'twse',
    currencyCode: 'TWD',
    allianceEligibility: [],
    isOriginal: false,
  },
  {
    id: 'india',
    displayName: 'India',
    region: 'South Asia',
    defaultLeaderId: 'narendra-modi',
    politicalSystem: 'federal-republic',
    exchangeId: 'bse',
    currencyCode: 'INR',
    allianceEligibility: ['BRICS', 'Quad', 'SCO'],
    isOriginal: false,
  },
  {
    id: 'pakistan',
    displayName: 'Pakistan',
    region: 'South Asia',
    defaultLeaderId: 'asif-ali-zardari',
    politicalSystem: 'federal-republic',
    exchangeId: 'psx-pk',
    currencyCode: 'PKR',
    allianceEligibility: ['SCO'],
    isOriginal: false,
  },
  {
    id: 'afghanistan',
    displayName: 'Afghanistan',
    region: 'Central Asia',
    defaultLeaderId: 'taliban-leadership',
    politicalSystem: 'theocracy',
    exchangeId: null,
    currencyCode: 'AFN',
    allianceEligibility: [],
    isOriginal: false,
  },
  {
    id: 'saudi_arabia',
    displayName: 'Saudi Arabia',
    region: 'Middle East',
    defaultLeaderId: 'mohammed-bin-salman',
    politicalSystem: 'absolute-monarchy',
    exchangeId: 'tadawul',
    currencyCode: 'SAR',
    allianceEligibility: ['OPEC', 'GCC'],
    isOriginal: false,
  },
  {
    id: 'egypt',
    displayName: 'Egypt',
    region: 'North Africa',
    defaultLeaderId: 'abdel-fattah-el-sisi',
    politicalSystem: 'authoritarian-republic',
    exchangeId: 'egx',
    currencyCode: 'EGP',
    allianceEligibility: ['Arab League'],
    isOriginal: false,
  },
  {
    id: 'lebanon',
    displayName: 'Lebanon',
    region: 'Middle East',
    defaultLeaderId: 'lebanon-post-crisis',
    politicalSystem: 'hybrid-regime',
    exchangeId: 'bse-lb',
    currencyCode: 'LBP',
    allianceEligibility: ['Arab League'],
    isOriginal: false,
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Flashpoints                                                     FR-4807
// ═══════════════════════════════════════════════════════════════════════════

const flashpoints: readonly FlashpointDefinition[] = [
  {
    id: 'WS-06',
    name: 'India-Pakistan Kashmir',
    description: 'Escalating tensions over the disputed Kashmir region, with potential nuclear dimensions.',
    primaryNations: ['india', 'pakistan'],
    triggerConditions: ['border-incident', 'terrorism-event', 'diplomatic-failure'],
    escalationStages: ['rhetoric', 'mobilisation', 'border-clash', 'limited-war', 'nuclear-threshold'],
    maxSeverity: 100,
  },
  {
    id: 'WS-07',
    name: 'Taiwan Strait',
    description: 'Cross-strait tensions between China and Taiwan, drawing in US and regional allies.',
    primaryNations: ['china', 'taiwan', 'us', 'japan'],
    triggerConditions: ['independence-declaration', 'military-exercise', 'arms-sale', 'diplomatic-recognition'],
    escalationStages: ['rhetoric', 'grey-zone-ops', 'blockade', 'limited-strike', 'full-invasion'],
    maxSeverity: 100,
  },
  {
    id: 'WS-08',
    name: 'Saudi-Iran Rivalry',
    description: 'Regional proxy competition between Saudi Arabia and Iran across the Middle East.',
    primaryNations: ['saudi_arabia', 'iran'],
    triggerConditions: ['proxy-escalation', 'oil-disruption', 'sectarian-violence', 'nuclear-breakout'],
    escalationStages: ['proxy-competition', 'diplomatic-crisis', 'economic-war', 'direct-confrontation'],
    maxSeverity: 90,
  },
  {
    id: 'WS-09',
    name: 'Egypt-Ethiopia Nile Dam',
    description: 'Dispute over the Grand Ethiopian Renaissance Dam and Nile water rights.',
    primaryNations: ['egypt'],
    triggerConditions: ['dam-filling', 'water-shortage', 'negotiation-collapse'],
    escalationStages: ['diplomatic-dispute', 'economic-pressure', 'cyber-sabotage', 'military-posturing'],
    maxSeverity: 70,
  },
  {
    id: 'WS-10',
    name: 'Lebanon Collapse',
    description: 'Political and economic collapse in Lebanon, with Hezbollah and regional interference.',
    primaryNations: ['lebanon', 'iran', 'syria'],
    triggerConditions: ['economic-default', 'militia-takeover', 'refugee-crisis', 'Israeli-conflict'],
    escalationStages: ['instability', 'humanitarian-crisis', 'civil-conflict', 'regional-spillover'],
    maxSeverity: 80,
  },
  {
    id: 'WS-11',
    name: 'Afghanistan Governance',
    description: 'Taliban governance challenges, terrorism resurgence, and humanitarian catastrophe.',
    primaryNations: ['afghanistan', 'pakistan'],
    triggerConditions: ['famine', 'terrorism-export', 'refugee-wave', 'resistance-uprising'],
    escalationStages: ['humanitarian-crisis', 'regional-destabilisation', 'terrorism-export', 'failed-state'],
    maxSeverity: 75,
  },
  {
    id: 'WS-12',
    name: 'Brazil Amazon',
    description: 'Environmental and sovereignty crisis over Amazon deforestation and climate impact.',
    primaryNations: ['brazil'],
    triggerConditions: ['deforestation-spike', 'climate-sanctions', 'indigenous-conflict', 'sovereignty-dispute'],
    escalationStages: ['environmental-pressure', 'trade-sanctions', 'diplomatic-isolation', 'sovereignty-crisis'],
    maxSeverity: 60,
  },
  {
    id: 'WS-13',
    name: 'Mexico Cartels',
    description: 'Cartel violence threatening state authority and US-Mexico relations.',
    primaryNations: ['mexico', 'us'],
    triggerConditions: ['cartel-escalation', 'border-crisis', 'political-assassination', 'US-intervention-threat'],
    escalationStages: ['criminal-violence', 'state-erosion', 'border-militarisation', 'sovereignty-confrontation'],
    maxSeverity: 75,
  },
  {
    id: 'WS-14',
    name: 'Australia AUKUS',
    description: 'AUKUS submarine programme straining China-Australia relations and Pacific balance.',
    primaryNations: ['australia', 'us', 'china'],
    triggerConditions: ['submarine-delivery', 'South-China-Sea-incident', 'trade-war-escalation'],
    escalationStages: ['diplomatic-tension', 'economic-coercion', 'military-posturing', 'regional-arms-race'],
    maxSeverity: 65,
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Relationship Seeds                                              FR-4806
// ═══════════════════════════════════════════════════════════════════════════

const relationshipSeeds: readonly ExpandedRelationshipSeed[] = [
  // ── India / Pakistan cluster ──────────────────────────────────────────
  { nation1: 'india', nation2: 'pakistan', initialTension: 75, description: 'Kashmir dispute and nuclear rivalry' },
  { nation1: 'india', nation2: 'china', initialTension: 45, description: 'Border disputes and strategic competition' },
  { nation1: 'india', nation2: 'us', initialTension: -30, description: 'Growing strategic partnership via Quad' },
  { nation1: 'india', nation2: 'russia', initialTension: -25, description: 'Legacy defence and diplomatic ties' },
  { nation1: 'pakistan', nation2: 'china', initialTension: -40, description: 'CPEC and all-weather friendship' },
  { nation1: 'pakistan', nation2: 'afghanistan', initialTension: 50, description: 'Durand Line and Taliban spillover' },
  { nation1: 'pakistan', nation2: 'us', initialTension: 30, description: 'Strained counter-terrorism partnership' },

  // ── Taiwan cluster ────────────────────────────────────────────────────
  { nation1: 'taiwan', nation2: 'china', initialTension: 80, description: 'Cross-strait sovereignty dispute' },
  { nation1: 'taiwan', nation2: 'us', initialTension: -50, description: 'Unofficial defence partnership' },
  { nation1: 'taiwan', nation2: 'japan', initialTension: -35, description: 'Shared maritime security interests' },

  // ── Saudi Arabia / Iran cluster ───────────────────────────────────────
  { nation1: 'saudi_arabia', nation2: 'iran', initialTension: 70, description: 'Sectarian and regional proxy rivalry' },
  { nation1: 'saudi_arabia', nation2: 'us', initialTension: -20, description: 'Strategic energy and defence partnership' },
  { nation1: 'saudi_arabia', nation2: 'egypt', initialTension: -15, description: 'Sunni Arab alliance coordination' },
  { nation1: 'saudi_arabia', nation2: 'china', initialTension: -10, description: 'Growing energy trade relationship' },

  // ── Egypt cluster ─────────────────────────────────────────────────────
  { nation1: 'egypt', nation2: 'us', initialTension: -15, description: 'Military aid and Camp David framework' },
  { nation1: 'egypt', nation2: 'iran', initialTension: 25, description: 'Regional influence competition' },
  { nation1: 'egypt', nation2: 'eu', initialTension: -10, description: 'Migration management partnership' },

  // ── Lebanon cluster ───────────────────────────────────────────────────
  { nation1: 'lebanon', nation2: 'iran', initialTension: -30, description: 'Iran-Hezbollah axis influence' },
  { nation1: 'lebanon', nation2: 'syria', initialTension: 40, description: 'Post-occupation complex relations' },
  { nation1: 'lebanon', nation2: 'saudi_arabia', initialTension: 20, description: 'Political faction sponsorship' },

  // ── Afghanistan cluster ───────────────────────────────────────────────
  { nation1: 'afghanistan', nation2: 'us', initialTension: 60, description: 'Post-withdrawal frozen relations' },
  { nation1: 'afghanistan', nation2: 'china', initialTension: -5, description: 'Tentative mineral extraction interest' },
  { nation1: 'afghanistan', nation2: 'iran', initialTension: 15, description: 'Water disputes and refugee tension' },

  // ── Mexico cluster ────────────────────────────────────────────────────
  { nation1: 'mexico', nation2: 'us', initialTension: 25, description: 'Trade dependency and border tension' },
  { nation1: 'mexico', nation2: 'china', initialTension: 5, description: 'Fentanyl precursor trade friction' },

  // ── Brazil cluster ────────────────────────────────────────────────────
  { nation1: 'brazil', nation2: 'us', initialTension: 10, description: 'Amazon sovereignty and trade balance' },
  { nation1: 'brazil', nation2: 'china', initialTension: -20, description: 'BRICS partnership and commodity trade' },
  { nation1: 'brazil', nation2: 'russia', initialTension: -10, description: 'BRICS diplomatic alignment' },
  { nation1: 'brazil', nation2: 'eu', initialTension: 5, description: 'Mercosur-EU trade negotiations' },

  // ── Australia cluster ─────────────────────────────────────────────────
  { nation1: 'australia', nation2: 'china', initialTension: 55, description: 'Trade war and AUKUS friction' },
  { nation1: 'australia', nation2: 'us', initialTension: -55, description: 'AUKUS and Five Eyes cornerstone ally' },
  { nation1: 'australia', nation2: 'japan', initialTension: -30, description: 'Quad partnership and defence cooperation' },
  { nation1: 'australia', nation2: 'india', initialTension: -20, description: 'Quad and Indo-Pacific alignment' },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Exported config                                                 FR-4800
// ═══════════════════════════════════════════════════════════════════════════

export const nationRosterConfig = {
  nations,
  flashpoints,
  relationshipSeeds,
} as const;
