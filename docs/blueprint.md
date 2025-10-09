# **App Name**: El Pueblo Duerme

## Core Features:

- Create Game: Allow users to create a new game with specific settings like max players, werewolves count, seer and doctor roles.
- Join Game: Enable players to join an existing game using a unique game ID and display name.
- Assign Roles: Automatically assign roles to players at the beginning of the game (werewolf, villager, seer, doctor).
- Night Phase Actions: Implement actions for werewolves to select a player to eliminate, the seer to investigate a player's role, and the doctor to save a player.
- Day Phase Voting: Implement a voting system for players to vote on who they believe is a werewolf.
- Game State Management: Manage the game state (waiting, in progress, finished) and phase (night, day, voting), updating the UI accordingly using Firebase.
- Real-time Updates: Leverage Firebase real-time listeners to update the UI for all players when changes occur (player joining, roles assigned, votes cast, phase changes).

## Style Guidelines:

- Primary color: Deep violet (#9400D3), evoking mystery and magic.
- Background color: Dark grey (#2E2E2E), providing a night-time atmosphere.
- Accent color: Electric purple (#BF40BF), used sparingly to highlight key interactive elements.
- Headline font: 'Playfair', a modern serif with a fashionable and high-end feel. Note: currently only Google Fonts are supported.
- Body font: 'PT Sans', a humanist sans-serif with a modern look. Note: currently only Google Fonts are supported.
- Use simple, symbolic icons (e.g., a wolf's head for werewolves, an eye for the seer) with a clean, minimalist style.
- Layout should be clean and intuitive, with clear distinctions between game phases and actions. Focus on user-friendliness and providing essential information at a glance.
- Use subtle animations to transition between phases (e.g., fade-in/fade-out effects) and to indicate player actions.