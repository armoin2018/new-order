/**
 * UI barrel export — React components
 */
export { App } from './App';
export { CommandCenter } from './CommandCenter';
export { TopBar } from './TopBar';
export { ActionMenu } from './ActionMenu';
export { MapViewport } from './MapViewport';
export { IntelPanel } from './IntelPanel';
export { HeadlinesPanel } from './HeadlinesPanel';
export { StrategicDashboard } from './StrategicDashboard';
export { DiplomacyPanel } from './DiplomacyPanel';
export { ProfileBuilder } from './ProfileBuilder';
export { ProfileSelection } from './ProfileSelection';
export { PoliticalSystemCreator } from './PoliticalSystemCreator';
export { EquipmentCatalog } from './EquipmentCatalog';
export { MilitaryDashboard } from './MilitaryDashboard';
export { TechTree } from './TechTree';
export { EducationDashboard } from './EducationDashboard';
export { DemographicsDashboard } from './DemographicsDashboard';

export type { ActionItem, ActionMenuProps } from './ActionMenu';
export type { IntelFaction, IntelPanelProps } from './IntelPanel';
export type { CommandCenterProps } from './CommandCenter';
export type { HeadlinesPanelProps } from './HeadlinesPanel';
export type { StrategicDashboardProps, LossConditionDisplayData, RecommendedActionDisplayData, RivalLeaderboardEntry } from './StrategicDashboard';
export type { DiplomacyNationData, DiplomacyPact, DiplomacyPanelProps } from './DiplomacyPanel';
export type { ProfileBuilderProps, LeaderProfile, MbtiType, DecisionStyle, StressResponse } from './ProfileBuilder';
export type { ProfileSelectionProps, ProfileSummary } from './ProfileSelection';
export type { PoliticalSystemCreatorProps, PoliticalSystemProfile, PoliticalSystemPreset, PoliticalSystemModifiers, GameplayModifiers } from './PoliticalSystemCreator';
export type { EquipmentCatalogProps, EquipmentItem } from './EquipmentCatalog';
export type { MilitaryDashboardProps, InventoryEntry, ProcurementOrder, MilitaryBudget, QuickAction } from './MilitaryDashboard';
export type { TechTreeProps, TechNode, TechDomain, ResearchQueueItem, NationTechLevel } from './TechTree';
export type { EducationDashboardProps, EducationSector, EducationMetrics, NationEducationLevel, AdvisorRecommendation, ProjectedEffect } from './EducationDashboard';
export type { DemographicsDashboardProps, DemographicsMetrics, AgeBracket, MigrationFlow, ReligiousGroup, RegionData, PopulationForecast } from './DemographicsDashboard';
export { AISettingsPanel } from './AISettingsPanel';
export type { AISettingsPanelProps, AISettingsState, ConnectionTestResult, CostSummary } from './AISettingsPanel';
export { ModuleBrowser } from './ModuleBrowser';
export type { ModuleBrowserProps, ModuleSummary, ModuleType, ViewMode, SortKey } from './ModuleBrowser';
export { SchemaForm } from './SchemaForm';
export type { SchemaFormProps, JsonSchema, JsonSchemaProperty, ValidationError } from './SchemaForm';
export { ModuleEditor } from './ModuleEditor';
export type { ModuleEditorProps, ToastType, Toast } from './ModuleEditor';
export { ImportExportPanel } from './ImportExportPanel';
export type { ImportExportPanelProps, ImportResult, ConflictResolution, BackupEntry } from './ImportExportPanel';
export { ModuleDetailView } from './ModuleDetailView';
export type { ModuleDetailViewProps, ModuleRelationship, UsageStat } from './ModuleDetailView';
export { AutomationDashboard } from './AutomationDashboard';
export type {
  AutomationDashboardProps,
  ScenarioOption,
  RunConfig,
  ActiveJob,
  CompletedRun,
  ExecutionMode as UIExecutionMode,
  ExecutionSpeed as UIExecutionSpeed,
  AIStrategy,
} from './AutomationDashboard';
export { StockMarketDashboard } from './StockMarketDashboard';
export { ForexDashboard } from './ForexDashboard';
export { ScenarioPanel } from './ScenarioPanel';
export type { ScenarioPanelProps } from './ScenarioPanel';
export { MarketIndexPanel } from './MarketIndexPanel';
export { MarketSentimentWidget } from './MarketSentimentWidget';
export { TechModuleViewer } from './TechModuleViewer';
export { TickerEditorPanel } from './TickerEditorPanel';
export type { TickerEditorPanelProps, TickerEditorData } from './TickerEditorPanel';
