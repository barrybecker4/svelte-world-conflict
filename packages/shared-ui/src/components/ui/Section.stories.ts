import type { Meta, StoryObj } from '@storybook/svelte';
import Section from './Section.svelte';

const meta = {
  title: 'UI/Section',
  component: Section,
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: { type: 'text' },
    },
    subtitle: {
      control: { type: 'text' },
    },
    borderBottom: {
      control: { type: 'boolean' },
    },
    flex: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Section Title',
    subtitle: '',
    borderBottom: true,
    flex: false,
  },
};

export const WithSubtitle: Story = {
  args: {
    title: 'Section Title',
    subtitle: 'This is a subtitle',
    borderBottom: true,
  },
};

export const WithoutBorder: Story = {
  args: {
    title: 'Section without Border',
    borderBottom: false,
  },
};

export const FlexLayout: Story = {
  args: {
    title: 'Flex Section',
    flex: true,
    flexDirection: 'row',
    gap: '1rem',
  },
};
