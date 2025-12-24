import type { Meta, StoryObj } from '@storybook/svelte';
import Button from './Button.svelte';

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'danger', 'success', 'ghost'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
    loading: {
      control: { type: 'boolean' },
    },
    uppercase: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    uppercase: false,
  },
};

export const Variants: Story = {
  args: {
    variant: 'primary',
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
    loading: false,
  },
};

export const WithUppercase: Story = {
  args: {
    uppercase: true,
    variant: 'primary',
  },
};
