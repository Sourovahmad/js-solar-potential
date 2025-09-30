import { browser } from '$app/environment';
import { init, register } from 'svelte-i18n';

const defaultLocale = 'en';

register('en', () => import('./en.json'));
register('it', () => import('./it.json'));

init({
  fallbackLocale: defaultLocale,
  initialLocale: defaultLocale, // Always start with English, let geolocation detection override
  loadingDelay: 200,
  warnOnMissingMessages: false,
});
