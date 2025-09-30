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

  import { slide } from 'svelte/transition';

  import Expandable from '../components/Expandable.svelte';
  import SummaryCard from '../components/SummaryCard.svelte';
  import type { SolarPanelConfig } from '../solar';
  import Table from '../components/Table.svelte';

  /* eslint-disable @typescript-eslint/ban-ts-comment */
  // @ts-ignore
  import { GoogleCharts } from 'google-charts';
  import { findSolarConfig, showMoney, showNumber } from '../utils';
  import InputNumber from '../components/InputNumber.svelte';
  import InputPanelsCount from '../components/InputPanelsCount.svelte';
  import InputMoney from '../components/InputMoney.svelte';
  import InputPercent from '../components/InputPercent.svelte';
  import InputRatio from '../components/InputRatio.svelte';
  import { panelConfigStore, getCurrentPanelConfig, getPanelCount, getYearlyEnergy, updatePanelConfig } from '../stores/panelConfigStore';
  import { _, isLoading } from 'svelte-i18n';

  export let expandedSection: string;
  export let configId: number;
  export let monthlyAverageEnergyBillInput: number;
  export let energyCostPerKwhInput: number;
  export let panelCapacityWattsInput: number;
  export let dcToAcDerateInput: number;
  export let solarPanelConfigs: SolarPanelConfig[];
  export let defaultPanelCapacityWatts: number;
  export let manualConfigOverride: boolean;
  export let resetToAutoConfig: () => void;

  const icon = 'payments';
  $: title = $isLoading ? 'Solar Potential analysis' : $_('sections.solarPotential');

  let costChart: HTMLElement;
  let showAdvancedSettings = false;

  // [START solar_potential_calculations]
  // Solar configuration, from buildingInsights.solarPotential.solarPanelConfigs
  let panelsCount = 20;
  let yearlyEnergyDcKwh = 12000;

  // Basic settings
  let monthlyAverageEnergyBill: number = 120; // EUR
  let energyCostPerKwh = 0.25; // EUR per kWh
  let panelCapacityWatts = 400;
  let solarIncentivesPercent: number = 0.5; // 50% - Italian solar incentives as percentage
  let installationCostPerWatt: number = 2.5; // EUR per Watt - typical in Italy
  let installationLifeSpan: number = 20;

  // Advanced settings
  let dcToAcDerate = 0.85;
  let efficiencyDepreciationFactor = 0.995;
  let costIncreaseFactor = 1.025; // Italy energy cost increase ~2.5% annually
  let discountRate = 1.03; // Lower discount rate reflecting European interest rates

  // Solar installation
  let installationSizeKw: number = (panelsCount * panelCapacityWatts) / 1000;
  let installationCostTotal: number = installationCostPerWatt * installationSizeKw * 1000;

  // Energy consumption
  let monthlyKwhEnergyConsumption: number = monthlyAverageEnergyBill / energyCostPerKwh;
  let yearlyKwhEnergyConsumption: number = monthlyKwhEnergyConsumption * 12;

  // Energy produced for installation life span
  let initialAcKwhPerYear: number = yearlyEnergyDcKwh * dcToAcDerate;
  let yearlyProductionAcKwh: number[] = [...Array(installationLifeSpan).keys()].map(
    (year) => initialAcKwhPerYear * efficiencyDepreciationFactor ** year,
  );

  // Cost with solar for installation life span
  let yearlyUtilityBillEstimates: number[] = yearlyProductionAcKwh.map(
    (yearlyKwhEnergyProduced, year) => {
      const billEnergyKwh = yearlyKwhEnergyConsumption - yearlyKwhEnergyProduced;
      const billEstimate =
        (billEnergyKwh * energyCostPerKwh * costIncreaseFactor ** year) / discountRate ** year;
      return Math.max(billEstimate, 0); // bill cannot be negative
    },
  );
  let remainingLifetimeUtilityBill: number = yearlyUtilityBillEstimates.reduce((x, y) => x + y, 0);
  let totalCostWithSolar: number =
    installationCostTotal + remainingLifetimeUtilityBill - (installationCostTotal * solarIncentivesPercent);

  // Cost without solar for installation life span
  let yearlyCostWithoutSolar: number[] = [...Array(installationLifeSpan).keys()].map(
    (year) => (monthlyAverageEnergyBill * 12 * costIncreaseFactor ** year) / discountRate ** year,
  );
  let totalCostWithoutSolar: number = yearlyCostWithoutSolar.reduce((x, y) => x + y, 0);

  // Savings with solar for installation life span
  let savings: number = totalCostWithoutSolar - totalCostWithSolar;
  // [END solar_potential_calculations]

  // Reactive calculations
  let panelCapacityRatio: number = 1.0;
  $: panelCapacityRatio = panelCapacityWattsInput / defaultPanelCapacityWatts;
  
  // Debug logging for panel config consistency
  $: {
    const panelState = $panelConfigStore;
    const currentPanelConfig = getCurrentPanelConfig(panelState);
    console.log('=== SolarPotentialSection Panel Config ===');
    console.log('configId from props:', configId);
    console.log('configId from store:', panelState.configId);
    console.log('panelCapacityWatts from props:', panelCapacityWattsInput);
    console.log('panelCapacityWatts from store:', panelState.panelCapacityWatts);
    console.log('currentPanelConfig from store:', currentPanelConfig);
    console.log('panelCount from store:', getPanelCount(panelState));
    console.log('yearlyEnergy from store:', getYearlyEnergy(panelState));
  }
  

  $: if (solarPanelConfigs[configId]) {
    installationSizeKw = (solarPanelConfigs[configId].panelsCount * panelCapacityWattsInput) / 1000;
  }
  $: installationCostTotal = installationCostPerWatt * installationSizeKw * 1000;
  $: monthlyKwhEnergyConsumption = monthlyAverageEnergyBillInput / energyCostPerKwhInput;
  $: yearlyKwhEnergyConsumption = monthlyKwhEnergyConsumption * 12;
  $: if (solarPanelConfigs[configId]) {
    initialAcKwhPerYear =
      solarPanelConfigs[configId].yearlyEnergyDcKwh * panelCapacityRatio * dcToAcDerateInput;
  }
  $: yearlyProductionAcKwh = [...Array(installationLifeSpan).keys()].map(
    (year) => initialAcKwhPerYear * efficiencyDepreciationFactor ** year,
  );
  $: yearlyUtilityBillEstimates = yearlyProductionAcKwh.map((yearlyKwhEnergyProduced, year) => {
    const billEnergyKwh = yearlyKwhEnergyConsumption - yearlyKwhEnergyProduced;
    const billEstimate =
      (billEnergyKwh * energyCostPerKwhInput * costIncreaseFactor ** year) / discountRate ** year;
    return Math.max(billEstimate, 0); // bill cannot be negative
  });
  $: remainingLifetimeUtilityBill = yearlyUtilityBillEstimates.reduce((x, y) => x + y, 0);
  $: totalCostWithSolar = installationCostTotal + remainingLifetimeUtilityBill - (installationCostTotal * solarIncentivesPercent);
  $: yearlyCostWithoutSolar = [...Array(installationLifeSpan).keys()].map(
    (year) =>
      (monthlyAverageEnergyBillInput * 12 * costIncreaseFactor ** year) / discountRate ** year,
  );
  $: totalCostWithoutSolar = yearlyCostWithoutSolar.reduce((x, y) => x + y, 0);
  $: savings = totalCostWithoutSolar - totalCostWithSolar;

  let energyCovered: number;
  $: energyCovered = yearlyProductionAcKwh[0] / yearlyKwhEnergyConsumption;

  let breakEvenYear: number = -1;
  $: GoogleCharts.load(
    () => {
      if (!costChart) {
        return;
      }
      const year = new Date().getFullYear();

      let costWithSolar = 0;
      const cumulativeCostsWithSolar = yearlyUtilityBillEstimates.map(
        (billEstimate, i) =>
          (costWithSolar +=
            i == 0 ? billEstimate + installationCostTotal - (installationCostTotal * solarIncentivesPercent) : billEstimate),
      );
      let costWithoutSolar = 0;
      const cumulativeCostsWithoutSolar = yearlyCostWithoutSolar.map(
        (cost) => (costWithoutSolar += cost),
      );
      breakEvenYear = cumulativeCostsWithSolar.findIndex(
        (costWithSolar, i) => costWithSolar <= cumulativeCostsWithoutSolar[i],
      );

      const data = google.visualization.arrayToDataTable([
        ['Year', 'Solar', 'No solar'],
        [year.toString(), 0, 0],
        ...cumulativeCostsWithSolar.map((_, i) => [
          (year + i + 1).toString(),
          cumulativeCostsWithSolar[i],
          cumulativeCostsWithoutSolar[i],
        ]),
      ]);

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const googleCharts = google.charts as any;
      const chart = new googleCharts.Line(costChart);
      const options = googleCharts.Line.convertOptions({
        title: `Cost analysis for ${installationLifeSpan} years`,
        width: 350,
        height: 200,
      });
      chart.draw(data, options);
    },
    { packages: ['line'] },
  );

  function updateConfig() {
    monthlyKwhEnergyConsumption = monthlyAverageEnergyBillInput / energyCostPerKwhInput;
    yearlyKwhEnergyConsumption = monthlyKwhEnergyConsumption * 12;
    panelCapacityRatio = panelCapacityWattsInput / defaultPanelCapacityWatts;
    
    // Only recalculate configId if user hasn't manually overridden it
    if (!manualConfigOverride) {
      configId = findSolarConfig(
        solarPanelConfigs,
        yearlyKwhEnergyConsumption,
        panelCapacityRatio,
        dcToAcDerateInput,
      );
    }
  }
