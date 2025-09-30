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
  import '../app.css';
  import '../theme/theme.css';
  import '../lib/i18n';
  import { _, isLoading } from 'svelte-i18n';
  import LanguageSwitcher from './components/LanguageSwitcher.svelte';

  import '@material/web/button/elevated-button';
  import '@material/web/button/filled-button';
  import '@material/web/button/filled-tonal-button';
  import '@material/web/button/outlined-button';
  import '@material/web/button/text-button';
  import '@material/web/dialog/dialog';
  import '@material/web/divider/divider';
  import '@material/web/icon/icon';
  import '@material/web/iconbutton/filled-icon-button';
  import '@material/web/iconbutton/icon-button';
  import '@material/web/progress/circular-progress';
  import '@material/web/progress/linear-progress';
  import '@material/web/ripple/ripple';
  import '@material/web/slider/slider';
  import '@material/web/switch/switch';
  import '@material/web/textfield/filled-text-field';
  import '@material/web/textfield/outlined-text-field';

  // https://kit.svelte.dev/docs/configuration#version
  import { beforeNavigate } from '$app/navigation';
  import { updated } from '$app/stores';
  import { onMount } from 'svelte';
  let isMobile = false;
  function handleResize() {
    isMobile = window.innerWidth <= 768;
  }
  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  beforeNavigate(({ willUnload, to }) => {
    if ($updated && !willUnload && to?.url) {
      location.href = to.url.href;
    }
  });
</script>

<svelte:head>
  <title>Klaryo - Fotografia Energetica</title>
  <meta name="description" content="Klaryo - Fotografia Energetica" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap" rel="stylesheet" />
</svelte:head>

<style>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1.5rem;
  background: var(--md-sys-color-surface, #fff);
  box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04);
  font-family: 'Poppins', sans-serif;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  min-height: 56px;
}
.header-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.header-logo img {
  height: 32px;
  width: auto;
  display: block;
}
.header-link {
  color: var(--md-sys-color-primary, #2B9A47);
  text-decoration: none;
  font-weight: 500;
  font-size: 1rem;
  transition: color 0.2s;
}
.header-link:hover {
  color: var(--md-sys-color-secondary, #F9C846);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.header-spacer {
  height: 64px;
}
@media (max-width: 768px) {
  .header {
    padding: 0.25rem 0.75rem;
    min-height: 48px;
  }
  .header-logo img {
    height: 26px;
  }
  .header-link {
    font-size: 0.95rem;
  }
  .header-spacer {
    height: 52px;
  }
}
</style>

<div class="header">
  <div class="header-logo">
    <img src="https://cloud-1de12d.b-cdn.net/media/original/5218e9d86fadce683a898ac6b0656ae1/klaryo-blackv2-1.png" alt="Klaryo logo" />
    
  </div>
  <div class="header-actions">
    <LanguageSwitcher />
    <a class="header-link" href="https://www.klaryo.it" target="_blank" rel="noopener">{$isLoading ? 'Back to Klaryo' : $_('common.backToKlaryo')}</a>
  </div>
</div>
<div class="header-spacer"></div>
<main class="surface on-surface-text body-medium flex flex-col w-screen h-screen">
  <slot />
</main>
