rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if a user is a player in the game
    function isPlayer(gameId) {
      return get(/databases/$(database)/documents/games/$(gameId)).data.players.exists(p => p.userId == request.auth.uid);
    }
    
    // Helper function to get player data from the current resource
    function getPlayer(players) {
        return players.filter(p => p.userId == request.auth.uid)[0];
    }
    
    // Helper function to get player data from the incoming request
    function getRequestPlayer(players) {
        return request.resource.data.players.filter(p => p.userId == request.auth.uid)[0]
    }

    match /games/{gameId} {
      // Allow any authenticated user to read game documents for joining/spectating.
      allow read: if request.auth != null;

      // Allow any authenticated user to create a new game document.
      allow create: if request.auth != null;
      
      // Define update rules
      allow update: if 
          // Rule 1: The user must be authenticated.
          request.auth != null &&
          (
            // Rule 2: Joining a game in 'waiting' state (either the first player or subsequent players).
            (
                resource.data.status == 'waiting' &&
                (
                    // Creator joining their own game (player list is initially empty)
                    (resource.data.players.size() == 0 && request.resource.data.players.size() == 1) ||
                    // Subsequent players joining
                    (request.resource.data.players.size() == resource.data.players.size() + 1)
                )
            ) ||
            // Rule 3: Updating your own player object (e.g., voting, submitting night action, changing avatar).
            (
                isPlayer(gameId) &&
                request.resource.data.players.size() == resource.data.players.size() &&
                (
                    // Voting during the day phase
                    (
                        request.resource.data.phase == 'day' &&
                        getPlayer(resource.data.players).votedFor == null &&
                        getRequestPlayer(request.resource.data.players).votedFor != null
                    ) ||
                    // Submitting a night action
                    (
                        request.resource.data.phase == 'night' &&
                        getPlayer(resource.data.players).usedNightAbility == false &&
                        getRequestPlayer(request.resource.data.players).usedNightAbility == true
                    ) ||
                     // Submitting a jury vote
                    (
                        request.resource.data.phase == 'jury_voting' &&
                        getPlayer(resource.data.players).isAlive == false
                    ) ||
                    // Changing avatar
                     (
                        getRequestPlayer(request.resource.data.players).avatarUrl != getPlayer(resource.data.players).avatarUrl
                     )
                )
            ) ||
             // Rule 4: Only the creator can start the game or change its state.
            (
                request.auth.uid == resource.data.creator &&
                (
                    // Starting the game
                    (
                        resource.data.status == 'waiting' && 
                        request.resource.data.status == 'in_progress'
                    ) ||
                    // Processing phases
                    (
                        resource.data.status == 'in_progress' &&
                        resource.data.phase != request.resource.data.phase
                    ) ||
                    // Resetting the game
                    (
                        resource.data.status == 'finished' &&
                        request.resource.data.status == 'waiting'
                    )
                )
            )
          );
    }
  }
}