import type { Meta, StoryObj } from '@storybook/svelte';
import ConnectionError from './ConnectionError.svelte';

const meta = {
  title: 'UI/ConnectionError',
  component: ConnectionError,
  tags: ['autodocs'],
  argTypes: {
    errorMessage: {
      control: { type: 'text' },
    },
    instructions: {
      control: { type: 'text' },
    },
    retryLabel: {
      control: { type: 'text' },
    },
  },
} satisfies Meta<ConnectionError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    errorMessage: 'Failed to connect to WebSocket server',
  },
};

export const CustomErrorMessage: Story = {
  args: {
    errorMessage: 'Connection timeout. The server may be unavailable.',
  },
};

export const CustomInstructions: Story = {
  args: {
    errorMessage: 'WebSocket connection failed',
    instructions: 'Please check your network connection and try again.\nIf the problem persists, contact support.',
  },
};

export const CustomRetryLabel: Story = {
  args: {
    errorMessage: 'Connection lost',
    retryLabel: 'Reconnect',
  },
};

export const NoInstructions: Story = {
  args: {
    errorMessage: 'Unable to establish connection',
    instructions: '',
  },
};

export const FullCustom: Story = {
  args: {
    errorMessage: 'WebSocket server is not responding',
    instructions: 'To troubleshoot:\n1. Check if the server is running\n2. Verify your network connection\n3. Try refreshing the page',
    retryLabel: 'Try Again',
  },
};


