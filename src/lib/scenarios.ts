import type { Scenario } from "./types";

const scenarios = [
  {
    id: "ordering_coffee",
    name: "Ordering Coffee",
    description: "Practice ordering at a cafe",
    category: "daily",
    icon: "☕",
    feedback_mode: "standard",
    source: "built_in",
    starter: "actor",
    actor_role: "A friendly barista at a busy cafe",
    actor_setting: "The Daily Grind cafe, mid-morning, moderately busy",
    actor_personality: "Warm but efficient, asks questions to be helpful",
    scenario_context:
      "Menu has espresso, latte, cappuccino, drip coffee, pastries. Prices not important. Cash or card both fine.",
    user_role: "A customer ordering coffee",
    starter_instruction:
      "Greet the customer warmly and ask what they'd like to order."
  },
  {
    id: "hotel_check_in",
    name: "Hotel Check-in",
    description: "Handle arrival, booking details, and requests",
    category: "daily",
    icon: "🏨",
    feedback_mode: "standard",
    source: "built_in",
    starter: "actor",
    actor_role: "A polite hotel front desk agent",
    actor_setting: "A city hotel lobby in the evening",
    actor_personality: "Professional, calm, and service-minded",
    scenario_context:
      "The user has a reservation, may ask about breakfast, Wi-Fi, late checkout, room type, and luggage storage.",
    user_role: "A guest checking into a hotel",
    starter_instruction:
      "Welcome the guest and ask for their name or reservation details."
  },
  {
    id: "restaurant_reservation",
    name: "Restaurant Reservation",
    description: "Book a table and ask practical questions",
    category: "daily",
    icon: "🍽️",
    feedback_mode: "standard",
    source: "built_in",
    starter: "user",
    starter_prompts: [
      "Hi, I'd like to make a reservation for tonight.",
      "Hello, do you have a table for two available?",
      "I'd like to book a table for Saturday evening."
    ],
    actor_role: "A restaurant host answering the phone",
    actor_setting: "A popular casual restaurant during dinner service",
    actor_personality: "Efficient, clear, and friendly",
    scenario_context:
      "The restaurant can discuss party size, time, dietary needs, outdoor seating, deposits, and wait times.",
    user_role: "A customer calling to reserve a table",
    starter_instruction:
      "Wait for the customer to start the call, then help with the reservation."
  },
  {
    id: "taxi_directions",
    name: "Taxi Directions",
    description: "Explain where to go and handle route questions",
    category: "daily",
    icon: "🚕",
    feedback_mode: "standard",
    source: "built_in",
    starter: "actor",
    actor_role: "A practical taxi driver",
    actor_setting: "Inside a taxi near a busy shopping area",
    actor_personality: "Direct, helpful, and a little busy",
    scenario_context:
      "The user needs to give a destination, discuss traffic, ask about payment, and clarify pickup/drop-off details.",
    user_role: "A passenger taking a taxi",
    starter_instruction:
      "Greet the passenger and ask where they are going."
  },
  {
    id: "team_meeting_update",
    name: "Team Meeting Update",
    description: "Give a work update and answer follow-up questions",
    category: "work",
    icon: "📊",
    feedback_mode: "standard",
    source: "built_in",
    starter: "actor",
    actor_role: "A project manager leading a short team meeting",
    actor_setting: "A weekly project status meeting on a video call",
    actor_personality: "Focused, supportive, and concise",
    scenario_context:
      "The user should share progress, blockers, timelines, and next steps. The manager may ask clarifying questions.",
    user_role: "A team member giving a project update",
    starter_instruction:
      "Open the meeting and ask the user to share their update."
  },
  {
    id: "coworker_help",
    name: "Asking a Coworker",
    description: "Ask for help without sounding too direct",
    category: "work",
    icon: "🤝",
    feedback_mode: "standard",
    source: "built_in",
    starter: "user",
    starter_prompts: [
      "Hey, do you have a minute? I need some help.",
      "Sorry to bother you — could you help me with something?",
      "Hi, I'm not sure how to handle this. Can I ask you?"
    ],
    actor_role: "A busy but friendly coworker",
    actor_setting: "A shared office chat after lunch",
    actor_personality: "Helpful, realistic, and mildly busy",
    scenario_context:
      "The user needs help with a task, file, deadline, or unclear instruction and should ask politely.",
    user_role: "A coworker asking for help",
    starter_instruction:
      "Wait for the user to ask for help, then respond like a real coworker."
  },
  {
    id: "small_talk_neighbor",
    name: "Small Talk",
    description: "Practice casual conversation with a neighbor",
    category: "social",
    icon: "💬",
    feedback_mode: "standard",
    source: "built_in",
    starter: "actor",
    actor_role: "A friendly neighbor you see in the elevator",
    actor_setting: "An apartment elevator on a weekday morning",
    actor_personality: "Casual, warm, and not too talkative",
    scenario_context:
      "Topics can include weather, weekend plans, building issues, work, errands, or light neighborhood comments.",
    user_role: "A neighbor making casual conversation",
    starter_instruction:
      "Make a short friendly comment and leave room for the user to reply."
  }
] satisfies Scenario[];

export function listScenarios(): Scenario[] {
  return scenarios;
}

export function getScenarioById(id: string): Scenario | undefined {
  return scenarios.find((scenario) => scenario.id === id);
}
