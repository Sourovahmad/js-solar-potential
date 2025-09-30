import { writable } from 'svelte/store';

export interface LocationData {
  name: string;
  address: string;
  coordinates?: { lat: number; lng: number };
}

export const locationStore = writable<LocationData>({
  name: 'Via Mascagni 144, Modena',
  address: 'Via Mascagni 144, Modena'
});

// Helper function to update location
export function updateLocation(locationData: Partial<LocationData>) {
  locationStore.update(current => ({ ...current, ...locationData }));
}

// Helper function to get the best location name
export function getLocationName(locationData: LocationData): string {
  return locationData.name || locationData.address || 'Unknown Location';
} 