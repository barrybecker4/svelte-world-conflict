import type { Meta, StoryObj } from '@storybook/svelte';
import Tooltip from './Tooltip.svelte';

const meta = {
  title: 'UI/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  argTypes: {
    x: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
    y: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
    width: {
      control: { type: 'range', min: 5, max: 20, step: 1 },
    },
    text: {
      control: { type: 'text' },
    },
  },
} satisfies Meta<Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: 'tooltip-1',
    x: 50,
    y: 50,
    width: 7,
    text: 'This is a tooltip',
    onDismiss: (id: string) => console.log('Dismissed:', id),
  },
};

export const TopLeft: Story = {
  args: {
    id: 'tooltip-2',
    x: 20,
    y: 20,
    width: 8,
    text: 'Top left tooltip',
    onDismiss: (id: string) => console.log('Dismissed:', id),
  },
};

export const BottomRight: Story = {
  args: {
    id: 'tooltip-3',
    x: 80,
    y: 80,
    width: 10,
    text: 'Bottom right tooltip with longer text',
    onDismiss: (id: string) => console.log('Dismissed:', id),
  },
};

export const Center: Story = {
  args: {
    id: 'tooltip-4',
    x: 50,
    y: 50,
    width: 12,
    text: 'Centered tooltip with more text content',
    onDismiss: (id: string) => console.log('Dismissed:', id),
  },
};
