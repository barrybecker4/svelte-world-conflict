import type { Meta, StoryObj } from '@storybook/svelte';
import AudioButton from './AudioButton.svelte';
import type { AudioSystem } from '../../types';

const meta = {
  title: 'Audio/AudioButton',
  component: AudioButton,
  tags: ['autodocs'],
  argTypes: {
    testSound: {
      control: { type: 'text' },
    },
  },
} satisfies Meta<AudioButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock audio system for Storybook
const createMockAudioSystem = (initialState: boolean = false): AudioSystem => {
  let enabled = initialState;
  
  return {
    isAudioEnabled: () => enabled,
    toggle: async () => {
      enabled = !enabled;
      console.log('Audio toggled:', enabled ? 'ON' : 'OFF');
      return enabled;
    },
    playSound: async (sound: string) => {
      if (enabled) {
        console.log('Playing sound:', sound);
      } else {
        console.log('Audio disabled, not playing:', sound);
      }
    },
  };
};

export const AudioEnabled: Story = {
  args: {
    audioSystem: createMockAudioSystem(true),
    testSound: 'click',
  },
};

export const AudioDisabled: Story = {
  args: {
    audioSystem: createMockAudioSystem(false),
    testSound: 'click',
  },
};

export const WithTestSound: Story = {
  args: {
    audioSystem: createMockAudioSystem(true),
    testSound: 'victory',
  },
};

export const WithoutTestSound: Story = {
  args: {
    audioSystem: createMockAudioSystem(true),
    testSound: undefined,
  },
};
