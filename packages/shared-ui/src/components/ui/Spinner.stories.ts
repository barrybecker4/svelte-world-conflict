import type { Meta, StoryObj } from '@storybook/svelte';
import Spinner from './Spinner.svelte';

const meta = {
  title: 'UI/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    color: {
      control: { type: 'select' },
      options: ['primary', 'blue', 'teal', 'white'],
    },
    text: {
      control: { type: 'text' },
    },
  },
} satisfies Meta<Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: 'md',
    color: 'primary',
    text: '',
  },
};

export const Sizes: Story = {
  args: {
    size: 'md',
  },
};

export const Colors: Story = {
  args: {
    color: 'primary',
  },
};

export const WithText: Story = {
  args: {
    size: 'lg',
    color: 'primary',
    text: 'Loading...',
  },
};
