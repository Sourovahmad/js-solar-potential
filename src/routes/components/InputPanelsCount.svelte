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
  import type { MdSlider } from '@material/web/slider/slider';
  import type { SolarPanelConfig } from '../solar';
  import { createEventDispatcher } from 'svelte';
  import { _, isLoading } from 'svelte-i18n';

  export let configId: number;
  export let solarPanelConfigs: SolarPanelConfig[];
  
  const dispatch = createEventDispatcher();

  function onChange(event: Event) {
    const target = event.target as MdSlider;
    const newConfigId = target.value ?? 0;
    configId = newConfigId;
    
    // Dispatch event to notify parent of config change
    dispatch('configIdChange', newConfigId);
  }
</script>

<div>
  <table class="table-auto w-full body-medium" style="color: rgb(14, 14, 14);">
    <tr>
      <td><md-icon>solar_power</md-icon> </td>
      <th class="pl-2 text-left">{$isLoading ? 'Panels count' : $_('buildingInsights.panelsCount')}</th>
      <td class="pl-2 text-right">
        <span>{solarPanelConfigs[configId].panelsCount} {$isLoading ? 'panels' : $_('buildingInsights.solarPanels')}</span>
      </td>
    </tr>
  </table>

  <md-slider
    class="w-full"
    value={configId}
    min={0}
    max={solarPanelConfigs.length - 1}
    on:change={onChange}
  />
</div>
