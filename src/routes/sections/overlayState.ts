import { writable } from 'svelte/store';

export interface OverlayState {
  layerId: string; // LayerId | 'none'
  month: number;
  day: number;
  hour: number;
  playAnimation: boolean;
  tick: number;
}

export const overlayState = writable<OverlayState>({
  layerId: 'monthlyFlux',
  month: 0,
  day: 14,
  hour: 0,
  playAnimation: true,
  tick: 0,
});

// Persistent timer for animation
if (typeof window !== 'undefined') {
  setInterval(() => {
    overlayState.update(state => ({ ...state, tick: state.tick + 1 }));
  }, 1000);
} 