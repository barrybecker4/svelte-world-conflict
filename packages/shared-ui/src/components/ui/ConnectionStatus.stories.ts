import type { Meta, StoryObj } from '@storybook/svelte';
import ConnectionStatus from './ConnectionStatus.svelte';

const meta = {
  title: 'UI/ConnectionStatus',
  component: ConnectionStatus,
  tags: ['autodocs'],
  argTypes: {
    isConnected: {
      control: { type: 'boolean' },
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<ConnectionStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {
  args: {
    isConnected: true,
    size: 'md',
  },
};

export const Disconnected: Story = {
  args: {
    isConnected: false,
    size: 'md',
  },
};

export const Sizes: Story = {
  args: {
    isConnected: true,
    size: 'md',
  },
};
