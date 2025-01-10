const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

class CaroGame {
  constructor() {
    this.size = 20;
    this.resetGame();
  }

  resetGame() {
    this.gameState = Array(this.size * this.size).fill(null);
    this.currentPlayer = "X";
    this.gameActive = true;
    this.players = new Set();
  }

  makeMove(index, player, socketId) {
    if (
      !this.gameActive ||
      this.gameState[index] !== null ||
      player !== this.currentPlayer
    ) {
      return false;
    }

    this.gameState[index] = player;
    const winResult = this.checkWin(index, player);

    if (winResult.hasWon) {
      this.gameActive = false;
      return {
        success: true,
        gameOver: true,
        winningCells: winResult.winningCells,
      };
    }

    this.currentPlayer = this.currentPlayer === "X" ? "O" : "X";
    return { success: true, gameOver: false };
  }

  checkWin(index, player) {
    const directions = [
      [0, 1], // Horizontal
      [1, 0], // Vertical
      [1, 1], // Diagonal \
      [1, -1], // Diagonal /
    ];

    const row = Math.floor(index / this.size);
    const col = index % this.size;

    for (const [dx, dy] of directions) {
      const winningCells = [index];
      let count = 1;

      // Check both directions
      for (const dir of [-1, 1]) {
        let step = 1;
        while (true) {
          const r = row + dir * step * dx;
          const c = col + dir * step * dy;
          const idx = r * this.size + c;

          if (
            r >= 0 &&
            r < this.size &&
            c >= 0 &&
            c < this.size &&
            this.gameState[idx] === player
          ) {
            winningCells.push(idx);
            count++;
            step++;
          } else {
            break;
          }
        }
      }

      if (count >= 5) {
        return { hasWon: true, winningCells };
      }
    }

    return { hasWon: false, winningCells: [] };
  }
}

const app = express();
app.use(cors());
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const game = new CaroGame();

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);
  game.players.add(socket.id);

  // Send current game state to new player
  socket.emit("game-state", {
    board: game.gameState,
    currentPlayer: game.currentPlayer,
    gameActive: game.gameActive,
  });

  socket.on("make-move", ({ index, player }) => {
    const result = game.makeMove(index, player, socket.id);

    if (result.success) {
      io.emit("move-made", {
        index,
        player,
        currentPlayer: game.currentPlayer,
        gameActive: game.gameActive,
      });

      if (result.gameOver) {
        io.emit("game-over", {
          winner: player,
          winningCells: result.winningCells,
        });
      }
    }
  });

  socket.on("restart-game", () => {
    game.resetGame();
    io.emit("game-reset", {
      board: game.gameState,
      currentPlayer: game.currentPlayer,
      gameActive: game.gameActive,
    });
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    game.players.delete(socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
