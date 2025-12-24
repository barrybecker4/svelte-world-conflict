import type { Meta, StoryObj } from '@storybook/svelte';
import StatDisplay from './StatDisplay.svelte';
import type { StatItem } from './StatDisplay.svelte';

const meta = {
  title: 'UI/StatDisplay',
  component: StatDisplay,
  tags: ['autodocs'],
  argTypes: {
    columns: {
      control: { type: 'number', min: 1, max: 4 },
    },
    compact: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<StatDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleStats: StatItem[] = [
  { value: 100, label: 'Health', symbol: '❤️' },
  { value: 50, label: 'Mana', symbol: '💙' },
  { value: 25, label: 'Stamina', symbol: '⚡' },
  { value: 1000, label: 'Gold', symbol: '💰' },
];

export const Default: Story = {
  args: {
    items: sampleStats,
    columns: 2,
    compact: false,
  },
};

export const ThreeColumns: Story = {
  args: {
    items: [
      { value: 100, label: 'Health' },
      { value: 50, label: 'Mana' },
      { value: 25, label: 'Stamina' },
    ],
    columns: 3,
    compact: false,
  },
};

export const FourColumns: Story = {
  args: {
    items: sampleStats,
    columns: 4,
    compact: false,
  },
};

export const Compact: Story = {
  args: {
    items: sampleStats,
    columns: 2,
    compact: true,
  },
};

export const WithTooltips: Story = {
  args: {
    items: [
      { value: 100, label: 'Health', tooltip: 'Your current health points' },
      { value: 50, label: 'Mana', tooltip: 'Your current mana points' },
      { value: 25, label: 'Stamina', tooltip: 'Your current stamina' },
      { value: 1000, label: 'Gold', tooltip: 'Your current gold amount' },
    ],
    columns: 2,
    compact: false,
  },
};

export const SingleColumn: Story = {
  args: {
    items: sampleStats,
    columns: 1,
    compact: false,
  },
};
