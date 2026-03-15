/**
 * Default National Policies — FR-5200
 *
 * Country-specific policy catalogs with cross-dimensional impacts.
 * Every nation starts with a curated set of active policies that reflect
 * real-world governance priorities and affect stability, economy, military,
 * diplomacy, technology, and popular approval.
 *
 * Each policy is a {@link PolicyModel} ready to be proposed + enacted.
 *
 * @see FR-5200  — National Policy System
 * @see DR-213   — Policy model shape
 * @see NFR-204  — All formulas via constants
 */

import type { PolicyModel } from '@/data/types/policy.types';

// ═══════════════════════════════════════════════════════════════════════════
// Helper — build a PolicyModel with sensible defaults
// ═══════════════════════════════════════════════════════════════════════════

function p(
  policyId: string,
  name: string,
  description: string,
  scope: PolicyModel['scope'],
  dimensionalImpacts: PolicyModel['dimensionalImpacts'],
  opts: Partial<Pick<PolicyModel, 'costPerTurn' | 'duration' | 'prerequisites'>> = {},
): PolicyModel {
  return {
    policyId,
    name,
    description,
    scope,
    targetEntities: scope === 'domestic' ? ['domestic'] : [],
    dimensionalImpacts,
    prerequisites: opts.prerequisites ?? [],
    costPerTurn: opts.costPerTurn ?? 5,
    duration: opts.duration ?? null,
    effectivenessCurve: [0.3, 0.5, 0.7, 0.85, 0.95, 1.0],
    narrativeContext: description,
    createdBy: 'event',
    createdAtTurn: null,
    proposalReason: 'Default national policy',
    aiConfidence: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// United States
// ═══════════════════════════════════════════════════════════════════════════

const US_POLICIES: PolicyModel[] = [
  p('us-defense-spending', 'Defense Authorization Act', 'Maintains global force projection through sustained defense spending at ~3.5% GDP, funding carrier groups, forward bases, and R&D.', 'domestic', [
    { dimension: 'military', magnitude: 8, timelineTurns: 0, description: 'Sustained high military readiness' },
    { dimension: 'technology', magnitude: 4, timelineTurns: 0, description: 'Defense R&D spillover into civilian tech' },
    { dimension: 'treasury', magnitude: -12, timelineTurns: 0, description: 'Significant budget allocation' },
    { dimension: 'stability', magnitude: 2, timelineTurns: 0, description: 'Security apparatus deters domestic threats' },
  ], { costPerTurn: 18 }),

  p('us-fed-reserve', 'Federal Reserve Monetary Policy', 'Independent central bank managing interest rates, inflation targeting at 2%, and quantitative tools to stabilize the economy.', 'domestic', [
    { dimension: 'treasury', magnitude: 6, timelineTurns: 0, description: 'Monetary stability supports growth' },
    { dimension: 'stability', magnitude: 3, timelineTurns: 0, description: 'Predictable monetary policy reduces uncertainty' },
    { dimension: 'popularity', magnitude: -1, timelineTurns: 0, description: 'Rate hikes unpopular with borrowers' },
  ], { costPerTurn: 2 }),

  p('us-nato-commitment', 'NATO Collective Defense', 'Article 5 mutual defense commitment binding the US to European and global alliance network, projecting power through partnership.', 'multilateral', [
    { dimension: 'diplomatic', magnitude: 10, timelineTurns: 0, description: 'Alliance network strengthens global standing' },
    { dimension: 'military', magnitude: 3, timelineTurns: 0, description: 'Interoperability and intelligence sharing' },
    { dimension: 'treasury', magnitude: -6, timelineTurns: 0, description: 'Alliance maintenance costs' },
    { dimension: 'popularity', magnitude: -2, timelineTurns: 0, description: 'Foreign entanglement concerns' },
  ], { costPerTurn: 8 }),

  p('us-tech-export-controls', 'Technology Export Control Regime', 'Restricts export of advanced semiconductors, AI systems, and dual-use technology to adversaries through the Entity List and BIS controls.', 'multilateral', [
    { dimension: 'technology', magnitude: 5, timelineTurns: 0, description: 'Maintains tech advantage over rivals' },
    { dimension: 'diplomatic', magnitude: -3, timelineTurns: 0, description: 'Friction with trading partners' },
    { dimension: 'treasury', magnitude: -2, timelineTurns: 0, description: 'Lost export revenue' },
  ], { costPerTurn: 3 }),

  p('us-social-safety-net', 'Social Safety Net Programs', 'Medicare, Social Security, unemployment insurance, and SNAP — providing baseline support that prevents domestic instability.', 'domestic', [
    { dimension: 'stability', magnitude: 6, timelineTurns: 0, description: 'Reduces poverty-driven unrest' },
    { dimension: 'popularity', magnitude: 7, timelineTurns: 0, description: 'Broadly popular entitlement programs' },
    { dimension: 'treasury', magnitude: -15, timelineTurns: 0, description: 'Largest budget category' },
  ], { costPerTurn: 20 }),

  p('us-immigration-policy', 'Managed Immigration System', 'H-1B visa program, border security, and asylum processing balancing labor needs with security concerns.', 'domestic', [
    { dimension: 'technology', magnitude: 3, timelineTurns: 0, description: 'Skilled immigration fuels innovation' },
    { dimension: 'treasury', magnitude: 2, timelineTurns: 0, description: 'Labor force expansion grows tax base' },
    { dimension: 'stability', magnitude: -2, timelineTurns: 0, description: 'Border security tensions' },
    { dimension: 'popularity', magnitude: -3, timelineTurns: 0, description: 'Politically divisive issue' },
  ], { costPerTurn: 4 }),
];

// ═══════════════════════════════════════════════════════════════════════════
// China
// ═══════════════════════════════════════════════════════════════════════════

const CHINA_POLICIES: PolicyModel[] = [
  p('cn-five-year-plan', 'Five-Year Development Plan', 'Centrally directed economic strategy targeting advanced manufacturing, semiconductor self-sufficiency, and AI leadership with massive state investment.', 'domestic', [
    { dimension: 'technology', magnitude: 9, timelineTurns: 0, description: 'State-directed tech advancement' },
    { dimension: 'treasury', magnitude: 5, timelineTurns: 0, description: 'Industrial policy drives GDP growth' },
    { dimension: 'stability', magnitude: 3, timelineTurns: 0, description: 'Employment through state projects' },
    { dimension: 'popularity', magnitude: 2, timelineTurns: 0, description: 'Economic growth validates party rule' },
  ], { costPerTurn: 15 }),

  p('cn-social-credit', 'Social Credit System', 'Comprehensive surveillance and behavioral scoring system enforcing social compliance through algorithmic governance.', 'domestic', [
    { dimension: 'stability', magnitude: 8, timelineTurns: 0, description: 'Suppresses dissent and crime' },
    { dimension: 'popularity', magnitude: -5, timelineTurns: 0, description: 'Civil liberties restrictions breed resentment' },
    { dimension: 'technology', magnitude: 2, timelineTurns: 0, description: 'AI/surveillance tech development' },
    { dimension: 'diplomatic', magnitude: -4, timelineTurns: 0, description: 'International criticism of human rights' },
  ], { costPerTurn: 8 }),

  p('cn-belt-and-road', 'Belt & Road Initiative', 'Global infrastructure investment creating economic dependencies through ports, railways, and digital networks across 140+ countries.', 'multilateral', [
    { dimension: 'diplomatic', magnitude: 10, timelineTurns: 0, description: 'Debt diplomacy expands influence' },
    { dimension: 'treasury', magnitude: -8, timelineTurns: 0, description: 'Massive overseas investment' },
    { dimension: 'military', magnitude: 3, timelineTurns: 0, description: 'Dual-use port access globally' },
    { dimension: 'technology', magnitude: 2, timelineTurns: 0, description: '5G/digital silk road deployment' },
  ], { costPerTurn: 12 }),

  p('cn-military-modernization', 'PLA Modernization Program', 'Rapid military modernization targeting force projection in the Western Pacific through carrier development, hypersonics, and cyber capabilities.', 'domestic', [
    { dimension: 'military', magnitude: 10, timelineTurns: 0, description: 'Force structure modernization' },
    { dimension: 'technology', magnitude: 3, timelineTurns: 0, description: 'Military-civil fusion innovation' },
    { dimension: 'treasury', magnitude: -10, timelineTurns: 0, description: 'Growing defense budget' },
    { dimension: 'diplomatic', magnitude: -3, timelineTurns: 0, description: 'Regional threat perception increases' },
  ], { costPerTurn: 14 }),

  p('cn-great-firewall', 'Great Firewall & Information Control', 'Internet censorship and media control maintaining the party narrative while fostering domestic tech ecosystem (Baidu, WeChat, Alibaba).', 'domestic', [
    { dimension: 'stability', magnitude: 6, timelineTurns: 0, description: 'Controls information flow' },
    { dimension: 'technology', magnitude: 4, timelineTurns: 0, description: 'Protected domestic tech champions' },
    { dimension: 'popularity', magnitude: -3, timelineTurns: 0, description: 'Youth frustrated by censorship' },
    { dimension: 'diplomatic', magnitude: -2, timelineTurns: 0, description: 'International press freedom criticism' },
  ], { costPerTurn: 6 }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Russia
// ═══════════════════════════════════════════════════════════════════════════

const RUSSIA_POLICIES: PolicyModel[] = [
  p('ru-nuclear-deterrent', 'Nuclear Triad Maintenance', 'Maintaining strategic nuclear parity through modernized ICBMs (Sarmat), submarine-launched missiles, and strategic bombers.', 'domestic', [
    { dimension: 'military', magnitude: 10, timelineTurns: 0, description: 'Strategic nuclear deterrence' },
    { dimension: 'diplomatic', magnitude: 4, timelineTurns: 0, description: 'Great power status maintenance' },
    { dimension: 'treasury', magnitude: -12, timelineTurns: 0, description: 'Expensive modernization program' },
    { dimension: 'technology', magnitude: 2, timelineTurns: 0, description: 'Hypersonic and missile tech advances' },
  ], { costPerTurn: 14 }),

  p('ru-energy-leverage', 'Energy Export Strategy', 'Using oil and gas exports as geopolitical leverage through Gazprom, Rosneft, and pipeline politics (Nord Stream, TurkStream, Power of Siberia).', 'multilateral', [
    { dimension: 'treasury', magnitude: 12, timelineTurns: 0, description: 'Hydrocarbon export revenue' },
    { dimension: 'diplomatic', magnitude: 6, timelineTurns: 0, description: 'Energy dependence creates leverage' },
    { dimension: 'stability', magnitude: 3, timelineTurns: 0, description: 'Resource wealth funds state services' },
    { dimension: 'technology', magnitude: -3, timelineTurns: 0, description: 'Resource curse inhibits diversification' },
  ], { costPerTurn: 5 }),

  p('ru-security-services', 'FSB Domestic Security Apparatus', 'Comprehensive internal security through FSB, Rosgvardiya, and media control maintaining regime stability.', 'domestic', [
    { dimension: 'stability', magnitude: 8, timelineTurns: 0, description: 'Suppresses opposition movements' },
    { dimension: 'popularity', magnitude: -4, timelineTurns: 0, description: 'Political repression breeds quiet resentment' },
    { dimension: 'diplomatic', magnitude: -5, timelineTurns: 0, description: 'Sanctions and international condemnation' },
    { dimension: 'treasury', magnitude: -4, timelineTurns: 0, description: 'Security apparatus costs' },
  ], { costPerTurn: 7 }),

  p('ru-import-substitution', 'Import Substitution Program', 'Sanctions-driven domestic production initiative replacing Western technology and goods with Russian alternatives.', 'domestic', [
    { dimension: 'technology', magnitude: 3, timelineTurns: 0, description: 'Forced indigenous development' },
    { dimension: 'treasury', magnitude: -3, timelineTurns: 0, description: 'Subsidies for domestic production' },
    { dimension: 'stability', magnitude: 2, timelineTurns: 0, description: 'Reduced foreign dependency' },
    { dimension: 'popularity', magnitude: 1, timelineTurns: 0, description: 'Nationalistic self-reliance narrative' },
  ], { costPerTurn: 6 }),

  p('ru-conscription', 'Military Conscription System', 'Mandatory 12-month military service for males 18-27, maintaining large reserve force pool at lower cost than professional military.', 'domestic', [
    { dimension: 'military', magnitude: 5, timelineTurns: 0, description: 'Large manpower reserve' },
    { dimension: 'popularity', magnitude: -6, timelineTurns: 0, description: 'Deeply unpopular with families' },
    { dimension: 'treasury', magnitude: 3, timelineTurns: 0, description: 'Cheaper than all-volunteer force' },
    { dimension: 'stability', magnitude: -2, timelineTurns: 0, description: 'Draft-related protests and evasion' },
  ], { costPerTurn: 3 }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Japan
// ═══════════════════════════════════════════════════════════════════════════

const JAPAN_POLICIES: PolicyModel[] = [
  p('jp-us-alliance', 'US-Japan Security Treaty', 'Cornerstone alliance providing nuclear umbrella and joint defense operations while hosting US bases in Okinawa and mainland.', 'bilateral', [
    { dimension: 'military', magnitude: 7, timelineTurns: 0, description: 'US security guarantee' },
    { dimension: 'diplomatic', magnitude: 8, timelineTurns: 0, description: 'Western alliance solidarity' },
    { dimension: 'treasury', magnitude: -4, timelineTurns: 0, description: 'Host nation support costs' },
    { dimension: 'popularity', magnitude: -2, timelineTurns: 0, description: 'Base-hosting controversies in Okinawa' },
  ], { costPerTurn: 6 }),

  p('jp-article-nine', 'Article 9 Reinterpretation', 'Gradual reinterpretation of the pacifist constitution to allow collective self-defense, counter-strike capability, and increased defense spending.', 'domestic', [
    { dimension: 'military', magnitude: 5, timelineTurns: 0, description: 'Expanded self-defense capabilities' },
    { dimension: 'diplomatic', magnitude: -2, timelineTurns: 0, description: 'Regional concern from China/Korea' },
    { dimension: 'popularity', magnitude: -3, timelineTurns: 0, description: 'Pacifist constituency opposes changes' },
    { dimension: 'stability', magnitude: 2, timelineTurns: 0, description: 'Improved homeland defense posture' },
  ], { costPerTurn: 5 }),

  p('jp-tech-innovation', 'Society 5.0 Technology Strategy', 'National strategy integrating robotics, AI, IoT, and quantum computing into a hyper-connected society addressing aging demographics.', 'domestic', [
    { dimension: 'technology', magnitude: 10, timelineTurns: 0, description: 'World-leading tech R&D investment' },
    { dimension: 'treasury', magnitude: 3, timelineTurns: 0, description: 'Productivity gains from automation' },
    { dimension: 'stability', magnitude: 3, timelineTurns: 0, description: 'Addresses labor shortage via robotics' },
    { dimension: 'popularity', magnitude: 2, timelineTurns: 0, description: 'Tech optimism in society' },
  ], { costPerTurn: 10 }),

  p('jp-trade-partnerships', 'Free Trade Agreement Network', 'CPTPP leadership and bilateral trade agreements maintaining export-driven economic model for automotive, electronics, and machinery.', 'multilateral', [
    { dimension: 'treasury', magnitude: 8, timelineTurns: 0, description: 'Export-driven economic growth' },
    { dimension: 'diplomatic', magnitude: 6, timelineTurns: 0, description: 'Trade-based soft power' },
    { dimension: 'popularity', magnitude: 1, timelineTurns: 0, description: 'Economic prosperity' },
    { dimension: 'stability', magnitude: 2, timelineTurns: 0, description: 'Economic interdependence reduces conflict' },
  ], { costPerTurn: 4 }),

  p('jp-aging-society', 'Aging Society Support Program', 'Comprehensive eldercare, pension reform, and immigration relaxation to address the world\'s oldest population (29% over 65).', 'domestic', [
    { dimension: 'stability', magnitude: 4, timelineTurns: 0, description: 'Social cohesion through care' },
    { dimension: 'popularity', magnitude: 5, timelineTurns: 0, description: 'Popular with aging electorate' },
    { dimension: 'treasury', magnitude: -10, timelineTurns: 0, description: 'Massive pension and healthcare costs' },
    { dimension: 'technology', magnitude: 2, timelineTurns: 0, description: 'Caregiving robotics development' },
  ], { costPerTurn: 12 }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Iran
// ═══════════════════════════════════════════════════════════════════════════

const IRAN_POLICIES: PolicyModel[] = [
  p('ir-nuclear-program', 'Nuclear Development Program', 'Uranium enrichment and nuclear research program positioned as civilian energy while maintaining breakout capability.', 'domestic', [
    { dimension: 'technology', magnitude: 6, timelineTurns: 0, description: 'Nuclear and missile tech advancement' },
    { dimension: 'military', magnitude: 5, timelineTurns: 0, description: 'Deterrence through ambiguity' },
    { dimension: 'diplomatic', magnitude: -8, timelineTurns: 0, description: 'International sanctions and isolation' },
    { dimension: 'treasury', magnitude: -6, timelineTurns: 0, description: 'Sanctions impact and program costs' },
  ], { costPerTurn: 8 }),

  p('ir-revolutionary-guard', 'IRGC Economic-Military Complex', 'Islamic Revolutionary Guard Corps controlling both military operations and significant economic interests including construction and oil.', 'domestic', [
    { dimension: 'military', magnitude: 8, timelineTurns: 0, description: 'Parallel military with regime loyalty' },
    { dimension: 'stability', magnitude: 6, timelineTurns: 0, description: 'Regime protection force' },
    { dimension: 'treasury', magnitude: -3, timelineTurns: 0, description: 'IRGC economic extraction' },
    { dimension: 'popularity', magnitude: -5, timelineTurns: 0, description: 'Repression of protests' },
  ], { costPerTurn: 7 }),

  p('ir-proxy-network', 'Regional Proxy Network', 'Funding and arming Hezbollah, Hamas, Houthis, and Iraqi militias to project power across the Middle East without direct confrontation.', 'multilateral', [
    { dimension: 'diplomatic', magnitude: 4, timelineTurns: 0, description: 'Regional influence through proxies' },
    { dimension: 'military', magnitude: 4, timelineTurns: 0, description: 'Asymmetric force projection' },
    { dimension: 'treasury', magnitude: -5, timelineTurns: 0, description: 'Proxy funding costs' },
    { dimension: 'popularity', magnitude: -3, timelineTurns: 0, description: 'Domestic criticism of foreign spending' },
    { dimension: 'stability', magnitude: -2, timelineTurns: 0, description: 'Risk of retaliation on homeland' },
  ], { costPerTurn: 6 }),

  p('ir-oil-subsidy', 'Domestic Fuel Subsidies', 'Heavy subsidies on gasoline, bread, and basic goods keeping prices artificially low for the population despite sanctions pressure.', 'domestic', [
    { dimension: 'popularity', magnitude: 6, timelineTurns: 0, description: 'Subsidized goods prevent unrest' },
    { dimension: 'stability', magnitude: 4, timelineTurns: 0, description: 'Basic needs met despite sanctions' },
    { dimension: 'treasury', magnitude: -8, timelineTurns: 0, description: 'Enormous subsidy bill' },
    { dimension: 'technology', magnitude: -2, timelineTurns: 0, description: 'Discourages economic modernization' },
  ], { costPerTurn: 10 }),

  p('ir-theocratic-governance', 'Supreme Leader Authority', 'Velayat-e faqih system with Guardian Council vetting candidates and Supreme Leader holding ultimate authority over military and foreign policy.', 'domestic', [
    { dimension: 'stability', magnitude: 5, timelineTurns: 0, description: 'Centralized authority prevents fragmentation' },
    { dimension: 'popularity', magnitude: -7, timelineTurns: 0, description: 'Youth-driven opposition to theocracy' },
    { dimension: 'diplomatic', magnitude: -3, timelineTurns: 0, description: 'Ideological governance limits pragmatism' },
    { dimension: 'military', magnitude: 3, timelineTurns: 0, description: 'Clergy-military alignment' },
  ], { costPerTurn: 3 }),
];

// ═══════════════════════════════════════════════════════════════════════════
// North Korea (DPRK)
// ═══════════════════════════════════════════════════════════════════════════

const DPRK_POLICIES: PolicyModel[] = [
  p('kp-nuclear-weapons', 'Nuclear Weapons Program', 'Operational nuclear arsenal with ICBM delivery systems providing regime survival guarantee through mutual assured destruction.', 'domestic', [
    { dimension: 'military', magnitude: 10, timelineTurns: 0, description: 'Nuclear deterrent ensures survival' },
    { dimension: 'diplomatic', magnitude: -8, timelineTurns: 0, description: 'Global isolation and sanctions' },
    { dimension: 'treasury', magnitude: -10, timelineTurns: 0, description: 'Massive budget share for weapons' },
    { dimension: 'stability', magnitude: 5, timelineTurns: 0, description: 'Regime security through deterrence' },
  ], { costPerTurn: 12 }),

  p('kp-juche-economy', 'Juche Self-Reliance Doctrine', 'Autarkic economic policy minimizing foreign dependency through domestic production, though resulting in chronic shortages and stagnation.', 'domestic', [
    { dimension: 'stability', magnitude: 3, timelineTurns: 0, description: 'Ideological cohesion' },
    { dimension: 'treasury', magnitude: -5, timelineTurns: 0, description: 'Economic stagnation from isolation' },
    { dimension: 'technology', magnitude: -5, timelineTurns: 0, description: 'Cut off from global innovation' },
    { dimension: 'popularity', magnitude: -4, timelineTurns: 0, description: 'Material deprivation' },
  ], { costPerTurn: 2 }),

  p('kp-military-first', 'Songun Military-First Policy', 'Military prioritized in resource allocation over civilian economy — the Korean People\'s Army receives food, fuel, and funds before the population.', 'domestic', [
    { dimension: 'military', magnitude: 8, timelineTurns: 0, description: 'Oversized military for population' },
    { dimension: 'popularity', magnitude: -6, timelineTurns: 0, description: 'Civilian deprivation for military' },
    { dimension: 'treasury', magnitude: -4, timelineTurns: 0, description: 'Disproportionate military spending' },
    { dimension: 'stability', magnitude: 3, timelineTurns: 0, description: 'Military loyalty to regime' },
  ], { costPerTurn: 8 }),

  p('kp-propaganda', 'State Propaganda & Personality Cult', 'Total information control through state media, mandatory political education, and deification of the Kim dynasty.', 'domestic', [
    { dimension: 'stability', magnitude: 7, timelineTurns: 0, description: 'Total ideological control' },
    { dimension: 'popularity', magnitude: 2, timelineTurns: 0, description: 'Manufactured consent' },
    { dimension: 'technology', magnitude: -3, timelineTurns: 0, description: 'Information isolation inhibits progress' },
    { dimension: 'diplomatic', magnitude: -4, timelineTurns: 0, description: 'Global pariah status' },
  ], { costPerTurn: 3 }),

  p('kp-cyber-warfare', 'Bureau 121 Cyber Operations', 'State-sponsored hacking operations generating revenue through cryptocurrency theft and conducting espionage and disruption campaigns.', 'multilateral', [
    { dimension: 'treasury', magnitude: 4, timelineTurns: 0, description: 'Crypto theft revenue stream' },
    { dimension: 'military', magnitude: 3, timelineTurns: 0, description: 'Asymmetric warfare capability' },
    { dimension: 'technology', magnitude: 4, timelineTurns: 0, description: 'Cyber capability development' },
    { dimension: 'diplomatic', magnitude: -5, timelineTurns: 0, description: 'Attribution leads to further sanctions' },
  ], { costPerTurn: 2 }),
];

// ═══════════════════════════════════════════════════════════════════════════
// European Union
// ═══════════════════════════════════════════════════════════════════════════

const EU_POLICIES: PolicyModel[] = [
  p('eu-single-market', 'Single Market & Customs Union', 'Free movement of goods, services, capital, and people across 27 member states creating the world\'s largest single market.', 'multilateral', [
    { dimension: 'treasury', magnitude: 10, timelineTurns: 0, description: 'Trade integration drives growth' },
    { dimension: 'diplomatic', magnitude: 8, timelineTurns: 0, description: 'Economic bloc leverage in trade' },
    { dimension: 'stability', magnitude: 3, timelineTurns: 0, description: 'Economic interdependence builds peace' },
    { dimension: 'popularity', magnitude: 2, timelineTurns: 0, description: 'Prosperity from free movement' },
  ], { costPerTurn: 8 }),

  p('eu-gdpr-regulation', 'GDPR & Digital Regulation', 'Comprehensive data protection and digital market regulation setting global standards through the Brussels Effect.', 'multilateral', [
    { dimension: 'diplomatic', magnitude: 5, timelineTurns: 0, description: 'Regulatory soft power (Brussels Effect)' },
    { dimension: 'technology', magnitude: -2, timelineTurns: 0, description: 'Compliance burden slows innovation' },
    { dimension: 'popularity', magnitude: 4, timelineTurns: 0, description: 'Privacy protection popular with citizens' },
    { dimension: 'stability', magnitude: 2, timelineTurns: 0, description: 'Trust in digital economy' },
  ], { costPerTurn: 4 }),

  p('eu-green-deal', 'European Green Deal', 'Climate neutrality target by 2050 through carbon border adjustment, renewable energy mandates, and industrial decarbonization.', 'multilateral', [
    { dimension: 'technology', magnitude: 6, timelineTurns: 0, description: 'Green technology innovation' },
    { dimension: 'diplomatic', magnitude: 5, timelineTurns: 0, description: 'Climate leadership credibility' },
    { dimension: 'treasury', magnitude: -8, timelineTurns: 0, description: 'Transition costs and subsidies' },
    { dimension: 'popularity', magnitude: 3, timelineTurns: 0, description: 'Youth support for climate action' },
    { dimension: 'stability', magnitude: -2, timelineTurns: 0, description: 'Industrial transition disruption' },
  ], { costPerTurn: 10 }),

  p('eu-common-defense', 'Common Security & Defense Policy', 'EU rapid reaction force, joint procurement, and defense industrial consolidation reducing dependency on US security umbrella.', 'multilateral', [
    { dimension: 'military', magnitude: 5, timelineTurns: 0, description: 'Joint defense capability building' },
    { dimension: 'diplomatic', magnitude: 4, timelineTurns: 0, description: 'Strategic autonomy signaling' },
    { dimension: 'treasury', magnitude: -6, timelineTurns: 0, description: 'Defense spending increase' },
    { dimension: 'popularity', magnitude: -1, timelineTurns: 0, description: 'Mixed support for militarization' },
  ], { costPerTurn: 7 }),

  p('eu-social-model', 'European Social Model', 'Universal healthcare, strong labor protections, generous parental leave, and education funding creating high quality of life across the bloc.', 'domestic', [
    { dimension: 'popularity', magnitude: 8, timelineTurns: 0, description: 'High quality of life' },
    { dimension: 'stability', magnitude: 6, timelineTurns: 0, description: 'Social safety net prevents unrest' },
    { dimension: 'treasury', magnitude: -12, timelineTurns: 0, description: 'High social spending' },
    { dimension: 'technology', magnitude: 2, timelineTurns: 0, description: 'Education investment builds human capital' },
  ], { costPerTurn: 14 }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Syria
// ═══════════════════════════════════════════════════════════════════════════

const SYRIA_POLICIES: PolicyModel[] = [
  p('sy-reconstruction', 'Post-War Reconstruction Program', 'Rebuilding infrastructure destroyed in civil war — roads, hospitals, schools, and power grid — primarily funded by Iran and Russia.', 'domestic', [
    { dimension: 'stability', magnitude: 5, timelineTurns: 0, description: 'Infrastructure rebuilding restores normalcy' },
    { dimension: 'popularity', magnitude: 4, timelineTurns: 0, description: 'Visible reconstruction builds support' },
    { dimension: 'treasury', magnitude: -6, timelineTurns: 0, description: 'Reconstruction is expensive' },
    { dimension: 'diplomatic', magnitude: 2, timelineTurns: 0, description: 'International reconstruction aid' },
  ], { costPerTurn: 8 }),

  p('sy-security-apparatus', 'Mukhabarat Security Network', 'Multiple overlapping intelligence agencies (Air Force Intelligence, Military Intelligence, Political Security) maintaining regime control.', 'domestic', [
    { dimension: 'stability', magnitude: 7, timelineTurns: 0, description: 'Surveillance prevents organized opposition' },
    { dimension: 'popularity', magnitude: -8, timelineTurns: 0, description: 'Brutal repression breeds hatred' },
    { dimension: 'military', magnitude: 3, timelineTurns: 0, description: 'Internal security capability' },
    { dimension: 'treasury', magnitude: -3, timelineTurns: 0, description: 'Intelligence service costs' },
  ], { costPerTurn: 5 }),

  p('sy-iran-alliance', 'Strategic Alliance with Iran', 'Deep military and economic partnership with Iran providing weapons, advisors, credit lines, and Hezbollah ground forces.', 'bilateral', [
    { dimension: 'military', magnitude: 6, timelineTurns: 0, description: 'Iranian military support' },
    { dimension: 'treasury', magnitude: 4, timelineTurns: 0, description: 'Iranian credit and oil supplies' },
    { dimension: 'diplomatic', magnitude: -4, timelineTurns: 0, description: 'Western opposition to Iran axis' },
    { dimension: 'popularity', magnitude: -2, timelineTurns: 0, description: 'Foreign influence resentment' },
  ], { costPerTurn: 2 }),

  p('sy-refugee-return', 'Refugee Return & Resettlement', 'Managing the return of millions of displaced Syrians with property law changes and selective resettlement to reshape demographics.', 'domestic', [
    { dimension: 'stability', magnitude: -3, timelineTurns: 0, description: 'Demographic tensions from returnees' },
    { dimension: 'popularity', magnitude: 3, timelineTurns: 0, description: 'Reunification narrative' },
    { dimension: 'treasury', magnitude: -4, timelineTurns: 0, description: 'Resettlement costs' },
    { dimension: 'diplomatic', magnitude: 3, timelineTurns: 0, description: 'International community engagement' },
  ], { costPerTurn: 5 }),

  p('sy-russia-bases', 'Russian Military Base Agreement', 'Hosting Russian naval base at Tartus and air base at Khmeimim providing regime protection in exchange for strategic Mediterranean access.', 'bilateral', [
    { dimension: 'military', magnitude: 5, timelineTurns: 0, description: 'Russian air cover and naval support' },
    { dimension: 'diplomatic', magnitude: 3, timelineTurns: 0, description: 'Russian UN Security Council protection' },
    { dimension: 'popularity', magnitude: -3, timelineTurns: 0, description: 'Foreign military on soil' },
    { dimension: 'stability', magnitude: 3, timelineTurns: 0, description: 'Regime survival guarantee' },
  ], { costPerTurn: 1 }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Available Policy Catalog — policies ANY nation can adopt
// ═══════════════════════════════════════════════════════════════════════════

const AVAILABLE_POLICIES: PolicyModel[] = [
  p('gen-universal-healthcare', 'Universal Healthcare System', 'Government-funded healthcare for all citizens reducing mortality, improving labor productivity, and boosting popular support.', 'domestic', [
    { dimension: 'popularity', magnitude: 7, timelineTurns: 0, description: 'Broadly popular social program' },
    { dimension: 'stability', magnitude: 4, timelineTurns: 0, description: 'Healthier population = more stable society' },
    { dimension: 'treasury', magnitude: -10, timelineTurns: 0, description: 'Major ongoing expense' },
    { dimension: 'technology', magnitude: 1, timelineTurns: 0, description: 'Medical research investment' },
  ], { costPerTurn: 12 }),

  p('gen-conscription', 'National Military Service', 'Mandatory military or civil service building national cohesion and maintaining large trained reserve force.', 'domestic', [
    { dimension: 'military', magnitude: 6, timelineTurns: 0, description: 'Large trained reserve pool' },
    { dimension: 'popularity', magnitude: -5, timelineTurns: 0, description: 'Unpopular with draft-age citizens' },
    { dimension: 'stability', magnitude: 2, timelineTurns: 0, description: 'National service builds cohesion' },
    { dimension: 'treasury', magnitude: -3, timelineTurns: 0, description: 'Training and administration costs' },
  ], { costPerTurn: 5 }),

  p('gen-free-trade', 'Free Trade Agreement', 'Reducing tariffs and trade barriers to boost exports, attract investment, and lower consumer prices.', 'multilateral', [
    { dimension: 'treasury', magnitude: 6, timelineTurns: 0, description: 'Trade-driven GDP growth' },
    { dimension: 'diplomatic', magnitude: 5, timelineTurns: 0, description: 'Trading partner relationships' },
    { dimension: 'popularity', magnitude: -2, timelineTurns: 0, description: 'Domestic industry competition fears' },
    { dimension: 'stability', magnitude: 1, timelineTurns: 0, description: 'Economic growth supports stability' },
  ], { costPerTurn: 3 }),

  p('gen-austerity', 'Fiscal Austerity Program', 'Cutting government spending and raising taxes to reduce debt and stabilize the currency at the cost of social services.', 'domestic', [
    { dimension: 'treasury', magnitude: 10, timelineTurns: 0, description: 'Significant deficit reduction' },
    { dimension: 'popularity', magnitude: -8, timelineTurns: 0, description: 'Deeply unpopular spending cuts' },
    { dimension: 'stability', magnitude: -4, timelineTurns: 0, description: 'Austerity protests and strikes' },
    { dimension: 'military', magnitude: -2, timelineTurns: 0, description: 'Defense budget cuts' },
  ], { costPerTurn: 1 }),

  p('gen-education-reform', 'National Education Investment', 'Major investment in STEM education, vocational training, and research universities to build long-term human capital.', 'domestic', [
    { dimension: 'technology', magnitude: 5, timelineTurns: 0, description: 'Educated workforce drives innovation' },
    { dimension: 'popularity', magnitude: 4, timelineTurns: 0, description: 'Education spending popular' },
    { dimension: 'treasury', magnitude: -6, timelineTurns: 0, description: 'Education budget expansion' },
    { dimension: 'stability', magnitude: 3, timelineTurns: 0, description: 'Opportunity reduces unrest' },
  ], { costPerTurn: 7 }),

  p('gen-foreign-aid', 'Foreign Aid & Development', 'Providing economic and humanitarian aid to developing nations building soft power and strategic partnerships.', 'multilateral', [
    { dimension: 'diplomatic', magnitude: 7, timelineTurns: 0, description: 'Soft power through generosity' },
    { dimension: 'treasury', magnitude: -5, timelineTurns: 0, description: 'Aid budget costs' },
    { dimension: 'popularity', magnitude: -2, timelineTurns: 0, description: 'Domestic spending vs foreign aid debate' },
    { dimension: 'stability', magnitude: 1, timelineTurns: 0, description: 'Regional stability from development' },
  ], { costPerTurn: 6 }),

  p('gen-cyber-defense', 'National Cyber Defense Program', 'Establishing dedicated cyber command protecting critical infrastructure from digital attacks and espionage.', 'domestic', [
    { dimension: 'military', magnitude: 4, timelineTurns: 0, description: 'Cyber warfare capability' },
    { dimension: 'technology', magnitude: 5, timelineTurns: 0, description: 'Cybersecurity tech development' },
    { dimension: 'treasury', magnitude: -4, timelineTurns: 0, description: 'Program funding' },
    { dimension: 'stability', magnitude: 3, timelineTurns: 0, description: 'Infrastructure protection' },
  ], { costPerTurn: 5 }),

  p('gen-media-control', 'State Media Regulation', 'Government control or heavy regulation of media outlets shaping narrative but restricting press freedom.', 'domestic', [
    { dimension: 'stability', magnitude: 5, timelineTurns: 0, description: 'Controlled information environment' },
    { dimension: 'popularity', magnitude: -4, timelineTurns: 0, description: 'Censorship backlash' },
    { dimension: 'diplomatic', magnitude: -3, timelineTurns: 0, description: 'Press freedom criticism' },
    { dimension: 'technology', magnitude: -1, timelineTurns: 0, description: 'Innovation requires open discourse' },
  ], { costPerTurn: 3 }),

  p('gen-space-program', 'National Space Program', 'Investment in satellite technology, launch capability, and space-based assets for communications, intelligence, and prestige.', 'domestic', [
    { dimension: 'technology', magnitude: 7, timelineTurns: 0, description: 'Space technology spillover' },
    { dimension: 'military', magnitude: 3, timelineTurns: 0, description: 'Satellite reconnaissance and comms' },
    { dimension: 'diplomatic', magnitude: 3, timelineTurns: 0, description: 'National prestige' },
    { dimension: 'treasury', magnitude: -8, timelineTurns: 0, description: 'Expensive program' },
  ], { costPerTurn: 9 }),

  p('gen-anti-corruption', 'Anti-Corruption Campaign', 'Institutional reforms, transparency requirements, and enforcement targeting corrupt officials and practices.', 'domestic', [
    { dimension: 'stability', magnitude: 4, timelineTurns: 0, description: 'Public trust in institutions' },
    { dimension: 'popularity', magnitude: 6, timelineTurns: 0, description: 'Popular demand for accountability' },
    { dimension: 'treasury', magnitude: 3, timelineTurns: 0, description: 'Reduced graft recovers revenue' },
    { dimension: 'diplomatic', magnitude: 2, timelineTurns: 0, description: 'Improved governance reputation' },
  ], { costPerTurn: 4 }),

  p('gen-sanctions-regime', 'International Sanctions', 'Imposing economic sanctions on target nations to coerce policy changes through financial pressure.', 'multilateral', [
    { dimension: 'diplomatic', magnitude: 4, timelineTurns: 0, description: 'Coercive diplomacy tool' },
    { dimension: 'treasury', magnitude: -2, timelineTurns: 0, description: 'Lost trade revenue' },
    { dimension: 'military', magnitude: 1, timelineTurns: 0, description: 'Alternative to military action' },
    { dimension: 'popularity', magnitude: 1, timelineTurns: 0, description: 'Shows strength without war' },
  ], { costPerTurn: 2 }),

  p('gen-nuclear-energy', 'Nuclear Energy Program', 'Building nuclear power plants for clean baseload electricity reducing fossil fuel dependency and emissions.', 'domestic', [
    { dimension: 'technology', magnitude: 4, timelineTurns: 0, description: 'Nuclear technology development' },
    { dimension: 'treasury', magnitude: -5, timelineTurns: 0, description: 'Construction costs (long-term savings)' },
    { dimension: 'stability', magnitude: 2, timelineTurns: 0, description: 'Energy security' },
    { dimension: 'popularity', magnitude: -2, timelineTurns: 0, description: 'Nuclear safety concerns' },
  ], { costPerTurn: 6 }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

/** Per-nation default active policies, keyed by faction ID. */
export const DEFAULT_NATION_POLICIES: Record<string, PolicyModel[]> = {
  us: US_POLICIES,
  china: CHINA_POLICIES,
  russia: RUSSIA_POLICIES,
  japan: JAPAN_POLICIES,
  iran: IRAN_POLICIES,
  dprk: DPRK_POLICIES,
  eu: EU_POLICIES,
  syria: SYRIA_POLICIES,
};

/** Universal policy catalog available to all nations for adoption. */
export const AVAILABLE_POLICY_CATALOG: PolicyModel[] = AVAILABLE_POLICIES;

/**
 * Build the complete policy catalog for a nation:
 * nation-specific defaults + universal catalog (excluding duplicates).
 */
export function getFullPolicyCatalog(nationId: string): PolicyModel[] {
  const nationDefaults = DEFAULT_NATION_POLICIES[nationId] ?? [];
  const nationPolicyIds = new Set(nationDefaults.map((p) => p.policyId));
  const available = AVAILABLE_POLICIES.filter((p) => !nationPolicyIds.has(p.policyId));
  return [...nationDefaults, ...available];
}

/**
 * Get a single policy model by ID from the full catalog.
 */
export function getPolicyModelById(policyId: string, nationId?: string): PolicyModel | undefined {
  if (nationId) {
    const nationPolicies = DEFAULT_NATION_POLICIES[nationId] ?? [];
    const found = nationPolicies.find((p) => p.policyId === policyId);
    if (found) return found;
  }
  // Check all nation defaults
  for (const policies of Object.values(DEFAULT_NATION_POLICIES)) {
    const found = policies.find((p) => p.policyId === policyId);
    if (found) return found;
  }
  // Check universal catalog
  return AVAILABLE_POLICIES.find((p) => p.policyId === policyId);
}
