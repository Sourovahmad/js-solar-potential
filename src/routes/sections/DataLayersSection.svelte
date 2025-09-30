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

  import { onMount } from 'svelte';

  import type { MdDialog } from '@material/web/dialog/dialog';
  import Calendar from '../components/Calendar.svelte';
  import Dropdown from '../components/Dropdown.svelte';
  import Expandable from '../components/Expandable.svelte';
  import { getLayer, type Layer } from '../layer';
  import {
    getDataLayerUrls,
    type BuildingInsightsResponse,
    type DataLayersResponse,
    type LayerId,
    type RequestError,
  } from '../solar';
  import InputBool from '../components/InputBool.svelte';
  import Show from '../components/Show.svelte';
  import SummaryCard from '../components/SummaryCard.svelte';
  import type { MdSlider } from '@material/web/slider/slider';
  import { overlayState } from './overlayState';
  import { get } from 'svelte/store';
  import { _, isLoading as i18nLoading } from 'svelte-i18n';

  export let expandedSection: string;
  export let showPanels = true;

  export let googleMapsApiKey: string;
  export let buildingInsights: BuildingInsightsResponse;
  export let isHeatmapLoading: boolean = false;
  export let loadingStep: string = '';
  

  export let geometryLibrary: google.maps.GeometryLibrary;
  export let map: google.maps.Map;

  const icon = 'layers';
  $: title = $i18nLoading ? 'Data Layers endpoint' : $_('sections.dataLayersEndpoint');

  const dataLayerOptions: Record<LayerId | 'none', string> = {
    none: 'No layer',
    mask: 'Roof mask',
    dsm: 'Digital Surface Model',
    rgb: 'Aerial image',
    annualFlux: 'Annual sunshine',
    monthlyFlux: 'Monthly sunshine',
    hourlyShade: 'Hourly shade',
  };

  $: monthNames = $i18nLoading ? [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ] : [
    $_('months.jan'),
    $_('months.feb'),
    $_('months.mar'),
    $_('months.apr'),
    $_('months.may'),
    $_('months.jun'),
    $_('months.jul'),
    $_('months.aug'),
    $_('months.sep'),
    $_('months.oct'),
    $_('months.nov'),
    $_('months.dec')
  ];

  let dataLayersResponse: DataLayersResponse | undefined;
  let requestError: RequestError | undefined;
  let apiResponseDialog: MdDialog;
  let layer: Layer | undefined;
  let imageryQuality: 'HIGH' | 'MEDIUM' | 'LOW';

  // Add computed variables for safe template usage
  let layerIdString = '';
  $: layerIdString = String(layerId);
  $: dataLayerOptionsName = $i18nLoading ? dataLayerOptions[layerId as keyof typeof dataLayerOptions] : (() => {
    const translations = {
      none: $_('dataLayers.noLayer'),
      mask: $_('dataLayers.roofMask'),
      dsm: $_('dataLayers.digitalSurfaceModel'),
      rgb: $_('dataLayers.aerialImage'),
      annualFlux: $_('dataLayers.annualSunshine'),
      monthlyFlux: $_('dataLayers.monthlySunshine'),
      hourlyShade: $_('dataLayers.hourlyShade'),
    };
    return translations[layerId as keyof typeof translations] || dataLayerOptions[layerId as keyof typeof dataLayerOptions];
  })();
  $: dataLayerOptionsString = $i18nLoading ? dataLayerOptions : {
    none: $_('dataLayers.noLayer'),
    mask: $_('dataLayers.roofMask'),
    dsm: $_('dataLayers.digitalSurfaceModel'),
    rgb: $_('dataLayers.aerialImage'),
    annualFlux: $_('dataLayers.annualSunshine'),
    monthlyFlux: $_('dataLayers.monthlySunshine'),
    hourlyShade: $_('dataLayers.hourlyShade'),
  };

  // Use store values
  $: ({ layerId, month, day, hour, playAnimation, tick } = $overlayState);

  // Update store on UI changes
  function setOverlayState(partial: Partial<import('./overlayState').OverlayState>) {
    overlayState.update(state => ({ ...state, ...partial }));
  }

  let overlays: google.maps.GroundOverlay[] = [];
  let showRoofOnly = false;
  let isLoading = false;
  
  async function showDataLayer(reset = false) {
    if (reset) {
      dataLayersResponse = undefined;
      requestError = undefined;
      layer = undefined;

      // Default values per layer.
      showRoofOnly = ['annualFlux', 'monthlyFlux', 'hourlyShade'].includes(layerId);
      map.setMapTypeId(layerId == 'rgb' ? 'roadmap' : 'satellite');
      overlays.map((overlay) => overlay.setMap(null));
      setOverlayState({ month: layerId == 'hourlyShade' ? 3 : 0, day: 14, hour: 5 });
      setOverlayState({ playAnimation: ['monthlyFlux', 'hourlyShade'].includes(layerId) });
    }
    if (layerId == 'none') {
      return;
    }

    if (!layer) {
      isLoading = true;
      isHeatmapLoading = true;
      try {
        const center = buildingInsights.center;
        const ne = buildingInsights.boundingBox.ne;
        const sw = buildingInsights.boundingBox.sw;
        const diameter = geometryLibrary.spherical.computeDistanceBetween(
          new google.maps.LatLng(ne.latitude, ne.longitude),
          new google.maps.LatLng(sw.latitude, sw.longitude),
        );
        const radius = Math.ceil(diameter / 2);
        
        try {
          loadingStep = 'Fetching data layer URLs...';
          dataLayersResponse = await getDataLayerUrls(center, radius, googleMapsApiKey);
        } catch (e) {
          console.error('Error fetching data layer URLs:', e);
          requestError = e as RequestError;
          return;
        } finally {
          isLoading = false;
        }

        imageryQuality = dataLayersResponse.imageryQuality;

        isLoading = true;
        try {
          loadingStep = 'Downloading and processing heatmap data...';
          layer = await getLayer(layerId as LayerId, dataLayersResponse, googleMapsApiKey);
        } catch (e) {
          console.error('Error creating layer:', e);
          requestError = e as RequestError;
          return;
        } finally {
          isLoading = false;
        }
      } catch (e) {
        console.error('Unexpected error in showDataLayer:', e);
        requestError = {
          error: {
            code: 500,
            message: 'An unexpected error occurred',
            status: 'INTERNAL_ERROR'
          }
        };
        return;
      } finally {
        isLoading = false;
        isHeatmapLoading = false;
      }
    }

    try {
      const bounds = layer.bounds;
      loadingStep = 'Rendering heatmap overlays...';
      overlays.map((overlay) => overlay.setMap(null));
      overlays = layer
        .render(showRoofOnly, month, day)
        .map((canvas) => new google.maps.GroundOverlay(canvas.toDataURL(), bounds));

      if (!['monthlyFlux', 'hourlyShade'].includes(layer.id)) {
        overlays[0].setMap(map);
      }
      
      // Mark heatmap loading as complete when overlays are rendered
      isHeatmapLoading = false;
    } catch (e) {
      console.error('Error rendering layer:', e);
      requestError = {
        error: {
          code: 500,
          message: 'Failed to render data layer',
          status: 'RENDER_ERROR'
        }
      };
      isHeatmapLoading = false;
    }
  }

  $: if (layer?.id == 'monthlyFlux') {
    overlays.map((overlay, i) => overlay.setMap(i == month ? map : null));
  } else if (layer?.id == 'hourlyShade') {
    overlays.map((overlay, i) => overlay.setMap(i == hour ? map : null));
  }

  function onSliderChange(event: Event) {
    const target = event.target as MdSlider;
    if (layer?.id == 'monthlyFlux') {
      if (target.valueStart != month) {
        setOverlayState({ month: target.valueStart ?? 0, tick: target.valueStart ?? 0 });
      } else if (target.valueEnd != month) {
        setOverlayState({ month: target.valueEnd ?? 0, tick: target.valueEnd ?? 0 });
      }
    } else if (layer?.id == 'hourlyShade') {
      if (target.valueStart != hour) {
        setOverlayState({ hour: target.valueStart ?? 0, tick: target.valueStart ?? 0 });
      } else if (target.valueEnd != hour) {
        setOverlayState({ hour: target.valueEnd ?? 0, tick: target.valueEnd ?? 0 });
      }
    }
  }

  $: if (layer?.id == 'monthlyFlux') {
    if (playAnimation) {
      setOverlayState({ month: tick % 12, tick: tick });
    } else {
      setOverlayState({ tick: month });
    }
  } else if (layer?.id == 'hourlyShade') {
    if (playAnimation) {
      setOverlayState({ hour: tick % 24, tick: tick });
    } else {
      setOverlayState({ tick: hour });
    }
  }

  let isMobile = false;
  let mountCalled = false;
  
  onMount(() => {
    isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    window.addEventListener('resize', () => {
      isMobile = window.innerWidth <= 768;
    });
    mountCalled = true;
    
    // Only call showDataLayer(true) if we have buildingInsights but no layer yet
    if (buildingInsights && !layer) {
      showDataLayer(true);
    }
  });
  
  // Call showDataLayer when buildingInsights become available after mount
  $: if (mountCalled && buildingInsights && !layer && layerId !== 'none') {
    showDataLayer(true);
  }

  function handleLayerIdChange(val: string) {
    setOverlayState({ layerId: val as LayerId | 'none' });
    layer = undefined;
    showDataLayer();
  }

  // Watch for buildingInsights changes and reset layer to force refresh
  let previousBuildingInsightsName: string | undefined;
  
  $: if (buildingInsights && buildingInsights.name !== previousBuildingInsightsName) {
    previousBuildingInsightsName = buildingInsights.name;
    
    // Reset layer to force re-fetching with new coordinates
    layer = undefined;
    dataLayersResponse = undefined;
    requestError = undefined;
    
    // Clear existing overlays
    overlays.map((overlay) => overlay.setMap(null));
    overlays = [];
    
    // Start showing heatmap loader
    if (layerId !== 'none') {
      isHeatmapLoading = true;
    }
    
    // Trigger showDataLayer if we have a valid layerId
    if (layerId !== 'none') {
      showDataLayer();
    }
  }
