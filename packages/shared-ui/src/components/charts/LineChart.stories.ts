import type { Meta, StoryObj } from '@storybook/svelte';
import LineChart from './LineChart.svelte';
import type { Dataset } from '../../types';

const meta = {
  title: 'Charts/LineChart',
  component: LineChart,
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: { type: 'text' },
    },
    height: {
      control: { type: 'text' },
    },
  },
} satisfies Meta<LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const Default: Story = {
  args: {
    title: 'Monthly Revenue',
    labels: sampleLabels,
    datasets: [
      {
        label: 'Revenue',
        data: [100, 120, 115, 134, 168, 132, 200, 185, 210, 195, 220, 240],
        color: '#3b82f6',
      },
    ],
    height: '250px',
  },
};

export const MultipleDatasets: Story = {
  args: {
    title: 'Revenue vs Expenses',
    labels: sampleLabels,
    datasets: [
      {
        label: 'Revenue',
        data: [100, 120, 115, 134, 168, 132, 200, 185, 210, 195, 220, 240],
        color: '#3b82f6',
      },
      {
        label: 'Expenses',
        data: [80, 90, 85, 95, 110, 100, 120, 115, 130, 125, 140, 150],
        color: '#ef4444',
      },
    ],
    height: '300px',
  },
};

export const SingleDataset: Story = {
  args: {
    title: 'User Growth',
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Users',
        data: [100, 150, 200, 250],
        color: '#10b981',
      },
    ],
    height: '200px',
  },
};

export const ThreeDatasets: Story = {
  args: {
    title: 'Performance Metrics',
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [
      {
        label: 'Sales',
        data: [1000, 1200, 1100, 1300],
        color: '#3b82f6',
      },
      {
        label: 'Marketing',
        data: [500, 600, 550, 700],
        color: '#10b981',
      },
      {
        label: 'Support',
        data: [300, 350, 320, 380],
        color: '#f59e0b',
      },
    ],
    height: '350px',
  },
};

export const TallChart: Story = {
  args: {
    title: 'Yearly Overview',
    labels: sampleLabels,
    datasets: [
      {
        label: 'Revenue',
        data: [100, 120, 115, 134, 168, 132, 200, 185, 210, 195, 220, 240],
        color: '#3b82f6',
      },
      {
        label: 'Expenses',
        data: [80, 90, 85, 95, 110, 100, 120, 115, 130, 125, 140, 150],
        color: '#ef4444',
      },
    ],
    height: '500px',
  },
};
