import type { Meta, StoryObj } from '@storybook/svelte';
import IconButton from './IconButton.svelte';

const meta = {
  title: 'UI/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'primary', 'danger'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'default',
    size: 'md',
    disabled: false,
    title: 'Icon Button',
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

export const States: Story = {
  args: {
    disabled: false,
  },
};
