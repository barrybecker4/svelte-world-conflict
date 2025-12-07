export interface TutorialCard {
  title: string;
  icon: string;
  content: string[];
}

/**
 * Tutorial cards content for the game instructions modal.
 * Separated for easier content management and localization.
 */
export const TUTORIAL_CARDS: TutorialCard[] = [
  {
    title: "Objective (1/5)",
    icon: "🎯",
    content: [
      "Conquer the galaxy by <strong>capturing planets</strong> and defeating your opponents.",
      "The player with the <strong>most planets</strong> when time runs out wins!",
      "Eliminate all opponents to win <strong>immediately</strong>."
    ]
  },
  {
    title: "Planets (2/5)",
    icon: "🪐",
    content: [
      "Each planet produces <strong>resources</strong> based on its size.",
      "Larger planets produce <strong>more resources</strong> per minute.",
      "Use resources to <strong>build new ships</strong>.",
      "Click your planet to select it, then click again to <strong>build ships</strong>."
    ]
  },
  {
    title: "Armadas (3/5)",
    icon: "🚀",
    content: [
      "Select one of your planets, then click another planet to <strong>send ships</strong>.",
      "Armadas travel through space in <strong>real-time</strong>.",
      "Sending to your own planet = <strong>reinforcement</strong>.",
      "Sending to enemy/neutral planet = <strong>attack</strong>!"
    ]
  },
  {
    title: "Combat (4/5)",
    icon: "⚔️",
    content: [
      "Battles use <strong>Risk-style dice</strong> mechanics.",
      "Attackers roll up to <strong>3 dice</strong>, defenders up to <strong>2</strong>.",
      "Ties go to the <strong>defender</strong>.",
      "In multi-player battles, everyone attacks the <strong>weakest</strong>!"
    ]
  },
  {
    title: "Victory (5/5)",
    icon: "🏆",
    content: [
      "<strong>Last player standing</strong> wins immediately.",
      "If time runs out: <strong>most planets</strong> wins.",
      "Tiebreaker: most ships, then most resources."
    ]
  }
];

export const TOTAL_TUTORIAL_CARDS = TUTORIAL_CARDS.length;

