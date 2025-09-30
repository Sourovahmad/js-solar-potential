<script lang="ts">
  import { locale, locales } from 'svelte-i18n';
  import { onMount } from 'svelte';
  
  const languageOptions = [
    { value: 'en', label: '🇺🇸 English' },
    { value: 'it', label: '🇮🇹 Italiano' }
  ];
  
  let isGeolocationSet = false;
  
    onMount(() => {
    detectLocationAndSetLanguage();
  });
  
  async function detectLocationAndSetLanguage() {
    if (isGeolocationSet) return;
    
    try {
      // Try IP-based geolocation
      const response = await fetch('https://ipapi.co/json/');
      if (response.ok) {
        const data = await response.json();
        if (data.country_code === 'IT') {
          $locale = 'it';
          isGeolocationSet = true;
          return;
        }
      }
    } catch (error) {
      // Try alternative IP service
      try {
        const response = await fetch('https://ipinfo.io/json');
        const data = await response.json();
        if (data.country === 'IT') {
          $locale = 'it';
        }
      } catch (altError) {
        // Fallback to browser geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const { latitude, longitude } = position.coords;
                const response = await fetch(
                  `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                );
                const data = await response.json();
                if (data.countryCode === 'IT') {
                  $locale = 'it';
                }
              } catch (error) {
                // Silent fail
              }
            },
            () => {}, // Silent fail
            { timeout: 5000, enableHighAccuracy: false }
          );
        }
      }
    }
    isGeolocationSet = true;
  }
  
  function handleLanguageChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    $locale = target.value;
  }
</script>

<div class="language-switcher">
  <select 
    bind:value={$locale} 
    on:change={handleLanguageChange}
    class="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  >
    {#each languageOptions as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
</div>

<style>
  .language-switcher {
    display: flex;
    align-items: center;
  }
  
  select {
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  select:hover {
    border-color: #3b82f6;
  }
</style>
