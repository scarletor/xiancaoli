import { Schema, type, MapSchema } from "@colyseus/schema";

export interface IPiece {
  type: string;
  color: "red" | "black";
  x: number;
  y: number;
}

export type PlayerColor = "red" | "black";
export type GameState = "waiting_for_players" | "waiting_for_ready" | "playing" | "game_over";

export class ChineseChessState extends Schema {
  @type("string")
  currentTurn: PlayerColor = "red";

  @type({ map: "string" })
  players = new MapSchema<PlayerColor>();

  @type({ map: "boolean" })
  readyPlayers = new MapSchema<boolean>();

  @type("string")
  gameState: GameState = "waiting_for_players";

  @type("boolean")
  gameStarted: boolean = false;

  @type("boolean")
  gameOver: boolean = false;

  @type("string")
  winner: PlayerColor | "" = "";

  @type(["number"])
  board: number[] = [
    1, 2, 3, 4, 5, 4, 3, 2, 1,  // Red pieces (1-7)
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 6, 0, 0, 0, 0, 0, 6, 0,
    7, 0, 7, 0, 7, 0, 7, 0, 7,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    17, 0, 17, 0, 17, 0, 17, 0, 17,  // Black pieces (11-17)
    0, 16, 0, 0, 0, 0, 0, 16, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    11, 12, 13, 14, 15, 14, 13, 12, 11
  ];

  constructor() {
    super();
    this.initializeBoard();
  }

  initializeBoard() {
    // Initialize an empty board (9x10)
    this.board = new Array(90).fill(0);
    
    // Set up initial piece positions
    this.setupInitialPosition();
  }

  setupInitialPosition() {
    // Red pieces (1-7)
    // Black pieces (11-17)
    const redPieces = [1, 2, 3, 4, 5, 4, 3, 2, 1];  // Chariot=1, Horse=2, Elephant=3, Advisor=4, General=5, Cannon=6, Soldier=7
    const blackPieces = [11, 12, 13, 14, 15, 14, 13, 12, 11];  // Same pieces but +10 for black

    // Set up red pieces (bottom)
    for (let i = 0; i < 9; i++) {
      this.board[i] = redPieces[i];
    }
    // Red cannons
    this.board[19] = 6;  // Left cannon
    this.board[25] = 6;  // Right cannon
    // Red soldiers
    for (let i = 3; i < 9; i += 2) {
      this.board[27 + i] = 7;
    }

    // Set up black pieces (top)
    for (let i = 0; i < 9; i++) {
      this.board[81 + i] = blackPieces[i];
    }
    // Black cannons
    this.board[64] = 16;  // Left cannon
    this.board[70] = 16;  // Right cannon
    // Black soldiers
    for (let i = 3; i < 9; i += 2) {
      this.board[54 + i] = 17;
    }

    console.log("Initial board setup:", this.board);
  }
} 