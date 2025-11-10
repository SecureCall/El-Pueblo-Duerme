
'use client';

// This file is now a re-exporter for server actions.
// All client-side Firestore logic has been moved to firebase-actions.ts (marked with 'use client')
// to ensure the Firestore instance is always available.

export { 
    createGame,
    joinGame,
    updatePlayerAvatar,
    startGame,
    submitHunterShot,
    submitTroublemakerAction,
    sendWolfChatMessage,
    sendFairyChatMessage,
    sendLoversChatMessage,
    sendTwinChatMessage,
    sendGhostChatMessage,
    sendChatMessage,
    submitVote,
    submitNightAction,
    submitJuryVote,
    sendGhostMessage,
    getSeerResult,
    executeMasterAction,
    processNight,
    processVotes,
    processJuryVotes
} from './firebase-actions';
