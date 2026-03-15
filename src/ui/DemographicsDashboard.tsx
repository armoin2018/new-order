/**
 * CNFL-3504 — Population & Religion Demographics Dashboard
 *
 * Population overview, age-distribution pyramid, migration flows,
 * religious composition, radicalization risk, population forecast,
 * and regional drill-down.
 */

import { useState, useMemo } from 'react';
import type { FC, CSSProperties } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgeBracket {
  label: string; // e.g. '0-14', '15-24'
  malePercent: number;
  femalePercent: number;
}

export interface MigrationFlow {
  fromNation: string;
  toNation: string;
  volume: number;
  reason: string;
}

export interface ReligiousGroup {
  religionId: string;
  name: string;
  percent: number;
  radicalizationRisk: number; // 0-100
  trend: 'growing' | 'stable' | 'declining';
}

export interface RegionData {
  regionId: string;
  name: string;
  population: number;
  urbanPercent: number;
  dominantReligion: string;
  growthRate: number;
}

export interface PopulationForecast {
  turn: number;
  totalPopulation: number;
  urbanPercent: number;
  medianAge: number;
}

export interface DemographicsMetrics {
  totalPopulation: number;
  urbanPercent: number;
  ruralPercent: number;
  medianAge: number;
  growthRate: number;
  fertilityRate: number;
  lifeExpectancy: number;
}