</script>

<style>
  @media (max-width: 768px) {
    .absolute.top-0.left-0.w-72 {
      position: static !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .absolute.bottom-6.left-0.w-full {
      position: static !important;
      width: 100% !important;
      margin-bottom: 0 !important;
      margin-top: 0.5rem !important;
    }
    .m-2 {
      margin: 0.5rem !important;
    }
    .p-4 {
      padding: 1rem !important;
    }
    .flex, .flex-col {
      flex-direction: column !important;
      gap: 0.75rem !important;
      align-items: stretch !important;
    }
    .w-full {
      width: 100% !important;
      max-width: 100% !important;
    }
    .rounded-full, .rounded-sm, .rounded-lg, .shadow-md {
      border-radius: 1rem !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important;
    }
    .justify-between, .justify-around {
      justify-content: stretch !important;
    }
    .label-large, .label-small {
      font-size: 1rem !important;
    }
  }
</style>

{#if requestError}
  <div class="error-container on-error-container-text">
    <Expandable section={title} icon="error" {title} subtitle={requestError.error.status}>
      <div class="grid place-items-center py-2 space-y-4">
        <div class="grid place-items-center">
          <p class="body-medium">
            Error on <code>dataLayers</code>
            {layerId} request
          </p>
          <p class="title-large">ERROR {requestError.error.code}</p>
          <p class="body-medium"><code>{requestError.error.status}</code></p>
          <p class="label-medium">{requestError.error.message}</p>
        </div>
        <md-filled-button role={undefined} on:click={() => showDataLayer(true)}>
          Retry
          <md-icon slot="icon">refresh</md-icon>
        </md-filled-button>
      </div>
    </Expandable>
  </div>
{:else}
  <Expandable bind:section={expandedSection} {icon} {title} subtitle={dataLayerOptionsName} secondary={false}>
    {#if !isMobile && layer && (layer.id == 'monthlyFlux' || layer.id == 'hourlyShade')}
      <div class="w-full flex flex-col items-center mb-2 month-changer-top">
        <div class="surface on-surface-text pr-4 text-center label-large rounded-full shadow-md w-full flex items-center justify-between">
          {#if layer.id == 'monthlyFlux'}
            <md-slider
              range
              min={0}
              max={11}
              value-start={month}
              value-end={month}
              on:input={onSliderChange}
              class="flex-1"
            />
            <span class="w-8">{monthNames[month]}</span>
          {:else if layer.id == 'hourlyShade'}
            <md-slider
              range
              min={0}
              max={23}
              value-start={hour}
              value-end={hour}
              on:input={onSliderChange}
              class="flex-1"
            />
            <span class="w-24 whitespace-nowrap">
              {monthNames[month]}
              {day},
              {#if hour == 0}
                12am
              {:else if hour < 10}
                {hour}am
              {:else if hour < 12}
                {hour}am
              {:else if hour == 12}
                12pm
              {:else if hour < 22}
                {hour - 12}pm
              {:else}
                {hour - 12}pm
              {/if}
            </span>
          {/if}
        </div>
      </div>
    {/if}
    <div class="flex flex-col space-y-2 px-2" >
      <span class="outline-text label-medium" style="color: rgb(14, 14, 14);">
        <b>{title}</b> provides raw and processed imagery and granular details on an area surrounding
        a location.
      </span>

      <Dropdown
        bind:value={layerIdString}
        options={dataLayerOptionsString}
        onChange={handleLayerIdChange}
      />

      {#if layerId == 'none'}
        <div />
      {:else if !layer || isLoading}
        <md-linear-progress four-color indeterminate />
        {#if isLoading}
          <span class="outline-text label-small">{$i18nLoading ? 'Loading data layer...' : $_('dataLayers.loadingDataLayer')}</span>
        {/if}
      {:else}
        {#if layer.id == 'hourlyShade'}
          <Calendar bind:month bind:day onChange={async () => showDataLayer()} />
        {/if}

        <span class="outline-text label-medium primary-text" style="color: rgb(14, 14, 14);">
          {#if imageryQuality == 'HIGH'}
            <p><b>{$i18nLoading ? 'Low altitude aerial imagery' : $_('dataLayers.lowAltitudeImagery')}</b> available.</p>
            <p>{$i18nLoading ? 'Imagery and DSM data were processed at' : $_('dataLayers.imageryProcessedAt')} <b>10 cm/pixel</b>.</p>
          {:else if imageryQuality == 'MEDIUM'}
            <p><b>{$i18nLoading ? 'AI augmented aerial imagery' : $_('dataLayers.aiAugmentedImagery')}</b> available.</p>
            <p>{$i18nLoading ? 'Imagery and DSM data were processed at' : $_('dataLayers.imageryProcessedAt')} <b>25 cm/pixel</b>.</p>
          {:else if imageryQuality == 'LOW'}
            <p><b>{$i18nLoading ? 'AI augmented aerial or satellite imagery' : $_('dataLayers.aiAugmentedSatelliteImagery')}</b> available.</p>
            <p>{$i18nLoading ? 'Imagery and DSM data were processed at' : $_('dataLayers.imageryProcessedAt')} <b>50 cm/pixel</b>.</p>
          {/if}
        </span>

        <InputBool bind:value={showPanels} label={$i18nLoading ? 'Solar panels' : $_('dataLayers.solarPanels')} />
        <InputBool bind:value={showRoofOnly} label={$i18nLoading ? 'Roof only' : $_('dataLayers.roofOnly')} onChange={() => showDataLayer()} />

        {#if ['monthlyFlux', 'hourlyShade'].includes(layerId)}
          <InputBool bind:value={playAnimation} label={$i18nLoading ? 'Play animation' : $_('dataLayers.playAnimation')} />
        {/if}
      {/if}
      <!-- <div class="flex flex-row">
        <div class="grow" />
        <md-filled-tonal-button role={undefined} on:click={() => apiResponseDialog.show()}>
          API response
        </md-filled-tonal-button>
      </div> -->

      <md-dialog bind:this={apiResponseDialog}>
        <div slot="headline">
          <div class="flex items-center primary-text">
            <md-icon>{icon}</md-icon>
            <b>&nbsp;{title}</b>
          </div>
        </div>
        <div slot="content">
          <Show value={dataLayersResponse} label="dataLayersResponse" />
        </div>
        <div slot="actions">
          <md-text-button role={undefined} on:click={() => apiResponseDialog.close()}>
            Close
          </md-text-button>
        </div>
      </md-dialog>
    </div>
  </Expandable>
{/if}

{#if isMobile}
  <div class="w-full mt-4">
    {#if expandedSection == title && layer}
      <div class="m-2">
        <SummaryCard {icon} {title} rows={[{ name: dataLayerOptionsName, value: '' }]}> 
          <div class="flex flex-col space-y-4">
            <p class="{layerId == 'monthlyFlux' ? 'primary-text' : 'outline-text'}">
              {#if layerId == 'mask'}
                The building mask image: one bit per pixel saying whether that pixel is considered to
                be part of a rooftop or not.
              {:else if layerId == 'dsm'}
                An image of the DSM (Digital Surface Model) of the region. Values are in meters above
                EGM96 geoid (i.e., sea level). Invalid locations (where we don't have data) are stored
                as -9999.
              {:else if layerId == 'rgb'}
                {$i18nLoading ? 'An image of RGB data (aerial photo) of the region.' : $_('dataLayers.rgbDescription')}
              {:else if layerId == 'annualFlux'}
                {$i18nLoading ? 'The annual flux map (annual sunlight on roofs) of the region. Values are kWh/kW/year. This is unmasked flux: flux is computed for every location, not just building rooftops. Invalid locations are stored as -9999: locations outside our coverage area will be invalid, and a few locations inside the coverage area, where we were unable to calculate flux, will also be invalid.' : $_('dataLayers.annualFluxDescription')}
              {:else if layerId == 'monthlyFlux'}
                {$i18nLoading ? 'The monthly flux map (sunlight on roofs, broken down by month) of the region. Values are kWh/kW/year. The GeoTIFF imagery file pointed to by this URL will contain twelve bands, corresponding to January...December, in order.' : $_('dataLayers.monthlyFluxDescription')}
              {:else if layerId == 'hourlyShade'}
                {$i18nLoading ? 'Twelve URLs for hourly shade, corresponding to January...December, in order. Each GeoTIFF imagery file will contain 24 bands, corresponding to the 24 hours of the day. Each pixel is a 32 bit integer, corresponding to the (up to) 31 days of that month; a 1 bit means that the corresponding location is able to see the sun at that day, of that hour, of that month. Invalid locations are stored as -9999 (since this is negative, it has bit 31 set, and no valid value could have bit 31 set as that would correspond to the 32nd day of the month).' : $_('dataLayers.hourlyShadeDescription')}
              {/if}
            </p>
            {#if layer.palette}
              <div>
                <div
                  class="h-2 outline rounded-sm"
                  style={`background: linear-gradient(to right, ${layer.palette.colors.map(
                    (hex) => '#' + hex,
                  )})`}
                />
                <div class="flex justify-between pt-1 label-small">
                  <span>{layer.palette.min}</span>
                  <span>{layer.palette.max}</span>
                </div>
              </div>
            {/if}
          </div>
        </SummaryCard>
      </div>
    {/if}
  </div>
{:else}
  <div class="absolute top-16 left-0 w-72">
    {#if expandedSection == title && layer}
      <div class="m-2">
        <SummaryCard {icon} {title} rows={[{ name: dataLayerOptionsName, value: '' }]}> 
          <div class="flex flex-col space-y-4">
            <p class="{layerId == 'monthlyFlux' ? 'primary-text' : 'outline-text'}">
              {#if layerId == 'mask'}
                The building mask image: one bit per pixel saying whether that pixel is considered to
                be part of a rooftop or not.
              {:else if layerId == 'dsm'}
                An image of the DSM (Digital Surface Model) of the region. Values are in meters above
                EGM96 geoid (i.e., sea level). Invalid locations (where we don't have data) are stored
                as -9999.
              {:else if layerId == 'rgb'}
                {$i18nLoading ? 'An image of RGB data (aerial photo) of the region.' : $_('dataLayers.rgbDescription')}
              {:else if layerId == 'annualFlux'}
                {$i18nLoading ? 'The annual flux map (annual sunlight on roofs) of the region. Values are kWh/kW/year. This is unmasked flux: flux is computed for every location, not just building rooftops. Invalid locations are stored as -9999: locations outside our coverage area will be invalid, and a few locations inside the coverage area, where we were unable to calculate flux, will also be invalid.' : $_('dataLayers.annualFluxDescription')}
              {:else if layerId == 'monthlyFlux'}
                {$i18nLoading ? 'The monthly flux map (sunlight on roofs, broken down by month) of the region. Values are kWh/kW/year. The GeoTIFF imagery file pointed to by this URL will contain twelve bands, corresponding to January...December, in order.' : $_('dataLayers.monthlyFluxDescription')}
              {:else if layerId == 'hourlyShade'}
                {$i18nLoading ? 'Twelve URLs for hourly shade, corresponding to January...December, in order. Each GeoTIFF imagery file will contain 24 bands, corresponding to the 24 hours of the day. Each pixel is a 32 bit integer, corresponding to the (up to) 31 days of that month; a 1 bit means that the corresponding location is able to see the sun at that day, of that hour, of that month. Invalid locations are stored as -9999 (since this is negative, it has bit 31 set, and no valid value could have bit 31 set as that would correspond to the 32nd day of the month).' : $_('dataLayers.hourlyShadeDescription')}
              {/if}
            </p>
            {#if layer.palette}
              <div>
                <div
                  class="h-2 outline rounded-sm"
                  style={`background: linear-gradient(to right, ${layer.palette.colors.map(
                    (hex) => '#' + hex,
                  )})`}
                />
                <div class="flex justify-between pt-1 label-small">
                  <span>{layer.palette.min}</span>
                  <span>{layer.palette.max}</span>
                </div>
              </div>
            {/if}
          </div>
        </SummaryCard>
      </div>
    {/if}
  </div>
{/if}
<div class="absolute bottom-6 left-0 w-full">
  <div class="md:mr-96 mr-80 grid place-items-center">
    {#if !isMobile && layer}
      <div
        class="flex items-center surface on-surface-text pr-4 text-center label-large rounded-full shadow-md"
      >
        {#if layer.id == 'monthlyFlux'}
          <md-slider
            range
            min={0}
            max={11}
            value-start={month}
            value-end={month}
            on:input={onSliderChange}
          />
          <span class="w-8">{monthNames[month]}</span>
        {:else if layer.id == 'hourlyShade'}
          <md-slider
            range
            min={0}
            max={23}
            value-start={hour}
            value-end={hour}
            on:input={onSliderChange}
          />
          <span class="w-24 whitespace-nowrap">
            {monthNames[month]}
            {day},
            {#if hour == 0}
              12am
            {:else if hour < 10}
              {hour}am
            {:else if hour < 12}
              {hour}am
            {:else if hour == 12}
              12pm
            {:else if hour < 22}
              {hour - 12}pm
            {:else}
              {hour - 12}pm
            {/if}
          </span>
        {/if}
      </div>
    {/if}
  </div>
</div>

