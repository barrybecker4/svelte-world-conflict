// Shared types for UI components

export interface AudioSystem {
  isAudioEnabled: () => boolean;
  toggle: () => Promise<boolean>;
  playSound: (sound: string) => Promise<void>;
}

// Type guard to check if an object implements AudioSystem interface
export function implementsAudioSystem(obj: any): obj is AudioSystem {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.isAudioEnabled === 'function' &&
    typeof obj.toggle === 'function' &&
    typeof obj.playSound === 'function'
  );
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

// Tutorial types
export interface TutorialCard {
  title: string;
  icon: string;
  content: string[];
  image?: string;
}
