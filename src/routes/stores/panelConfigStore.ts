import { writable } from 'svelte/store';
import type { SolarPanelConfig } from '../solar';

export interface PanelConfigState {
  configId: number | undefined;
  panelCapacityWatts: number;
  manualConfigOverride: boolean;
  solarPanelConfigs: SolarPanelConfig[];
  defaultPanelCapacityWatts: number;
}

export const panelConfigStore = writable<PanelConfigState>({
  configId: undefined,
  panelCapacityWatts: 400,
  manualConfigOverride: false,
  solarPanelConfigs: [],
  defaultPanelCapacityWatts: 400
});

// Helper function to update panel configuration
export function updatePanelConfig(partial: Partial<PanelConfigState>) {
  panelConfigStore.update(current => ({ ...current, ...partial }));
}

// Helper function to get current panel config
export function getCurrentPanelConfig(state: PanelConfigState): SolarPanelConfig | undefined {
  if (state.configId === undefined || state.configId < 0 || state.configId >= state.solarPanelConfigs.length) {
    return undefined;
  }
  return state.solarPanelConfigs[state.configId];
}

// Helper function to get panel count
export function getPanelCount(state: PanelConfigState): number {
  const config = getCurrentPanelConfig(state);
  return config?.panelsCount || 0;
}

// Helper function to get yearly energy
export function getYearlyEnergy(state: PanelConfigState): number {
  const config = getCurrentPanelConfig(state);
  if (!config) return 0;
  
  const panelCapacityRatio = state.panelCapacityWatts / state.defaultPanelCapacityWatts;
  return config.yearlyEnergyDcKwh * panelCapacityRatio;
} 