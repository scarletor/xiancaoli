import { Room, Client } from "colyseus";
import { ChineseChessState } from "./schema/ChineseChessState";

export class ChineseChessRoom extends Room<ChineseChessState> {
  maxClients = 2;

  onCreate(options: any) {
    console.log("Room created!");
    this.setState(new ChineseChessState());

    // Handle ready state
    this.onMessage("ready", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Set player as ready
      this.state.readyPlayers.set(client.sessionId, true);
      console.log(`Player ${player} (${client.sessionId}) is ready`);

      // Start game if both players are ready
      if (this.state.readyPlayers.size === 2) {
        console.log("All players ready, starting game!");
        this.state.gameState = "playing";
        this.state.gameStarted = true;
        this.state.currentTurn = "red"; // Red always starts
      }
    });

    // Handle play again request
    this.onMessage("playAgain", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      console.log(`Player ${player} wants to play again`);
      
      // Reset to initial state
      this.state.gameState = "waiting_for_ready";
      this.state.gameStarted = false;
      this.state.gameOver = false;
      this.state.winner = "";
      this.state.currentTurn = "red";
      
      // Clear ready states for all players
      this.state.readyPlayers.clear();
      
      // Reset the board to initial position
      this.state.initializeBoard();
      
      console.log("Game fully reset to initial state, ready for new game");
    });

    // Handle moves
    this.onMessage("move", (client, message) => {
      // Don't allow moves if game hasn't started
      if (this.state.gameState !== "playing") {
        console.log("Game is not in playing state");
        return;
      }

      console.log("Received move from", client.sessionId, ":", message);
      
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        console.log("Player not found");
        return;
      }

      // Validate if it's the player's turn
      if (this.state.currentTurn !== player) {
        console.log("Not player's turn. Current turn:", this.state.currentTurn, "Player:", player);
        return;
      }

      const { fromX, fromY, toX, toY } = message;
      console.log(`Move attempt: ${player} player from (${fromX},${fromY}) to (${toX},${toY})`);

      // Get the piece at the starting position
      const fromIndex = fromY * 9 + fromX;
      const piece = this.state.board[fromIndex];
      
      // Check if there's a piece at the starting position
      if (piece === 0) {
        console.log("No piece at starting position");
        return;
      }

      // Check if the piece belongs to the current player
      const isPieceRed = piece > 0 && piece < 10;
      const isPieceBlack = piece >= 10;
      console.log(`Piece validation - Piece: ${piece}, isPieceRed: ${isPieceRed}, isPieceBlack: ${isPieceBlack}, Player: ${player}`);
      
      if ((player === "red" && !isPieceRed) || (player === "black" && !isPieceBlack)) {
        console.log(`Piece (${piece}) doesn't belong to current player (${player}). Piece is ${isPieceRed ? 'red' : 'black'}`);
        return;
      }

      // Log the board state around the move
      console.log("Current board state around move:");
      for (let y = Math.max(0, fromY - 1); y <= Math.min(9, fromY + 1); y++) {
        let row = "";
        for (let x = Math.max(0, fromX - 1); x <= Math.min(8, fromX + 1); x++) {
          row += `${this.state.board[y * 9 + x]}\t`;
        }
        console.log(row);
      }

      // Validate the move
      if (this.isValidMove(fromX, fromY, toX, toY, piece, player)) {
        console.log("Move is valid, executing...");
        this.makeMove(fromX, fromY, toX, toY);
      } else {
        console.log("Invalid move");
      }
    });
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");
    
    // Only allow two players
    if (this.state.players.size >= 2) {
      throw new Error("Room is full");
    }

    // Check if there's already a player and what color they have
    let playerColor: "red" | "black";
    if (this.state.players.size === 0) {
      playerColor = "red";
      this.state.gameState = "waiting_for_players";
    } else {
      // Get the color of the existing player
      const existingColor = Array.from(this.state.players.values())[0];
      // Assign the opposite color
      playerColor = existingColor === "red" ? "black" : "red";
      // Both players are now present
      this.state.gameState = "waiting_for_ready";
    }

    this.state.players.set(client.sessionId, playerColor);
    console.log("Player", client.sessionId, "assigned color:", playerColor);
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");
    
    // Remove player from ready state and players list
    this.state.readyPlayers.delete(client.sessionId);
    const playerColor = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);

    // Reset game state if a player leaves
    if (this.state.gameState === "playing") {
      this.state.gameState = "game_over";
      this.state.gameStarted = false;
      this.state.gameOver = true;
      this.state.winner = playerColor === "red" ? "black" : "red";
      console.log("Game over, winner:", this.state.winner);
    } else if (this.state.players.size === 0) {
      // Reset to initial state if all players left
      this.state.gameState = "waiting_for_players";
    } else {
      // One player left, waiting for another
      this.state.gameState = "waiting_for_players";
      this.state.readyPlayers.clear();
    }
  }

  onDispose() {
    console.log("Room", this.roomId, "disposing...");
  }

  private isValidMove(fromX: number, fromY: number, toX: number, toY: number, piece: number, player: "red" | "black"): boolean {
    // Basic board boundary check
    if (fromX < 0 || fromX >= 9 || fromY < 0 || fromY >= 10 ||
        toX < 0 || toX >= 9 || toY < 0 || toY >= 10) {
      console.log("Move out of bounds");
      return false;
    }

    // Get the target piece
    const toIndex = toY * 9 + toX;
    const targetPiece = this.state.board[toIndex];

    // Can't capture your own pieces
    if (targetPiece !== 0) {
      const isMovingPieceRed = piece < 10;
      const isTargetPieceRed = targetPiece < 10;
      if (isMovingPieceRed === isTargetPieceRed) {
        console.log("Can't capture your own piece");
        return false;
      }
    }

    // Get piece type (1-7)
    const pieceType = piece % 10;
    const isRed = piece < 10;

    // Movement rules for each piece type
    switch (pieceType) {
      case 1: // Chariot (車)
        return this.isValidChariotMove(fromX, fromY, toX, toY);
      case 2: // Horse (馬)
        return this.isValidHorseMove(fromX, fromY, toX, toY);
      case 3: // Elephant (相/象)
        return this.isValidElephantMove(fromX, fromY, toX, toY, isRed);
      case 4: // Advisor (仕/士)
        return this.isValidAdvisorMove(fromX, fromY, toX, toY, isRed);
      case 5: // General (帥/將)
        return this.isValidGeneralMove(fromX, fromY, toX, toY, isRed);
      case 6: // Cannon (炮)
        return this.isValidCannonMove(fromX, fromY, toX, toY);
      case 7: // Soldier (兵/卒)
        return this.isValidSoldierMove(fromX, fromY, toX, toY, isRed);
      default:
        console.log("Unknown piece type:", pieceType);
        return false;
    }
  }

  private isValidChariotMove(fromX: number, fromY: number, toX: number, toY: number): boolean {
    // Chariot moves horizontally or vertically
    if (fromX !== toX && fromY !== toY) {
      return false;
    }

    // Check if path is clear
    if (fromX === toX) {
      // Vertical move
      const minY = Math.min(fromY, toY);
      const maxY = Math.max(fromY, toY);
      for (let y = minY + 1; y < maxY; y++) {
        if (this.state.board[y * 9 + fromX] !== 0) {
          return false;
        }
      }
    } else {
      // Horizontal move
      const minX = Math.min(fromX, toX);
      const maxX = Math.max(fromX, toX);
      for (let x = minX + 1; x < maxX; x++) {
        if (this.state.board[fromY * 9 + x] !== 0) {
          return false;
        }
      }
    }
    return true;
  }

  private isValidHorseMove(fromX: number, fromY: number, toX: number, toY: number): boolean {
    // Horse moves in L-shape: 2 steps in one direction and 1 step perpendicular
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);
    return (dx === 2 && dy === 1) || (dx === 1 && dy === 2);
  }

  private isValidElephantMove(fromX: number, fromY: number, toX: number, toY: number, isRed: boolean): boolean {
    // Elephant moves exactly 2 steps diagonally and cannot cross the river
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);
    
    // Check diagonal movement
    if (dx !== 2 || dy !== 2) {
      return false;
    }

    // Check if elephant stays on its side of the river
    if (isRed && toY >= 5) return false;
    if (!isRed && toY < 5) return false;

    return true;
  }

  private isValidAdvisorMove(fromX: number, fromY: number, toX: number, toY: number, isRed: boolean): boolean {
    // Advisor moves 1 step diagonally within the palace
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);

    // Check diagonal movement
    if (dx !== 1 || dy !== 1) {
      return false;
    }

    // Check palace boundaries (3x3 area)
    if (toX < 3 || toX > 5) return false;
    if (isRed && (toY < 0 || toY > 2)) return false;
    if (!isRed && (toY < 7 || toY > 9)) return false;

    return true;
  }

  private isValidGeneralMove(fromX: number, fromY: number, toX: number, toY: number, isRed: boolean): boolean {
    // General moves 1 step orthogonally within the palace
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);

    // Check orthogonal movement
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
      // Check palace boundaries
      if (toX < 3 || toX > 5) return false;
      if (isRed && (toY < 0 || toY > 2)) return false;
      if (!isRed && (toY < 7 || toY > 9)) return false;
      return true;
    }
    return false;
  }

  private isValidCannonMove(fromX: number, fromY: number, toX: number, toY: number): boolean {
    // Cannon moves like chariot but must jump exactly one piece to capture
    if (fromX !== toX && fromY !== toY) {
      return false;
    }

    const targetPiece = this.state.board[toY * 9 + toX];
    let piecesInPath = 0;

    if (fromX === toX) {
      // Vertical move
      const minY = Math.min(fromY, toY);
      const maxY = Math.max(fromY, toY);
      for (let y = minY + 1; y < maxY; y++) {
        if (this.state.board[y * 9 + fromX] !== 0) {
          piecesInPath++;
        }
      }
    } else {
      // Horizontal move
      const minX = Math.min(fromX, toX);
      const maxX = Math.max(fromX, toX);
      for (let x = minX + 1; x < maxX; x++) {
        if (this.state.board[fromY * 9 + x] !== 0) {
          piecesInPath++;
        }
      }
    }

    // If capturing, need exactly one piece in path
    if (targetPiece !== 0) {
      return piecesInPath === 1;
    }
    // If not capturing, path must be clear
    return piecesInPath === 0;
  }

  private isValidSoldierMove(fromX: number, fromY: number, toX: number, toY: number, isRed: boolean): boolean {
    const dx = Math.abs(toX - fromX);
    const dy = toY - fromY; // Use actual difference for direction

    // Red soldiers move up, black soldiers move down
    const correctDirection = isRed ? dy < 0 : dy > 0;

    // Before crossing river: only forward 1 step
    if (isRed && fromY > 4) {
      return dx === 0 && dy === -1;
    }
    if (!isRed && fromY < 5) {
      return dx === 0 && dy === 1;
    }

    // After crossing river: can move forward or sideways 1 step
    if (dx > 1 || Math.abs(dy) > 1) return false;
    if (dx === 1) return dy === 0;
    return correctDirection;
  }

  private makeMove(fromX: number, fromY: number, toX: number, toY: number) {
    const fromIndex = fromY * 9 + fromX;
    const toIndex = toY * 9 + toX;
    
    // Store the captured piece before making the move
    const capturedPiece = this.state.board[toIndex];
    const movingPiece = this.state.board[fromIndex];
    
    // Clear the original position
    this.state.board[fromIndex] = 0;
    
    // Set the new position
    this.state.board[toIndex] = movingPiece;

    console.log(`Moved piece ${movingPiece} from (${fromX},${fromY}) to (${toX},${toY})`);

    // Check if a General/Captain was captured (pieces 5 and 15)
    if (capturedPiece === 5 || capturedPiece === 15) {
        console.log(`General/Captain captured: ${capturedPiece}`);
        this.state.gameState = "game_over";
        this.state.gameOver = true;
        this.state.winner = capturedPiece === 5 ? "black" : "red";
        console.log(`Game Over! Winner: ${this.state.winner}`);
        return;
    }

    // Switch turns if game is not over
    this.state.currentTurn = this.state.currentTurn === "red" ? "black" : "red";
    console.log("Turn switched to", this.state.currentTurn);
  }
} 