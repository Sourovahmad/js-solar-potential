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

  import * as GMAPILoader from '@googlemaps/js-api-loader';
  const { Loader } = GMAPILoader;

  import { onMount } from 'svelte';
  import SearchBar from './components/SearchBar.svelte';
  import Sections from './sections/Sections.svelte';
  import PDFDownloadButton from './components/PDFDownloadButton.svelte';
  import { onDestroy } from 'svelte';
  import { locationStore, updateLocation } from './stores/locationStore';
  import { panelConfigStore, updatePanelConfig } from './stores/panelConfigStore';
  import { _, locale, isLoading } from 'svelte-i18n';

  
  let isMobile = false;
  let showDrawer = false;
  
  function handleResize() {
    isMobile = window.innerWidth <= 768;
  }
  
  let cleanupFunctions: (() => void)[] = [];
  
  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    cleanupFunctions.push(() => window.removeEventListener('resize', handleResize));
  });
  
  onDestroy(() => {
    cleanupFunctions.forEach(cleanup => cleanup());
    cleanupFunctions = [];
  });
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const defaultPlace = {
    name: 'Via Mascagni 144, Modena',
    address: 'Via Mascagni 144, Modena',
  };
  let location: google.maps.LatLng | undefined;
  // Use the location store instead of local variable
  let locationName: string;
  $: locationName = $locationStore.name;
  const zoom = 17;
  

   // Initialize app.
  let mapElement: HTMLElement;
  let map: google.maps.Map;
  let geometryLibrary: google.maps.GeometryLibrary;
  let mapsLibrary: google.maps.MapsLibrary;
  let placesLibrary: google.maps.PlacesLibrary;
  onMount(async () => {
    // Load the Google Maps libraries.
    const loader = new Loader({ apiKey: googleMapsApiKey });
    const libraries = {
      geometry: loader.importLibrary('geometry'),
      maps: loader.importLibrary('maps'),
      places: loader.importLibrary('places'),
    };
    geometryLibrary = await libraries.geometry;
    mapsLibrary = await libraries.maps;
    placesLibrary = await libraries.places;

    // Get the address information for the default location.
  //   const geocoder = new google.maps.Geocoder();
  //   const geocoderResponse = await geocoder.geocode({
  //     address: defaultPlace.address,
  //   });
  //   const geocoderResult = geocoderResponse.results[0];

  //   function getComponent(components, type) {
  //   const comp = components.find(c => c.types.includes(type));
  //   return comp ? comp.long_name : null;
  // }

  // const city = getComponent(geocoderResult.address_components, "locality");
  // const country = getComponent(geocoderResult.address_components, "country");

  //   // Initialize the map at the desired location.
  //   location = {
  //     ...geocoderResult.geometry.location,
  //     city,
  //     country
  //   };
  //   // Update the location store with the geocoded result
  //   updateLocation({
  //     name: geocoderResult.formatted_address || defaultPlace.name,
  //     address: geocoderResult.formatted_address || defaultPlace.address,
  //     coordinates: { lat: location.lat(), lng: location.lng() }
  //   });
    map = new mapsLibrary.Map(mapElement, {
       center: { lat: 45.4642, lng: 9.18 }, // Milan
      zoom: zoom,
      tilt: 0,
      mapTypeId: 'satellite',
      mapTypeControl: false,
      fullscreenControl: false,
      rotateControl: false,
      streetViewControl: false,
      zoomControl: false,
    });

    // Make map cursor indicate it's clickable
    mapElement.style.cursor = 'crosshair';

    // Add click event listener for building selection
    let clickMarker: google.maps.Marker | undefined;
    
    map.addListener('click', async (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        console.log('Map clicked at:', event.latLng.lat(), event.latLng.lng());
        
        // Remove previous click marker if it exists
        if (clickMarker) {
          clickMarker.setMap(null);
        }
        
        // Add a temporary marker to show where user clicked
        clickMarker = new google.maps.Marker({
          position: event.latLng,
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          title: 'Analyzing this location...'
        });
        
        // Update the location to the clicked coordinates
        location = event.latLng;
        
        // Use reverse geocoding to get a readable address for the clicked location
        try {
          const geocoder = new google.maps.Geocoder();
          const geocoderResponse = await geocoder.geocode({
            location: event.latLng
          });
          
          if (geocoderResponse.results && geocoderResponse.results.length > 0) {
            const result = geocoderResponse.results[0];
            const clickedAddress = result.formatted_address || 'Unknown Location';
            
            console.log('Clicked location address:', clickedAddress);
            
            // Update the location store with the clicked location
            updateLocation({
              name: clickedAddress,
              address: clickedAddress,
              coordinates: { lat: event.latLng.lat(), lng: event.latLng.lng() }
            });
            
            // Remove the temporary marker after a short delay (it will be replaced by solar panels)
            setTimeout(() => {
              if (clickMarker) {
                clickMarker.setMap(null);
                clickMarker = undefined;
              }
            }, 2000);
            
            console.log('Updated location store with clicked location');
          }
        } catch (error) {
          console.error('Error reverse geocoding clicked location:', error);
          
          // Even if reverse geocoding fails, still update with coordinates
          const coordsString = `${event.latLng.lat().toFixed(5)}, ${event.latLng.lng().toFixed(5)}`;
          updateLocation({
            name: coordsString,
            address: coordsString,
            coordinates: { lat: event.latLng.lat(), lng: event.latLng.lng() }
          });
          
          // Remove the temporary marker after a short delay
          setTimeout(() => {
            if (clickMarker) {
              clickMarker.setMap(null);
              clickMarker = undefined;
            }
          }, 2000);
        }
      }
    });
  });

  // Month changer state for Data Layers endpoint
  let expandedSection = '';
  let month = 0;
  let day = 14;
  let hour = 0;
  let layerId = 'monthlyFlux';
  
  // Global loading state for heatmap
  let isHeatmapLoading = false;
  let heatmapLoadingStep = '';
  $: monthNames = $isLoading ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] : [
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
  $: hourLabel = (() => {
    if (layerId === 'hourlyShade') {
      if ($isLoading) {
        if (hour == 0) return '12am';
        if (hour < 10) return `${hour}am`;
        if (hour < 12) return `${hour}am`;
        if (hour == 12) return '12pm';
        if (hour < 22) return `${hour - 12}pm`;
        return `${hour - 12}pm`;
      } else {
        if (hour == 0) return $_('time.midnight');
        if (hour < 10) return `${hour}${$_('time.am')}`;
        if (hour < 12) return `${hour}${$_('time.am')}`;
        if (hour == 12) return $_('time.noon');
        if (hour < 22) return `${hour - 12}${$_('time.pm')}`;
        return `${hour - 12}${$_('time.pm')}`;
      }
    }
    return '';
  })();
</script>

{#if isMobile}
  <div class="relative w-full h-full bg-[#dde6ea]">
    <div class="absolute top-4 left-1/2 -translate-x-1/2 w-[90vw] max-w-xl z-20">
      <div class="flex flex-col items-center gap-3">
        {#if placesLibrary && map}
          <div class="rounded-full bg-[#e5e5e5] px-4 py-2 shadow-md">
            <SearchBar bind:location {map} initialValue="" on:locationChange={(e) => {
              // The location store is already updated in SearchBar component
            }} />
          </div>
          
          <!-- Click instruction -->
          <div class="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm text-center">
            <p class="text-sm text-gray-700">
              <span class="font-medium">💡 Tip:</span> 
              {$isLoading ? 'Click anywhere on the map to analyze that building' : $_('page.clickInstruction')}
            </p>
          </div>
        {/if}

      </div>
    </div>

    <div bind:this={mapElement} class="absolute inset-0 w-full h-full z-10" />
    
    <!-- Floating Heatmap Loader for Mobile -->
    {#if isHeatmapLoading}
      <div class="fixed bottom-36 right-4 z-30 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 flex items-center gap-2 border border-orange-200 max-w-[280px]">
        <div class="w-5 h-5 flex-shrink-0">
          <svg class="animate-spin w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <div class="flex flex-col min-w-0">
          <span class="text-sm font-semibold text-orange-800 truncate">Loading Heatmap</span>
          <span class="text-xs text-orange-600 truncate">{heatmapLoadingStep || 'Processing solar data...'}</span>
        </div>
      </div>
    {/if}
    

    
    <button class="fixed bottom-24 right-4 z-30 bg-white rounded-xl shadow-lg p-4 flex items-center justify-center gap-2" on:click={() => showDrawer = true} aria-label={$isLoading ? 'Open menu' : $_('page.openMenu')}>
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect y="5" width="24" height="2" rx="1" fill="#222"/><rect y="11" width="24" height="2" rx="1" fill="#222"/><rect y="17" width="24" height="2" rx="1" fill="#222"/></svg>
      <span class="text-base font-semibold" style="color: rgb(45, 77, 49);">{$isLoading ? 'Configure' : $_('page.configure')}</span>
    </button>
    
    <!-- Overlay backdrop -->
    {#if showDrawer}
      <div class="fixed inset-0 z-40 bg-black/30" on:click={() => showDrawer = false}></div>
    {/if}
    
    
    <!-- Drawer - now always rendered but hidden when closed -->
    <div class="fixed bottom-0 left-0 w-full z-50 bg-white rounded-t-2xl shadow-2xl p-4 max-h-[80vh] overflow-y-auto transition-transform duration-300 {showDrawer ? 'translate-y-0' : 'translate-y-full'}">
      {#if location}
        <Sections {location} {map} {geometryLibrary} {googleMapsApiKey}
          {locationName}
          {mapElement}
          bind:expandedSection
          bind:isHeatmapLoading 
          bind:heatmapLoadingStep />
      {/if}
      {#if !location}
      <div class="bg-white/90 ...">
        <p class="text-sm text-gray-700">
          <span class="font-medium">💡 Tip:</span>
          {$isLoading ? 'Search an address or click on the map to analyze a building' : $_('page.clickInstruction')}
        </p>
      </div>
    {/if}

      <span class="block pt-4 text-center outline-text label-small">{$isLoading ? '© 2025 Klaryo. All rights reserved.' : $_('page.copyright')}</span>
    </div>
  </div>
{:else}
  <div class="flex flex-row h-full">
    <div bind:this={mapElement} class="w-full relative">
      <!-- Floating Heatmap Loader for Desktop -->
      {#if isHeatmapLoading}
        <div class="absolute top-16 left-4 z-30 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 flex items-center gap-2 border border-orange-200 max-w-[300px]">
          <div class="w-5 h-5 flex-shrink-0">
            <svg class="animate-spin w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-semibold text-orange-800 truncate">Loading Heatmap</span>
            <span class="text-xs text-orange-600 truncate">{heatmapLoadingStep || 'Processing solar data...'}</span>
          </div>
        </div>
      {/if}
    </div>
    <aside class="flex-none md:w-96 w-80 p-2 pt-3 overflow-auto">
      <div class="flex flex-col space-y-2 h-full">
        {#if placesLibrary && map}
          <SearchBar bind:location {map} initialValue={defaultPlace.name} on:locationChange={(e) => {
            // The location store is already updated in SearchBar component
          }} />
          
          <!-- Click instruction for desktop -->
          
        {/if}

        <!-- <div class="p-4 surface-variant outline-text rounded-lg space-y-3">
        <p>
          <a
            class="primary-text"
            href="https://developers.google.com/maps/documentation/solar/overview?hl=en"
            target="_blank"
          >
            Two distinct endpoints of the <b>Solar API</b>
            <md-icon class="text-sm">open_in_new</md-icon>
          </a>
          offer many benefits to solar marketplace websites, solar installers, and solar SaaS designers.
        </p>

        <p>
          <b>Click on an area below</b>
          to see what type of information the Solar API can provide.
        </p>
      </div> -->

        {#if location}
          <Sections {location} {map} {geometryLibrary} {googleMapsApiKey}
            {locationName}
            {mapElement}
            bind:expandedSection 
            bind:isHeatmapLoading 
            bind:heatmapLoadingStep />
        {/if}

        <div class="grow" />

        <!-- <div class="flex flex-col items-center w-full">
        <md-text-button
          href="https://github.com/googlemaps-samples/js-solar-potential"
          target="_blank"
        >
          View code on GitHub
          <img slot="icon" src="github-mark.svg" alt="GitHub" width="16" height="16" />
        </md-text-button>
      </div> -->

        <span class="pb-4 text-center outline-text label-small" style="color: rgb(14, 14, 14);">
          {$isLoading ? '© 2025 Klaryo. All rights reserved.' : $_('page.copyright')}
        </span>
      </div>
    </aside>
  </div>
{/if}

<style>
  /* Smooth transition for the mobile drawer */
  .transition-transform {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
</style>
