import type { Meta, StoryObj } from '@storybook/svelte';
import FloatingTextMessage from './FloatingTextMessage.svelte';
import FloatingTextDemo from './FloatingTextDemo.svelte';
import FloatingTextWrapper from './FloatingTextWrapper.svelte';

const meta = {
    title: 'UI/FloatingTextMessage',
    component: FloatingTextMessage,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: 'A floating text message component that displays text at a fixed position on the screen. The text automatically fades out after a specified duration. Useful for displaying game events like reinforcements, conquests, or eliminations.'
            }
        },
        layout: 'fullscreen',
        backgrounds: {
            default: 'dark',
            values: [
                {
                    name: 'dark',
                    value: '#1e3c72'
                }
            ]
        }
    },
    args: {
        x: 400,
        y: 300,
        text: '+5 Reinforcements',
        color: '#ffffff',
        duration: 10000
    },
    argTypes: {
        x: {
            control: { type: 'range', min: 0, max: 800, step: 10 },
            description: 'X position in pixels (fixed positioning)'
        },
        y: {
            control: { type: 'range', min: 0, max: 600, step: 10 },
            description: 'Y position in pixels (fixed positioning)'
        },
        text: {
            control: { type: 'text' },
            description: 'Text to display'
        },
        color: {
            control: { type: 'color' },
            description: 'Text color'
        },
        duration: {
            control: { type: 'range', min: 500, max: 10000, step: 100 },
            description: 'Duration in milliseconds before the message fades out'
        }
    }
} satisfies Meta<typeof FloatingTextMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

// Direct component story with controls
export const WithControls: Story = {
    args: {
        x: 400,
        y: 300,
        text: '+5 Reinforcements',
        color: '#ffffff',
        duration: 10000
    }
};

export const Default = {
    render: () => ({
        Component: FloatingTextWrapper,
        props: {
            x: 400,
            y: 300,
            text: '+5 Reinforcements',
            color: '#ffffff',
            duration: 10000
        }
    })
};

export const Conquered = {
    render: () => ({
        Component: FloatingTextWrapper,
        props: {
            x: 400,
            y: 300,
            text: 'Conquered!',
            color: '#ffee11',
            duration: 10000
        }
    })
};

export const Defended = {
    render: () => ({
        Component: FloatingTextWrapper,
        props: {
            x: 400,
            y: 300,
            text: 'Defended!',
            color: '#00ff00',
            duration: 10000
        }
    })
};

export const Elimination = {
    render: () => ({
        Component: FloatingTextWrapper,
        props: {
            x: 400,
            y: 300,
            text: 'Player has been eliminated!',
            color: '#ff6b6b',
            duration: 10000
        }
    })
};

export const TopLeft = {
    render: () => ({
        Component: FloatingTextWrapper,
        props: {
            x: 200,
            y: 150,
            text: 'Top Left',
            color: '#4a90e2',
            duration: 10000
        }
    })
};

export const BottomRight = {
    render: () => ({
        Component: FloatingTextWrapper,
        props: {
            x: 600,
            y: 450,
            text: 'Bottom Right',
            color: '#e24a4a',
            duration: 10000
        }
    })
};

export const Center = {
    render: () => ({
        Component: FloatingTextWrapper,
        props: {
            x: 400,
            y: 300,
            text: 'Centered Message',
            color: '#9b59b6',
            duration: 10000
        }
    })
};

export const LongText = {
    render: () => ({
        Component: FloatingTextWrapper,
        props: {
            x: 400,
            y: 300,
            text: 'This is a longer floating text message that demonstrates how it handles multiple words',
            color: '#f39c12',
            duration: 10000
        }
    })
};

// Demo story using a container component
export const InteractiveDemo = {
    render: () => ({
        Component: FloatingTextDemo,
        props: {
            messages: []
        }
    })
};
