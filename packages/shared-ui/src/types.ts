// Shared types for UI components

export interface AudioSystem {
  isAudioEnabled: () => boolean;
  toggle: () => Promise<boolean>;
  playSound: (sound: string) => Promise<void>;
}

export interface SoundItem {
  key: string;
  name: string;
  icon: string;
}

// Chart types
export interface Dataset {
  label: string;
  data: number[];
  color: string;
}
