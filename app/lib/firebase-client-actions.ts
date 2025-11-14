
'use client';
import { 
  createGame as createGameServer, 
  startGame as startGameServer, 
  submitHunterShot as submitHunterShotServer,
  submitTroublemakerAction as submitTroublemakerActionServer,
  sendWolfChatMessage as sendWolfChatMessageServer,
  sendFairyChatMessage as sendFairyChatMessageServer,
  sendLoversChatMessage as sendLoversChatMessageServer,
  sendTwinChatMessage as sendTwinChatMessageServer,
  sendGhostChatMessage as sendGhostChatMessageServer,
  sendChatMessage as sendChatMessageServer,
  submitVote as submitVoteServer,
  submitNightAction as submitNightActionServer,
  submitJuryVote as submitJuryVoteServer,
  sendGhostMessage as sendGhostMessageServer,
  joinGame as joinGameServer,
  resetGame as resetGameServer,
  processNight as processNightServer,
  processVotes as processVotesServer,
  processJuryVotes as processJuryVotesServer,
  executeMasterAction as executeMasterActionServer,
  updatePlayerAvatar as updatePlayerAvatarServer,
  getSeerResult as getSeerResultServer
} from './firebase-actions';

// Re-export server actions to be used in client components.
// This pattern helps separate server-only logic from client-callable functions.
export const createGame = createGameServer;
export const startGame = startGameServer;
export const joinGame = joinGameServer;
export const resetGame = resetGameServer;
export const submitHunterShot = submitHunterShotServer;
export const submitTroublemakerAction = submitTroublemakerActionServer;
export const sendWolfChatMessage = sendWolfChatMessageServer;
export const sendFairyChatMessage = sendFairyChatMessageServer;
export const sendLoversChatMessage = sendLoversChatMessageServer;
export const sendTwinChatMessage = sendTwinChatMessageServer;
export const sendGhostChatMessage = sendGhostChatMessageServer;
export const sendChatMessage = sendChatMessageServer;
export const submitVote = submitVoteServer;
export const submitNightAction = submitNightActionServer;
export const submitJuryVote = submitJuryVoteServer;
export const sendGhostMessage = sendGhostMessageServer;
export const processNight = processNightServer;
export const processVotes = processVotesServer;
export const processJuryVotes = processJuryVotesServer;
export const executeMasterAction = executeMasterActionServer;
export const updatePlayerAvatar = updatePlayerAvatarServer;
export const getSeerResult = getSeerResultServer;