</script>

<style>
  @media (max-width: 768px) {
    .mx-2, .m-2 {
      margin-left: 0.5rem !important;
      margin-right: 0.5rem !important;
    }
    .p-4 {
      padding: 1rem !important;
    }
    .surface, .on-surface-text, .rounded-lg, .shadow-lg {
      border-radius: 1rem !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important;
    }
    .flex, .flex-col, .inline-flex {
      flex-direction: column !important;
      gap: 0.75rem !important;
      align-items: stretch !important;
    }
    .w-full, .max-w-full {
      width: 100% !important;
      max-width: 100% !important;
    }
    .overflow-y-auto, .overflow-x-auto {
      overflow-x: hidden !important;
      overflow-y: auto !important;
    }
    .break-words {
      word-break: break-word !important;
    }
    .label-small, .secondary-text, .primary-text {
      font-size: 1rem !important;
    }
    .grid, .justify-items-end {
      justify-items: stretch !important;
    }
    .space-y-2, .space-y-4 {
      gap: 0.5rem !important;
    }
    .absolute, .top-0, .left-0 {
      position: static !important;
    }
  }
</style>

<Expandable
  bind:section={expandedSection}
  {icon}
  {title}
  subtitle={$isLoading ? "Values are only placeholders." : $_('solarPotential.valuesPlaceholder')}
  subtitle2={$isLoading ? "Update with your own values." : $_('solarPotential.updateValues')}
  secondary
