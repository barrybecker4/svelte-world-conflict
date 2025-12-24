import type { Meta, StoryObj } from '@storybook/svelte';
import LoadingState from './LoadingState.svelte';

const meta = {
  title: 'UI/LoadingState',
  component: LoadingState,
  tags: ['autodocs'],
  argTypes: {
    loading: {
      control: { type: 'boolean' },
    },
    error: {
      control: { type: 'text' },
    },
    loadingText: {
      control: { type: 'text' },
    },
    showRetry: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<LoadingState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: {
    loading: true,
    error: null,
    loadingText: 'Loading...',
  },
};

export const Error: Story = {
  args: {
    loading: false,
    error: 'Something went wrong. Please try again.',
    showRetry: false,
  },
};

export const ErrorWithRetry: Story = {
  args: {
    loading: false,
    error: 'Failed to load data. Please try again.',
    showRetry: true,
    retryText: 'Try Again',
  },
};

export const Content: Story = {
  args: {
    loading: false,
    error: null,
  },
};

export const CardVariant: Story = {
  args: {
    loading: true,
    containerClass: 'card',
  },
};

export const InlineVariant: Story = {
  args: {
    loading: true,
    containerClass: 'inline',
  },
};
