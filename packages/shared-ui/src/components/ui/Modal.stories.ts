import type { Meta, StoryObj } from '@storybook/svelte';
import Modal from './Modal.svelte';

const meta = {
  title: 'UI/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: { type: 'boolean' },
    },
    title: {
      control: { type: 'text' },
    },
    showHeader: {
      control: { type: 'boolean' },
    },
    showCloseButton: {
      control: { type: 'boolean' },
    },
    width: {
      control: { type: 'text' },
    },
    height: {
      control: { type: 'text' },
    },
  },
} satisfies Meta<Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Modal Title',
    showHeader: true,
    showCloseButton: true,
    width: '500px',
    height: '90vh',
  },
};

export const WithoutHeader: Story = {
  args: {
    isOpen: true,
    showHeader: false,
    showCloseButton: false,
  },
};

export const LargeModal: Story = {
  args: {
    isOpen: true,
    title: 'Large Modal',
    width: '800px',
  },
};
