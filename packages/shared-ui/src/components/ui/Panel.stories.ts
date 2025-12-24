import type { Meta, StoryObj } from '@storybook/svelte';
import Panel from './Panel.svelte';

const meta = {
  title: 'UI/Panel',
  component: Panel,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'dark', 'glass', 'error', 'success'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    padding: {
      control: { type: 'boolean' },
    },
    border: {
      control: { type: 'boolean' },
    },
    blur: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'default',
    size: 'md',
    padding: true,
    border: true,
    blur: false,
  },
};

export const Variants: Story = {
  args: {
    variant: 'default',
  },
};

export const Sizes: Story = {
  args: {
    size: 'md',
  },
};

export const NoPadding: Story = {
  args: {
    padding: false,
  },
};

export const NoBorder: Story = {
  args: {
    border: false,
  },
};

export const WithBlur: Story = {
  args: {
    blur: true,
    variant: 'glass',
  },
};
