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
  import { updateLocation } from '../stores/locationStore';
  import { recentSearches } from '../stores/recentSearches';
  import { _, isLoading } from 'svelte-i18n';

  export let map: google.maps.Map; // existing map instance
  export let initialValue = ''; // pre-filled value (optional)
  export let zoom = 19; // zoom to apply after selection
  export let location: google.maps.LatLng | undefined;

  let container: HTMLDivElement; // wrapper for the widget
  let pacEl: HTMLElement; // PlaceAutocompleteElement instance
  let isUserTypeing = false;
  let tipOpen = false;
  let searchValue = '';

  const onKey = (e) => e.key === 'Escape' && (tipOpen = false);

  onMount(async () => {
    // 1. Load the Places library (new widgets live here too)
    (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;

    // 2. Create the widget
    //    You can pass options such as includedRegionCodes, locationBias, etc.
    //    Here we just keep it simple:
    //    @ts-ignore is still needed until @types/google.maps fully catches up.
    // @ts-ignore
    pacEl = new google.maps.places.PlaceAutocompleteElement();

    // Optional: pre-set a value
    if (initialValue) (pacEl as any).value = initialValue;

    // 3. Append to the DOM (or push to map controls if you prefer)
    container.appendChild(pacEl);

    // 4. Handle the selection event
    pacEl.addEventListener('focus', () => {
      console.log('Input focused');
      isUserTypeing = true;
    });

    pacEl.addEventListener('click', () => {
      if (searchValue) {
        isUserTypeing = true;
        searchValue = '';
      }
    });
    pacEl.addEventListener('gmp-select', async ({ placePrediction }: any) => {
      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport', 'addressComponents'],
      });

      // Center/zoom map similarly to your old code
      if (place.viewport) {
        map.fitBounds(place.viewport);
      } else if (place.location) {
        map.setCenter(place.location);
        map.setZoom(zoom);
      }

      // Expose the location back to the parent component

      const getPart = (types: string[]) => {
        const comps = (place as any).addressComponents as any[] | undefined;
        if (!Array.isArray(comps)) return null;
        const comp = comps.find(
          (c) => Array.isArray(c.types) && types.some((t) => c.types.includes(t)),
        );
        return comp
          ? (comp.longText ?? comp.long_name ?? comp.shortText ?? comp.short_name ?? null)
          : null;
      };

      const city =
        getPart(['locality']) ??
        getPart(['postal_town']) ??
        getPart(['sublocality', 'sublocality_level_1']) ??
        getPart(['administrative_area_level_2']);

      const country = getPart(['country']);
      location = {
        ...place.location,
        city,
        country,
      };

      // Use the best available name/address
      const locationName = place.displayName || place.formattedAddress || 'Unknown Location';
      const locationAddress = place.formattedAddress || place.displayName || 'Unknown Address';
      searchValue = place.formattedAddress;

      console.log('locationName in searchBar.svelte', locationName);
      console.log('place.displayName:', place.displayName);
      console.log('place.formattedAddress:', place.formattedAddress);

      // Update the central location store
      updateLocation({
        name: locationName,
        address: locationAddress,
        coordinates: place.location
          ? { lat: place.location.lat(), lng: place.location.lng() }
          : undefined,
      });

      recentSearches.add({
        name: locationName,
        address: locationAddress,
        coordinates: place.location
          ? { lat: place.location.lat(), lng: place.location.lng() }
          : undefined,
      });

      console.log('Updated location store with:', { name: locationName, address: locationAddress });

      // Dispatch custom event to update location name
      const event = new CustomEvent('locationChange', {
        detail: {
          location: place.location,
          name: locationName,
          address: locationAddress,
          locationName: locationName,
        },
      });
      container.dispatchEvent(event);
    });

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function clickOutside(node) {
    const handler = (e) => {
      if (!node.contains(e.target)) tipOpen = false;
    };
    document.addEventListener('click', handler, true);
    return {
      destroy() {
        document.removeEventListener('click', handler, true);
      },
    };
  }
</script>

<!-- The widget renders itself; this div is only a placeholder -->
<h1 class="text-2xl text-center font-bold mb-1 text-[#3f5b42] max-w-[300px] mx-auto">
  {$_('page.label')}
  <span class="flex items-center justify-center gap-x-2">
    {$_('page.label1')}
    <button
    type="button"
    aria-label="Show tip"
    aria-expanded={tipOpen}
    aria-controls="tip-popover"
    class=" cursor-pointer"
    on:mouseenter={() => (tipOpen = !tipOpen)}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-info-icon lucide-info"
      ><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg
    >
  </button>
  </span>
</h1>

{#if tipOpen}
  <div
    id="tip-popover"
    use:clickOutside
    class="absolute z-[110] top-[25%] md:top-[75%] left-1/2 md:left-[15%] -translate-x-1/2 w-[min(92vw,420px)]"
  >
    <div
      class="p-[1px] rounded-2xl bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-300 shadow-xl"
    >
      <div
        class="rounded-2xl bg-white/90 backdrop-blur-md p-5 md:p-6
                 ring-1 ring-black/5"
      >
        <div class="flex items-start gap-4">
          <div
            class="shrink-0 grid place-items-center h-10 w-10 rounded-full
                        bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-lightbulb-icon lucide-lightbulb"
              ><path
                d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"
              /><path d="M9 18h6" /><path d="M10 22h4" /></svg
            >
          </div>

          <div class="text-left">
            <p class="text-base md:text-lg text-slate-900 font-semibold">
              <span class="text-amber-600 font-bold">Tip:</span>
              {$isLoading
                ? 'Click anywhere on the map to analyze that building'
                : $_('page.clickInstruction')}
            </p>
            <p class="mt-2 text-slate-500 leading-relaxed">
              {$_('page.tipSubtitle') ??
                'Get instant insights about any location by simply clicking on the interactive map below.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
<div
  class={`autocomplete-wrapper ${isUserTypeing || searchValue ? 'has-value focused' : ''}`}
  bind:this={container}
>
  <span class="fake-placeholder">{$_('page.address')}</span>
</div>

<style>
  .autocomplete-wrapper {
    position: relative;
  }

  .form-label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #333;
    letter-spacing: 0.5px;
  }

  /* ফেইক প্লেসহোল্ডার স্টাইল */
  .fake-placeholder {
    position: absolute;
    top: 50%;
    left: 50px;
    transform: translateY(-50%);
    color: #aba7a7;
    font-size: 1rem;
    pointer-events: none;
    transition: opacity 0.2s ease-in-out;
  }

  .autocomplete-wrapper.focused .fake-placeholder,
  .autocomplete-wrapper.has-value .fake-placeholder {
    opacity: 0;
  }

  .autocomplete-wrapper :global(gmp-place-autocomplete) {
    width: 100%;
    min-height: 44px;
    font-size: 1rem;
  }
  @media (max-width: 768px) {
    .autocomplete-wrapper {
      width: 100%;
      min-width: 0;
      padding: 0;
    }
    .autocomplete-wrapper :global(gmp-place-autocomplete) {
      width: 100%;
      min-height: 48px;
      font-size: 1.1rem;
    }
    .fake-placeholder {
      font-size: 1.1rem;
    }
  }
</style>
