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
  import Table from './Table.svelte';

  export let title: string = '';
  export let icon: string = '';
  export let rows: {
    name: string;
    value: string;
    units?: string;
    icon?: string;
  }[] = [];
</script>

<style>
.summary-card {
  width: 100%;
  max-width: 420px;
  margin: 0 auto 1rem auto;
  box-sizing: border-box;
  border-radius: 1.25rem;
  box-shadow: 0 2px 16px 0 rgba(0,0,0,0.08);
  background: var(--md-sys-color-surface, #fff);
  padding: 1.25rem 1rem 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.summary-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.summary-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--md-sys-color-primary);
}
@media (max-width: 768px) {
  .summary-card {
    max-width: 100vw;
    margin: 0 0 1rem 0;
    border-radius: 1.1rem;
    padding: 1rem 0.5rem 1.25rem 0.5rem;
    box-shadow: 0 2px 8px 0 rgba(0,0,0,0.08);
  }
  .summary-title {
    font-size: 1rem;
  }
}
</style>

<div class="summary-card surface on-surface-text">
  <div class="summary-header primary-text">
    <md-icon class="w-8">{icon}</md-icon>
    <p class="summary-title"><b>{title}</b></p>
  </div>
  <div class="py-3 w-full">
    <md-divider />
  </div>
  <div class="w-full secondary-text">
    <Table {rows} />
  </div>
  <slot />
</div>
