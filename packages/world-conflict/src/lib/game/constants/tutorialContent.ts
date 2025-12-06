import { GAME_CONSTANTS } from './gameConstants';
import { SYMBOLS } from './symbols';

export interface TutorialCard {
  title: string;
  icon: string;
  content: string[];
  image?: string;
}

/**
 * Tutorial cards content for the game instructions modal.
 * Separated for easier content management and localization.
 */
export const TUTORIAL_CARDS: TutorialCard[] = [
  {
    title: "Overview (1/7)",
    icon: "🌍",
    content: [
      "This is a <strong>strategy game</strong> for up to <strong>4 human or AI players</strong>.",
      "Players <strong>build armies</strong>, accumulate <strong>faith</strong>, and fight for <strong>world domination</strong>."
    ],
    image: "/gameplay_zoom.png"
  },
  {
    title: "How to win (2/7)",
    icon: "♛",
    content: [
      `The standard game lasts <strong>${GAME_CONSTANTS.STANDARD_MAX_TURNS} turns</strong>.`,
      "Once time runs out, <strong>whoever has most regions, wins</strong>.",
      "Your <strong>soldiers</strong> conquer and defend <strong>regions</strong>.",
      "Your <strong>temples</strong> make new soldiers and can be <strong>upgraded</strong> with faith."
    ]
  },
  {
    title: "Temples (3/7)",
    icon: "🏛️",
    content: [
      "Each player <strong>starts with one temple</strong> under their control.",
      "After your turn, each of your temples <strong>produces a new soldier</strong>.",
      "You can <strong>take over</strong> your enemies' temples, but upgrades will be lost.",
      "There are <strong>neutral temples</strong> that you can conquer.",
      "Temples can be imbued with <strong>elemental powers</strong> using upgrades."
    ]
  },
  {
    title: "Soldiers (4/7)",
    icon: "⚔️",
    content: [
      "You have <strong>3 moves</strong> per turn.",
      "Soldiers can <strong>move between neighboring regions</strong>.",
      "An army that has conquered a region <strong>cannot move again</strong> that turn.",
      "Winning an attack <strong>conquers the region</strong>.",
      "Soldiers that conquer a region <strong>cannot move again</strong> that turn."
    ]
  },
  {
    title: "Combat (5/7)",
    icon: "🎲",
    content: [
      "Combat is resolved with <strong>dice rolls</strong>.",
      "Attacker and defender each roll dice based on army size.",
      "Higher dice rolls win - ties go to the <strong>defender</strong>.",
      "Losing armies are eliminated until one side has no soldiers.",
      "Strategy tip: <strong>attack with overwhelming force</strong>!"
    ]
  },
  {
    title: "Income (6/7)",
    icon: "💰",
    content: [
      `Once you end your turn, new <strong>faith</strong>(${SYMBOLS.FAITH}) is generated.`,
      "You get 1 <strong>for each region</strong> you have, and 1 <strong>for each soldier</strong> praying at a temple.",
      "You gain 1 when you <strong>kill an enemy soldier</strong>, and 1 when your <strong>soldier dies defending</strong>."
    ]
  },
  {
    title: "Upgrades (7/7)",
    icon: "✨",
    content: [
      `<strong>Elemental upgrades</strong> are purchased with <strong>faith</strong> (${SYMBOLS.FAITH}).`,
      "There are <strong>2 levels</strong> of each upgrade type.",
      "Instead of upgrading, you can use faith to <strong>recruit soldiers</strong>.",
      "Each soldier you recruit in a turn gets <strong>more expensive</strong>.",
      "If a region with an upgraded temple is defeated, the <strong>upgrade is lost with it</strong>."
    ]
  }
];

export const TOTAL_TUTORIAL_CARDS = TUTORIAL_CARDS.length;