>
  <div class="flex flex-col space-y-4 pt-1">
    <!-- <div class="p-4 mb-4 surface-variant outline-text rounded-lg">
      <p class="relative inline-flex items-center space-x-2">
        <md-icon class="md:w-6 w-8">info</md-icon>
        <span>
          Projections use a financial model
          <a
            class="primary-text"
            href="https://developers.google.com/maps/documentation/solar/calculate-costs-us"
            target="_blank"
          >
            adapted for Italy (EUR)
            <md-icon class="text-sm">open_in_new</md-icon>
          </a>
        </span>
      </p>
    </div> -->

    <InputMoney
      bind:value={monthlyAverageEnergyBillInput}
      icon="credit_card"
      label={$isLoading ? "Monthly average energy bill" : $_('solarPotential.monthlyEnergyBill')}
      onChange={updateConfig}
    />

    <div class="inline-flex items-center space-x-2">
      <div class="grow">
        <InputPanelsCount 
          bind:configId 
          {solarPanelConfigs}
          on:configIdChange={(e) => {
            // Update the panel config store when user manually changes panel count
            updatePanelConfig({ 
              configId: e.detail, 
              manualConfigOverride: true 
            });
            console.log('SolarPotentialSection: configId changed to', e.detail);
          }}
        />
      </div>
      <md-icon-button role={undefined} on:click={updateConfig}>
        <md-icon>sync</md-icon>
      </md-icon-button>
    </div>

    {#if manualConfigOverride}
      <div class="flex items-center space-x-2 px-2 py-1 bg-blue-50 rounded-md">
        <md-icon class="text-blue-600">settings</md-icon>
        <span class="text-blue-700 label-small flex-grow">Manual panel count selected</span>
        <md-text-button role={undefined} on:click={resetToAutoConfig}>
          Auto
          <md-icon slot="icon">refresh</md-icon>
        </md-text-button>
      </div>
    {/if}

    <InputMoney
      bind:value={energyCostPerKwhInput}
      icon="paid"
      label={$isLoading ? "Energy cost per kWh" : $_('solarPotential.energyCostPerKwh')}
      onChange={updateConfig}
    />

    <InputPercent
      bind:value={solarIncentivesPercent}
      icon="redeem"
      label={$isLoading ? "Solar incentives" : $_('solarPotential.solarIncentives')}
      onChange={updateConfig}
    />

    <InputMoney
      bind:value={installationCostPerWatt}
      icon="request_quote"
      label={$isLoading ? "Installation cost per Watt" : $_('solarPotential.installationCostPerWatt')}
      onChange={updateConfig}
    />

    <InputNumber
      bind:value={panelCapacityWattsInput}
      icon="bolt"
      label={$isLoading ? "Panel capacity" : $_('buildingInsights.panelCapacity')}
      suffix="Watts"
      onChange={updateConfig}
    />

    <div class="flex flex-col items-center w-full">
      <md-text-button
        trailing-icon
        role={undefined}
        on:click={() => (showAdvancedSettings = !showAdvancedSettings)}
        style="color: rgb(45, 77, 49);"
      >
        {showAdvancedSettings ? 'Hide' : 'Show'} advanced settings
        <md-icon slot="icon">
          {showAdvancedSettings ? 'expand_less' : 'expand_more'}
        </md-icon>
      </md-text-button>
    </div>

    {#if showAdvancedSettings}
      <div class="flex flex-col space-y-4" transition:slide={{ duration: 200 }}>
        <InputNumber
          bind:value={installationLifeSpan}
          icon="date_range"
          label={$isLoading ? "Installation lifespan" : $_('solarPotential.installationLifeSpan')}
          suffix="years"
          onChange={updateConfig}
        />

        <InputPercent
          bind:value={dcToAcDerateInput}
          icon="dynamic_form"
          label={$isLoading ? "DC to AC conversion " : $_('solarPotential.dcToAcDerate')}
          onChange={updateConfig}
        />

        <InputRatio
          bind:value={efficiencyDepreciationFactor}
          icon="trending_down"
          label={$isLoading ? "Panel efficiency decline per year" : $_('solarPotential.efficiencyDepreciation')}
          decrease
          onChange={updateConfig}
        />

        <InputRatio
          bind:value={costIncreaseFactor}
          icon="price_change"
          label={$isLoading ? "Energy cost increase per year" : $_('solarPotential.costIncreaseFactor')}
          onChange={updateConfig}
        />

        <InputRatio
          bind:value={discountRate}
          icon="local_offer"
          label={$isLoading ? "Discount rate per year" : $_('solarPotential.discountRate')}
          onChange={updateConfig}
        />
      </div>
    {/if}

    <!-- <div class="grid justify-items-end">
      <md-filled-tonal-button
        trailing-icon
        role={undefined}
        href="https://developers.google.com/maps/documentation/solar/calculate-costs-us"
        target="_blank"
      >
        More details
        <md-icon slot="icon">open_in_new</md-icon>
      </md-filled-tonal-button>
    </div> -->
  </div>
</Expandable>

<div class="absolute top-16 left-0">
  {#if expandedSection == title}
    <div class="flex flex-col space-y-2 m-2" style="color: rgb(14, 14, 14);">
      <SummaryCard
        {icon}
        {title}
        rows={[
          {
            icon: 'energy_savings_leaf',
            name: $isLoading ? 'Yearly energy' : $_('solarPotential.yearlyEnergy'),
            value: showNumber(
              (solarPanelConfigs[configId]?.yearlyEnergyDcKwh ?? 0) * panelCapacityRatio,
            ),
            units: 'kWh',
          },
          {
            icon: 'speed',
            name: $isLoading ? 'Installation size' : $_('solarPotential.installationSize'),
            value: showNumber(installationSizeKw),
            units: 'kW',
          },
          {
            icon: 'request_quote',
            name: $isLoading ? 'Installation cost' : $_('solarPotential.installationCost'),
            value: showMoney(installationCostTotal),
          },
          {
            icon: [
              'battery_0_bar',
              'battery_1_bar',
              'battery_2_bar',
              'battery_3_bar',
              'battery_4_bar',
              'battery_5_bar',
              'battery_full',
            ][Math.floor(Math.min(Math.round(energyCovered * 100) / 100, 1) * 6)],
            name: $isLoading ? 'Energy covered' : $_('solarPotential.energyCovered'),
            value: Math.round(energyCovered * 100).toString(),
            units: '%',
          },
        ]}
      />
    </div>

    <div class="mx-2 p-4 surface on-surface-text rounded-lg shadow-lg" style="color: rgb(14, 14, 14);">
      <div bind:this={costChart} />
      <div class="w-full secondary-text">
        <Table
          rows={[
            {
              icon: 'wallet',
              name: $isLoading ? 'Cost without solar' : $_('solarPotential.costWithoutSolar'),
              value: showMoney(totalCostWithoutSolar),
            },
            {
              icon: 'wb_sunny',
              name: $isLoading ? 'Cost with solar' : $_('solarPotential.costWithSolar'),
              value: showMoney(totalCostWithSolar),
            },
            {
              icon: 'savings',
              name: $isLoading ? 'Savings' : $_('solarPotential.savings'),
              value: showMoney(savings),
            },
            {
              icon: 'balance',
              name: $isLoading ? 'Break even' : $_('solarPotential.breakEven'),
              value:
                breakEvenYear >= 0
                  ? `${breakEvenYear + new Date().getFullYear() + 1} in ${breakEvenYear + 1}`
                  : '--',
              units: 'years',
            },
          ]}
        />
      </div>
    </div>
  {/if}
</div>
