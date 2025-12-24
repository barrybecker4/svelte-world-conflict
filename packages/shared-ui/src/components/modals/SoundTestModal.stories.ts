import type { Meta, StoryObj } from '@storybook/svelte';
import SoundTestModal from './SoundTestModal.svelte';
import type { SoundItem } from '../../types';

const meta = {
  title: 'Modals/SoundTestModal',
  component: SoundTestModal,
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<SoundTestModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleSoundList: SoundItem[] = [
  { key: 'click', name: 'Click', icon: '🔘' },
  { key: 'hover', name: 'Hover', icon: '✨' },
  { key: 'victory', name: 'Victory', icon: '🎉' },
  { key: 'defeat', name: 'Defeat', icon: '💥' },
  { key: 'attack', name: 'Attack', icon: '⚔️' },
  { key: 'defend', name: 'Defend', icon: '🛡️' },
  { key: 'move', name: 'Move', icon: '👣' },
  { key: 'error', name: 'Error', icon: '❌' },
  { key: 'success', name: 'Success', icon: '✅' },
  { key: 'notification', name: 'Notification', icon: '🔔' },
];

const mockPlaySound = async (soundKey: string) => {
  console.log('Playing sound:', soundKey);
  // Simulate async sound playback
  await new Promise((resolve) => setTimeout(resolve, 300));
};

export const Default: Story = {
  args: {
    isOpen: true,
    soundList: sampleSoundList,
    onPlaySound: mockPlaySound,
    onclose: () => console.log('Modal closed'),
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    soundList: sampleSoundList,
    onPlaySound: mockPlaySound,
    onclose: () => console.log('Modal closed'),
  },
};

export const FewSounds: Story = {
  args: {
    isOpen: true,
    soundList: [
      { key: 'click', name: 'Click', icon: '🔘' },
      { key: 'hover', name: 'Hover', icon: '✨' },
      { key: 'victory', name: 'Victory', icon: '🎉' },
    ],
    onPlaySound: mockPlaySound,
    onclose: () => console.log('Modal closed'),
  },
};

export const ManySounds: Story = {
  args: {
    isOpen: true,
    soundList: [
      ...sampleSoundList,
      { key: 'ambient1', name: 'Ambient 1', icon: '🌊' },
      { key: 'ambient2', name: 'Ambient 2', icon: '🌲' },
      { key: 'ambient3', name: 'Ambient 3', icon: '🔥' },
      { key: 'ambient4', name: 'Ambient 4', icon: '❄️' },
      { key: 'ambient5', name: 'Ambient 5', icon: '⚡' },
    ],
    onPlaySound: mockPlaySound,
    onclose: () => console.log('Modal closed'),
  },
};