export interface DemographicsDashboardProps {
  metrics: DemographicsMetrics;
  agePyramid: AgeBracket[];
  migrationFlows: MigrationFlow[];
  religions: ReligiousGroup[];
  regions: RegionData[];
  forecasts: PopulationForecast[];
  nationName: string;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const panel: CSSProperties = { width: '100%', maxWidth: 1100, margin: '0 auto', padding: 24, color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' };
const sectionTitle: CSSProperties = { fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#888', borderBottom: '1px solid #333', paddingBottom: 8, marginBottom: 16, marginTop: 24 };
const card: CSSProperties = { backgroundColor: '#111', border: '1px solid #333', borderRadius: 8, padding: 16, marginBottom: 12 };
const metricCard: CSSProperties = { textAlign: 'center', padding: 16, backgroundColor: '#111', borderRadius: 8, border: '1px solid #333' };

function riskColor(v: number): string {
  if (v >= 60) return '#ff4a4a';
  if (v >= 30) return '#ffaa00';
  return '#4caf50';
}

const trendSymbol: Record<string, string> = { growing: '▲', stable: '─', declining: '▼' };
const trendColor: Record<string, string> = { growing: '#4caf50', stable: '#888', declining: '#ff4a4a' };

function formatPop(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Component ──────────────────────────────────────────────────────────────

export const DemographicsDashboard: FC<DemographicsDashboardProps> = ({
  metrics,
  agePyramid,
  migrationFlows,
  religions,
  regions,
  forecasts,
  nationName,
}) => {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const overallRadicalization = useMemo(() => {
    if (religions.length === 0) return 0;
    const weighted = religions.reduce((sum, r) => sum + r.radicalizationRisk * (r.percent / 100), 0);
    return Math.round(weighted);
  }, [religions]);

  const regionDetail = useMemo(() => regions.find((r) => r.regionId === selectedRegion) ?? null, [regions, selectedRegion]);

  return (
    <div style={panel} data-testid="demographics-dashboard">
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>
        👥 {nationName} — Demographics
      </h2>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
        Population, age distribution, migration, religion, and regional data.
      </p>

      {/* ── Top Metrics ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }} data-testid="metrics-row">
        <div style={metricCard}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatPop(metrics.totalPopulation)}</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Population</div>
        </div>
        <div style={metricCard}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{metrics.medianAge}</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Median Age</div>
        </div>
        <div style={metricCard}>
          <div style={{ fontSize: 22, fontWeight: 800, color: metrics.growthRate >= 0 ? '#4caf50' : '#ff4a4a' }}>
            {metrics.growthRate >= 0 ? '+' : ''}{metrics.growthRate}%
          </div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Growth Rate</div>
        </div>
        <div style={metricCard}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{metrics.lifeExpectancy}</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Life Expectancy</div>
        </div>
      </div>

      {/* ── Urbanization Bar ──────────────────────────── */}
      <div style={card} data-testid="urbanization">
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Urbanization</div>
        <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${metrics.urbanPercent}%`, background: '#4a9eff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#000' }}>
            Urban {metrics.urbanPercent}%
          </div>
          <div style={{ width: `${metrics.ruralPercent}%`, background: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#ccc' }}>
            Rural {metrics.ruralPercent}%
          </div>
        </div>
      </div>

      {/* ── Age Pyramid ───────────────────────────────── */}
      {agePyramid.length > 0 && (
        <>
          <div style={sectionTitle}>Age Distribution</div>
          <div style={card} data-testid="age-pyramid">
            {agePyramid.map((b) => (
              <div key={b.label} data-testid={`age-${b.label}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 60, textAlign: 'right', fontSize: 10, color: '#888' }}>{b.label}</div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: `${b.malePercent * 5}%`, height: 12, background: '#4a9eff', borderRadius: '3px 0 0 3px', minWidth: 2 }} />
                </div>
                <div style={{ width: 4 }} />
                <div style={{ flex: 1, display: 'flex' }}>
                  <div style={{ width: `${b.femalePercent * 5}%`, height: 12, background: '#ff6fcf', borderRadius: '0 3px 3px 0', minWidth: 2 }} />
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8, fontSize: 10 }}>
              <span><span style={{ color: '#4a9eff' }}>■</span> Male</span>
              <span><span style={{ color: '#ff6fcf' }}>■</span> Female</span>
            </div>
          </div>
        </>
      )}

      {/* ── Migration Flows ───────────────────────────── */}
      {migrationFlows.length > 0 && (
        <>
          <div style={sectionTitle}>Migration Flows</div>
          <div style={card} data-testid="migration-flows">
            {migrationFlows.map((f, i) => (
              <div key={i} data-testid={`flow-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222', fontSize: 12 }}>
                <span>{f.fromNation} → {f.toNation}</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: '#888' }}>{f.reason}</span>
                  <span style={{ fontWeight: 600 }}>{formatPop(f.volume)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Religious Composition ─────────────────────── */}
      {religions.length > 0 && (
        <>
          <div style={sectionTitle}>Religious Composition</div>
          <div style={card} data-testid="religions">
            {religions.map((r) => (
              <div key={r.religionId} data-testid={`religion-${r.religionId}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #222' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{r.name}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: trendColor[r.trend] }}>{trendSymbol[r.trend]}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                  <span>{r.percent}%</span>
                  <span style={{ color: riskColor(r.radicalizationRisk) }}>Risk: {r.radicalizationRisk}%</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ ...card, textAlign: 'center' }} data-testid="radicalization-overall">
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Overall Radicalization Risk</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: riskColor(overallRadicalization) }}>{overallRadicalization}%</div>
          </div>
        </>
      )}

      {/* ── Population Forecast ───────────────────────── */}
      {forecasts.length > 0 && (
        <>
          <div style={sectionTitle}>Population Forecast</div>
          <div style={card} data-testid="forecasts">
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0' }}>
              {forecasts.map((f) => (
                <div key={f.turn} data-testid={`forecast-${f.turn}`} style={{ minWidth: 90, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Turn {f.turn}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{formatPop(f.totalPopulation)}</div>
                  <div style={{ fontSize: 9, color: '#888' }}>Urban {f.urbanPercent}%</div>
                  <div style={{ fontSize: 9, color: '#888' }}>Age {f.medianAge}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Regions ───────────────────────────────────── */}
      {regions.length > 0 && (
        <>
          <div style={sectionTitle}>Regions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }} data-testid="regions">
            {regions.map((r) => (
              <div
                key={r.regionId}
                data-testid={`region-${r.regionId}`}
                onClick={() => setSelectedRegion(r.regionId)}
                style={{
                  ...card,
                  cursor: 'pointer',
                  borderColor: selectedRegion === r.regionId ? '#4a9eff' : '#333',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#888' }}>Pop: {formatPop(r.population)}</div>
                <div style={{ fontSize: 11, color: '#888' }}>Urban: {r.urbanPercent}%</div>
                <div style={{ fontSize: 11, color: '#888' }}>Growth: {r.growthRate}%</div>
                <div style={{ fontSize: 11, color: '#888' }}>Religion: {r.dominantReligion}</div>
              </div>
            ))}
          </div>
          {regionDetail && (
            <div style={{ ...card, borderColor: '#4a9eff', marginTop: 12 }} data-testid="region-detail">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{regionDetail.name}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
                <div><span style={{ color: '#888' }}>Population:</span> {formatPop(regionDetail.population)}</div>
                <div><span style={{ color: '#888' }}>Urban:</span> {regionDetail.urbanPercent}%</div>
                <div><span style={{ color: '#888' }}>Growth:</span> {regionDetail.growthRate}%</div>
                <div><span style={{ color: '#888' }}>Religion:</span> {regionDetail.dominantReligion}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
