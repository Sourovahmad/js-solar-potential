<!--
 Copyright 2023 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 -->

<script lang="ts">
  /* global google */

  import type { BuildingInsightsResponse } from '../solar';
  import { findSolarConfig } from '../utils';
  import BuildingInsightsSection from './BuildingInsightsSection.svelte';
  import DataLayersSection from './DataLayersSection.svelte';
  import SolarPotentialSection from './SolarPotentialSection.svelte';
  import PDFDownloadButton from '../components/PDFDownloadButton.svelte';
  import { onMount } from 'svelte';
  import { sidebarMobileState } from './sidebarMobileState';
  import { get } from 'svelte/store';
  import { writable } from 'svelte/store';
  import { panelConfigStore, updatePanelConfig } from '../stores/panelConfigStore';

  export let location: google.maps.LatLng;
  export let map: google.maps.Map;
  export let geometryLibrary: google.maps.GeometryLibrary;
  export let googleMapsApiKey: string;
  export let expandedSection: string;
  export let locationName: string = '';
  export let mapElement: HTMLElement | undefined = undefined;
  export let isHeatmapLoading: boolean = false;
  export let heatmapLoadingStep: string = '';
  
  // Create a store for cached building insights to persist across popup open/close
  const buildingInsightsCache = writable<{
    location?: { lat: number; lng: number };
    data?: BuildingInsightsResponse;
    timestamp?: number;
  }>({});

  let buildingInsights: BuildingInsightsResponse | undefined;
  
  // Check if we have cached data for this location
  $: if (location) {
    const cache = get(buildingInsightsCache);
    const currentLoc = { lat: location.lat(), lng: location.lng() };
    
    // Check if we have fresh cached data for this location (within 5 minutes)
    if (cache.location && cache.data && cache.timestamp && 
        Math.abs(cache.location.lat - currentLoc.lat) < 0.00001 &&
        Math.abs(cache.location.lng - currentLoc.lng) < 0.00001 &&
        Date.now() - cache.timestamp < 5 * 60 * 1000) {
      
      // CRITICAL FIX: Only use cache if we don't already have different building insights
      if (!buildingInsights || buildingInsights.name === cache.data.name) {
        buildingInsights = cache.data;
      }
    }
  }

  // Update cache when buildingInsights changes
  $: if (buildingInsights && location) {
    buildingInsightsCache.set({
      location: { lat: location.lat(), lng: location.lng() },
      data: buildingInsights,
      timestamp: Date.now()
    });
    
    // Update panel config store with new building insights data
    updatePanelConfig({
      solarPanelConfigs: buildingInsights.solarPotential.solarPanelConfigs,
      defaultPanelCapacityWatts: buildingInsights.solarPotential.panelCapacityWatts
    });
  }

  // State (local, for desktop)
  let showPanels = true;
  let monthlyAverageEnergyBillInput = 120;
  let energyCostPerKwhInput = 0.3;
  let dcToAcDerateInput = 0.85;
  
  // Use centralized panel config store
  let panelCapacityWattsInput: number;
  let configId: number | undefined;
  let manualConfigOverride = false;
  
  // Subscribe to panel config store
  $: {
    const panelState = $panelConfigStore;
    panelCapacityWattsInput = panelState.panelCapacityWatts;
    configId = panelState.configId;
    manualConfigOverride = panelState.manualConfigOverride;
  }

  let isMobile = false;

  // Initialize mobile detection and load persisted state
  onMount(() => {
    isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    
    const handleResize = () => {
      isMobile = window.innerWidth <= 768;
    };
    
    window.addEventListener('resize', handleResize);
    
    // Load persisted state on mount
    if (isMobile) {
      const mobileState = get(sidebarMobileState);
      showPanels = mobileState.showPanels;
      monthlyAverageEnergyBillInput = mobileState.monthlyAverageEnergyBillInput;
      panelCapacityWattsInput = mobileState.panelCapacityWattsInput;
      energyCostPerKwhInput = mobileState.energyCostPerKwhInput;
      dcToAcDerateInput = mobileState.dcToAcDerateInput;
      configId = mobileState.configId;
      manualConfigOverride = mobileState.manualConfigOverride;
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  // Sync state with mobile store when switching to mobile
  $: if (isMobile) {
    const currentMobileState = get(sidebarMobileState);
    
    // Only update if values are different to prevent loops
    if (currentMobileState.showPanels !== showPanels ||
        currentMobileState.monthlyAverageEnergyBillInput !== monthlyAverageEnergyBillInput ||
        currentMobileState.panelCapacityWattsInput !== panelCapacityWattsInput ||
        currentMobileState.energyCostPerKwhInput !== energyCostPerKwhInput ||
        currentMobileState.dcToAcDerateInput !== dcToAcDerateInput ||
        currentMobileState.configId !== configId ||
        currentMobileState.expandedSection !== expandedSection ||
        currentMobileState.manualConfigOverride !== manualConfigOverride) {
      
      sidebarMobileState.set({
        showPanels,
        monthlyAverageEnergyBillInput,
        panelCapacityWattsInput,
        energyCostPerKwhInput,
        dcToAcDerateInput,
        expandedSection,
        configId,
        manualConfigOverride
      });
    }
  }

  // Read from mobile store when on mobile
  $: if (isMobile) {
    const mobileState = $sidebarMobileState;
    showPanels = mobileState.showPanels;
    monthlyAverageEnergyBillInput = mobileState.monthlyAverageEnergyBillInput;
    panelCapacityWattsInput = mobileState.panelCapacityWattsInput;
    energyCostPerKwhInput = mobileState.energyCostPerKwhInput;
    dcToAcDerateInput = mobileState.dcToAcDerateInput;
    configId = mobileState.configId;
    manualConfigOverride = mobileState.manualConfigOverride;
  }

  // When user changes a value, update store if mobile
  function updateSidebarState(partial: Partial<typeof $sidebarMobileState>) {
    if (isMobile) {
      sidebarMobileState.update(state => ({ ...state, ...partial }));
    }
  }

  // Function to handle manual configId changes
  function handleConfigIdChange(newConfigId: number) {
    configId = newConfigId;
    manualConfigOverride = true;
    
    // Update panel config store
    updatePanelConfig({ configId: newConfigId, manualConfigOverride: true });
    
    if (isMobile) {
      updateSidebarState({ configId, manualConfigOverride });
    }
  }

  // Function to reset to automatic calculation
  function resetToAutoConfig() {
    manualConfigOverride = false;
    
    // Update panel config store
    updatePanelConfig({ manualConfigOverride: false });
    
    if (isMobile) {
      updateSidebarState({ manualConfigOverride });
    }
    // Trigger recalculation
    if (buildingInsights) {
      const defaultPanelCapacity = buildingInsights.solarPotential.panelCapacityWatts;
      const panelCapacityRatio = panelCapacityWattsInput / defaultPanelCapacity;
      const newConfigId = findSolarConfig(
        buildingInsights.solarPotential.solarPanelConfigs,
        yearlyKwhEnergyConsumption,
        panelCapacityRatio,
        dcToAcDerateInput,
      );
      
      configId = newConfigId;
      updatePanelConfig({ configId: newConfigId });
      
      if (isMobile) {
        updateSidebarState({ configId: newConfigId });
      }
    }
  }

  // Find the config that covers the yearly energy consumption.
  let yearlyKwhEnergyConsumption: number;
  $: yearlyKwhEnergyConsumption = (monthlyAverageEnergyBillInput / energyCostPerKwhInput) * 12;

  // Only auto-calculate configId if user hasn't manually overridden it
  $: if (!manualConfigOverride && configId === undefined && buildingInsights) {
    const defaultPanelCapacity = buildingInsights.solarPotential.panelCapacityWatts;
    const panelCapacityRatio = panelCapacityWattsInput / defaultPanelCapacity;
    const newConfigId = findSolarConfig(
      buildingInsights.solarPotential.solarPanelConfigs,
      yearlyKwhEnergyConsumption,
      panelCapacityRatio,
      dcToAcDerateInput,
    );
    
    // Update both local state and panel config store
    configId = newConfigId;
    updatePanelConfig({ configId: newConfigId });
    
    // Update mobile store if on mobile
    if (isMobile) {
      updateSidebarState({ configId: newConfigId });
    }
  }
</script>

<div class="flex flex-col rounded-md shadow-md">
  {#if geometryLibrary && map}
    <BuildingInsightsSection
      bind:expandedSection
      bind:buildingInsights
      configId={configId}
      bind:showPanels
      bind:panelCapacityWatts={panelCapacityWattsInput}
      {googleMapsApiKey}
      {geometryLibrary}
      {location}
      {map}
      {manualConfigOverride}
      {resetToAutoConfig}
      on:showPanelsChange={e => updateSidebarState({ showPanels: e.detail })}
      on:panelCapacityWattsInputChange={e => updateSidebarState({ panelCapacityWattsInput: e.detail })}
      on:configIdChange={e => handleConfigIdChange(e.detail)}
    />
  {/if}

  {#if buildingInsights && configId !== undefined}
    <md-divider inset />
    <DataLayersSection
      bind:expandedSection
      bind:showPanels
      {googleMapsApiKey}
      {buildingInsights}
      {geometryLibrary}
      {map}
      bind:isHeatmapLoading
      bind:loadingStep={heatmapLoadingStep}
      on:showPanelsChange={e => updateSidebarState({ showPanels: e.detail })}
    />

    <md-divider inset />
    <SolarPotentialSection
      bind:expandedSection
      configId={configId}
      bind:monthlyAverageEnergyBillInput
      bind:energyCostPerKwhInput
      bind:panelCapacityWattsInput
      bind:dcToAcDerateInput
      solarPanelConfigs={buildingInsights.solarPotential.solarPanelConfigs}
      defaultPanelCapacityWatts={buildingInsights.solarPotential.panelCapacityWatts}
      {manualConfigOverride}
      {resetToAutoConfig}
      on:monthlyAverageEnergyBillInputChange={e => updateSidebarState({ monthlyAverageEnergyBillInput: e.detail })}
      on:energyCostPerKwhInputChange={e => updateSidebarState({ energyCostPerKwhInput: e.detail })}
      on:panelCapacityWattsInputChange={e => updateSidebarState({ panelCapacityWattsInput: e.detail })}
      on:dcToAcDerateInputChange={e => updateSidebarState({ dcToAcDerateInput: e.detail })}
      on:configIdChange={e => handleConfigIdChange(e.detail)}
    />
    
    <!-- PDF Download Button -->
    <md-divider inset />
    <div class="p-4">
      <PDFDownloadButton 
        {location}
        {buildingInsights}
        {configId}
        panelCapacityWatts={panelCapacityWattsInput}
        monthlyAverageEnergyBill={monthlyAverageEnergyBillInput}
        energyCostPerKwh={energyCostPerKwhInput}
        dcToAcDerate={dcToAcDerateInput}
        {mapElement}
      />
      

    </div>
  {/if}
</div>
