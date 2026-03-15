/**
 * AI Dimension Prompt Types — DR-186, FR-4000
 *
 * Defines the shape of customizable AI prompts for each simulation dimension,
 * template variable substitution, and version-history tracking.
 */

/** The 10 simulation dimensions that have customizable prompts (FR-4001) */
export type PromptDimension =
  | 'diplomacy' | 'markets' | 'indexes' | 'currency'
  | 'technology' | 'military' | 'education' | 'religion'
  | 'decisionModel' | 'decisionSelection';

/** All prompt dimensions as a constant array */
export const PROMPT_DIMENSIONS: readonly PromptDimension[] = [
  'diplomacy', 'markets', 'indexes', 'currency',
  'technology', 'military', 'education', 'religion',
  'decisionModel', 'decisionSelection',
] as const;

/** Supported template variables for prompt substitution (FR-4003) */
export type PromptTemplateVariable =
  | '{{nationName}}' | '{{turnNumber}}' | '{{gameState}}'
  | '{{leaderProfile}}' | '{{dimensionData}}' | '{{recentEvents}}';

export const PROMPT_TEMPLATE_VARIABLES: readonly string[] = [
  '{{nationName}}', '{{turnNumber}}', '{{gameState}}',
  '{{leaderProfile}}', '{{dimensionData}}', '{{recentEvents}}',
] as const;

/** A stored version of a prompt (FR-4004) */
export interface PromptVersion {
  version: number;
  text: string;
  timestamp: string;
}

/** Complete prompt template for a dimension (DR-186) */
export interface DimensionPromptTemplate {
  dimensionId: PromptDimension;
  promptText: string;
  templateVariables: readonly string[];
  version: number;
  lastModified: string;
  characterCount: number;
  versions: PromptVersion[];
}

/** State for all dimension prompts */
export interface DimensionPromptState {
  prompts: Record<PromptDimension, DimensionPromptTemplate>;
}

/** Variables context for template resolution */
export interface PromptVariableContext {
  nationName: string;
  turnNumber: number;
  gameState: string;
  leaderProfile: string;
  dimensionData: string;
  recentEvents: string;
}
