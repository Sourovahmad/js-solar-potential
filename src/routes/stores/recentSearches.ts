import { writable } from "svelte/store";
import { browser } from "$app/environment";

export interface RecentSearch {
  name: string;
  address: string;
  coordinates?: { lat: number; lng: number };
}

function createRecentSearches() {
  let initial: RecentSearch[] = [];

  if (browser) {
    try {
      const saved = localStorage.getItem("recentSearches");
      if (saved) {
        initial = JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load from localStorage", e);
    }
  }

  const { subscribe, set, update } = writable<RecentSearch[]>(initial);

  return {
    subscribe,
    add: (search: RecentSearch) =>
      update((items) => {
        const updated = [
          search,
          ...items.filter((i) => i.name !== search.name), 
        ].slice(0, 10);

        if (browser) {
          localStorage.setItem("recentSearches", JSON.stringify(updated));
        }
        return updated;
      }),
    clear: () => {
      if (browser) localStorage.removeItem("recentSearches");
      set([]);
    },
  };
}

export const recentSearches = createRecentSearches();
