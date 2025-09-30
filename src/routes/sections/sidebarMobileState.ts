import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface SidebarMobileState {
  showPanels: boolean;
  monthlyAverageEnergyBillInput: number;
  panelCapacityWattsInput: number;
  energyCostPerKwhInput: number;
  dcToAcDerateInput: number;
  expandedSection: string;
  configId?: number;
  manualConfigOverride: boolean;
}

const defaultState: SidebarMobileState = {
  showPanels: true,
  monthlyAverageEnergyBillInput: 120, // Average monthly energy bill in Italy (EUR)
  panelCapacityWattsInput: 400,
  energyCostPerKwhInput: 0.3, // Average energy cost per kWh in Italy (EUR)
  dcToAcDerateInput: 0.85,
  expandedSection: '',
  configId: undefined,
  manualConfigOverride: false,
};

// Load state from localStorage if available
function loadPersistedState(): SidebarMobileState {
  if (!browser) return defaultState;
  
  try {
    const stored = localStorage.getItem('solarApp_preferences');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle missing properties
      return { ...defaultState, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load persisted state:', error);
  }
  
  return defaultState;
}

// Save state to localStorage
function persistState(state: SidebarMobileState) {
  if (!browser) return;
  
  try {
    // Don't persist expandedSection as it's UI state
    const { expandedSection, ...persistableState } = state;
    localStorage.setItem('solarApp_preferences', JSON.stringify(persistableState));
  } catch (error) {
    console.warn('Failed to persist state:', error);
  }
}

// Create the store with persisted initial state
export const sidebarMobileState = writable<SidebarMobileState>(loadPersistedState());

// Auto-persist state changes
sidebarMobileState.subscribe((state) => {
  persistState(state);
}); 