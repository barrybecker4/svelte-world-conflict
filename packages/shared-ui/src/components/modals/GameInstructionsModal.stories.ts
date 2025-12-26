import type { Meta, StoryObj } from '@storybook/svelte';
import GameInstructionsModal from './GameInstructionsModal.svelte';
import type { TutorialCard } from '../../types';

const meta = {
  title: 'Modals/GameInstructionsModal',
  component: GameInstructionsModal,
  tags: ['autodocs'],
  argTypes: {
    tutorialCards: {
      control: { type: 'object' },
    },
    gameTitle: {
      control: { type: 'text' },
    },
    subtitle: {
      control: { type: 'text' },
    },
    userName: {
      control: { type: 'text' },
    },
    version: {
      control: { type: 'text' },
    },
    creditsLink: {
      control: { type: 'text' },
    },
  },
} satisfies Meta<GameInstructionsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleTutorialCards: TutorialCard[] = [
  {
    title: 'Objective (1/5)',
    icon: '🎯',
    content: [
      'Conquer the galaxy by <strong>capturing planets</strong> and defeating your opponents.',
      'The player with the <strong>most planets</strong> when time runs out wins!',
      'Eliminate all opponents to win <strong>immediately</strong>.',
    ],
  },
  {
    title: 'Planets (2/5)',
    icon: '🪐',
    content: [
      'Each planet produces <strong>resources</strong> based on its size.',
      'Larger planets produce <strong>more resources</strong> per minute.',
      'Use resources to <strong>build new ships</strong>.',
      'Double click on a planet to <strong>build ships</strong> there.',
    ],
  },
  {
    title: 'Armadas (3/5)',
    icon: '🚀',
    content: [
      'Click on a source planet then drag to a destination planet to <strong>send ships</strong>.',
      'Armadas travel through space in <strong>real-time</strong>.',
      'Sending to your own planet = <strong>reinforcement</strong>.',
      'Sending to enemy/neutral planet = <strong>attack</strong>!',
    ],
  },
  {
    title: 'Combat (4/5)',
    icon: '⚔️',
    content: [
      'Battles use <strong>Risk-style dice</strong> mechanics.',
      'Attackers roll up to <strong>3 dice</strong>, defenders up to <strong>2</strong>.',
      'Ties go to the <strong>defender</strong>.',
      'In multi-player battles, everyone attacks the <strong>weakest</strong>!',
    ],
  },
  {
    title: 'Victory (5/5)',
    icon: '🏆',
    content: [
      '<strong>Last player standing</strong> wins immediately.',
      'If time runs out: <strong>most planets</strong> wins.',
      'Tiebreaker: most ships, then most resources.',
    ],
  },
];

const tutorialCardsWithImages: TutorialCard[] = [
  {
    title: 'Overview (1/3)',
    icon: '🌍',
    content: [
      'This is a <strong>strategy game</strong> for up to <strong>4 human or AI players</strong>.',
      'Players <strong>build armies</strong>, accumulate <strong>faith</strong>, and fight for <strong>world domination</strong>.',
    ],
    image: 'https://picsum.photos/400/300?random=1',
  },
  {
    title: 'How to win (2/3)',
    icon: '♛',
    content: [
      'The standard game lasts <strong>50 turns</strong>.',
      'Once time runs out, <strong>whoever has most regions, wins</strong>.',
      'Your <strong>soldiers</strong> conquer and defend <strong>regions</strong>.',
    ],
  },
  {
    title: 'Temples (3/3)',
    icon: '🏛️',
    content: [
      'Each player <strong>starts with one temple</strong> under their control.',
      'After your turn, each of your temples <strong>produces a new soldier</strong>.',
      "You can <strong>take over</strong> your enemies' temples, but upgrades will be lost.",
    ],
    image: 'https://picsum.photos/400/300?random=2',
  },
];

export const Default: Story = {
  args: {
    tutorialCards: sampleTutorialCards,
    gameTitle: 'Galactic Conflict',
    subtitle: 'A Real-Time Space Strategy Game',
    oncomplete: () => console.log('Instructions complete'),
    onclose: () => console.log('Modal closed'),
  },
};

export const WithImages: Story = {
  args: {
    tutorialCards: tutorialCardsWithImages,
    gameTitle: 'World Conflict',
    oncomplete: () => console.log('Instructions complete'),
    onclose: () => console.log('Modal closed'),
  },
};

export const WithUserInfo: Story = {
  args: {
    tutorialCards: sampleTutorialCards,
    gameTitle: 'World Conflict',
    userName: 'Player123',
    version: '1.2.3',
    creditsLink: 'https://github.com/barrybecker4/svelte-world-conflict/wiki/World-Conflict-History-and-Credits',
    oncomplete: () => console.log('Instructions complete'),
    onclose: () => console.log('Modal closed'),
  },
};

export const Minimal: Story = {
  args: {
    tutorialCards: sampleTutorialCards.slice(0, 3),
    oncomplete: () => console.log('Instructions complete'),
    onclose: () => console.log('Modal closed'),
  },
};

export const SingleCard: Story = {
  args: {
    tutorialCards: [sampleTutorialCards[0]],
    gameTitle: 'Quick Start',
    oncomplete: () => console.log('Instructions complete'),
    onclose: () => console.log('Modal closed'),
  },
};

