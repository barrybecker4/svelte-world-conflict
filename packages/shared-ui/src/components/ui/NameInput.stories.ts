import type { Meta, StoryObj } from '@storybook/svelte';
import NameInput from './NameInput.svelte';

const meta = {
    title: 'UI/NameInput',
    component: NameInput,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: 'A name input component that allows users to enter their name with validation, error handling, and loading states. Supports two-way binding and emits a submit event when the form is submitted.'
            }
        },
        layout: 'centered',
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
        initialName: '',
        placeholder: 'Your name',
        maxlength: 20,
        title: 'Enter Your Name',
        buttonText: 'Continue',
        error: null,
        loading: false,
        autofocus: false
    },
    argTypes: {
        initialName: {
            control: { type: 'text' },
            description: 'Initial name value'
        },
        value: {
            control: { type: 'text' },
            description: 'Two-way bindable value'
        },
        placeholder: {
            control: { type: 'text' },
            description: 'Placeholder text for the input'
        },
        maxlength: {
            control: { type: 'number', min: 1, max: 50 },
            description: 'Maximum length of the input'
        },
        title: {
            control: { type: 'text' },
            description: 'Title displayed above the input (optional)'
        },
        buttonText: {
            control: { type: 'text' },
            description: 'Text displayed on the submit button'
        },
        error: {
            control: { type: 'text' },
            description: 'Error message to display (null to hide)'
        },
        loading: {
            control: { type: 'boolean' },
            description: 'Whether the component is in a loading state'
        },
        autofocus: {
            control: { type: 'boolean' },
            description: 'Whether to automatically focus the input'
        }
    }
} satisfies Meta<typeof NameInput>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with controls
export const WithControls: Story = {
    args: {
        initialName: '',
        placeholder: 'Your name',
        maxlength: 20,
        title: 'Enter Your Name',
        buttonText: 'Continue',
        error: null,
        loading: false,
        autofocus: false
    }
};

export const Default = {
    args: {
        placeholder: 'Your name',
        title: 'Enter Your Name',
        buttonText: 'Continue'
    }
};

export const WithInitialName = {
    args: {
        initialName: 'Commander',
        placeholder: 'Your name',
        title: 'Enter Your Name',
        buttonText: 'Continue'
    }
};

export const WithError = {
    args: {
        initialName: '',
        placeholder: 'Your name',
        title: 'Enter Your Name',
        buttonText: 'Continue',
        error: 'Name is already taken. Please choose another.'
    }
};

export const Loading = {
    args: {
        initialName: 'Commander',
        placeholder: 'Your name',
        title: 'Enter Your Name',
        buttonText: 'Continue',
        loading: true
    }
};

export const CustomPlaceholder = {
    args: {
        placeholder: 'Commander name...',
        title: 'Enter Your Name',
        buttonText: 'Continue'
    }
};

export const CustomTitle = {
    args: {
        placeholder: 'Your name',
        title: 'What should we call you?',
        buttonText: 'Continue'
    }
};

export const CustomButtonText = {
    args: {
        placeholder: 'Your name',
        title: 'Enter Your Name',
        buttonText: 'Join Game'
    }
};

export const WithoutTitle = {
    args: {
        placeholder: 'Your name',
        title: '',
        buttonText: 'Continue'
    }
};

export const WithMaxLength = {
    args: {
        placeholder: 'Your name',
        title: 'Enter Your Name',
        buttonText: 'Continue',
        maxlength: 10
    }
};

export const Autofocus = {
    args: {
        placeholder: 'Your name',
        title: 'Enter Your Name',
        buttonText: 'Continue',
        autofocus: true
    }
};

export const EmptyState = {
    args: {
        initialName: '',
        placeholder: 'Your name',
        title: 'Enter Your Name',
        buttonText: 'Continue',
        error: null,
        loading: false
    }
};

