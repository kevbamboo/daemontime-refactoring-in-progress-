import { io, Socket } from "socket.io-client";

export type Game = {
  gameId: string;
  host: string;
  numPlayers: number;
  players: string[];
  started: boolean;
};

class SocketService {
  private socket: Socket | null = null;

  lobbyMessages: string[] = [];
  gameMessages: string[] = [];
  currentGameId = "";
  username = "";
  currentGameHost = "";
  isCurrentGameHost = false;

  private games = new Map<string, Game>();

  private gameListeners = new Set<(games: Game[]) => void>();

  connect(token: string, username?: string) {
    if (this.socket) {
      return;
    }

    if (username) {
      this.username = username;
    }
    this.socket = io("http://localhost:3000", {
      auth: {
        token,
      },
      autoConnect: false,
    });

    this.socket.on(
      "socket-identity",
      ({ username: socketUsername }: { username: string }) => {
        this.username = socketUsername;
      },
    );

    this.socket.on("connect", () => {
      console.log("Socket connected:", this.socket?.id);
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    this.socket.on("game-created", (game: Game) => {
      this.games.set(game.gameId, game);

      this.notifyGamesChanged();
    });

    this.socket.on("new-host", (gameId: string, host: string) => {
      let game = this.games.get(gameId);
      if (game) game.host = host;
      if (gameId === this.currentGameId) this.currentGameHost = host;
      if (gameId === this.currentGameId) {
        this.isCurrentGameHost = host === this.username;
      }
      this.notifyGamesChanged();
    });

    this.socket.on("game-players", (gameId: string, players: string[]) => {
      const game = this.games.get(gameId);
      if (game) {
        game.players = players;
        game.numPlayers = players.length;
      }
      this.notifyGamesChanged();
    });

    this.socket.on("game-started", (gameId: string) => {
      let game = this.games.get(gameId);
      if (game) game.started = true;

      this.notifyGamesChanged();
    });

    this.socket.on("game-deleted", (gameId: string) => {
      this.games.delete(gameId);

      this.notifyGamesChanged();
    });

    this.socket.on("lobby-message", (message: string) => {
      this.lobbyMessages.push(message);
    });

    this.socket.connect();
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  subscribeToGames(listener: (games: Game[]) => void) {
    this.gameListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.gameListeners.delete(listener);
    };
  }

  private notifyGamesChanged() {
    // is this async?
    const games = Array.from(this.games.values());

    console.log("NOTIFYING GAME LISTENERS", games);

    for (const listener of this.gameListeners) {
      listener(games);
    }
  }

  getGames(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve();
        return;
      }

      this.socket.emit("open-games", (games: Game[]) => {
        this.games = new Map(games.map((game) => [game.gameId, game]));

        this.notifyGamesChanged();

        resolve();
      });
    });
  }

  joinLobby(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve();
        return;
      }

      this.socket.emit("join-lobby", async () => {
        await this.getGames();

        resolve();
      });
    });
  }

  lobbyMessage(message: string) {
    this.lobbyMessages.push(message);
    this.socket?.emit("lobby-message", message);
  }

  setUpGameSockets(gameId: string): Promise<void> {
    return new Promise((resolve) => {
      this.currentGameId = gameId;

      this.socket?.on("game-message", (message: string) => {
        this.gameMessages.push(message);
      });

      this.socket?.on("new-question", () => {});

      this.socket?.on("new-scores", () => {});
      resolve();
    });
  }

  createGame(): Promise<Game> {
    return new Promise((resolve) => {
      console.log("created");
      this.socket?.emit("create-game", async (game: Game) => {
        this.games.set(game.gameId, game);
        this.currentGameHost = game.host;
        this.isCurrentGameHost = true;

        this.notifyGamesChanged();

        await this.setUpGameSockets(game.gameId);

        resolve(game);
      });
    });
  }

  joinGame(gameId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(false);
        return;
      }

      this.socket?.emit("join-game", gameId, (joined: boolean) => {
        if (joined) {
          this.currentGameId = gameId;
          this.isCurrentGameHost = false;
          this.notifyGamesChanged();
        }
        resolve(joined);
      }); // callback and resolve()
    });
  }

  startGame(gameId: string): Promise<void> {
    return new Promise((resolve) => {
      this.socket?.emit("start-game", gameId, () => {
        resolve();
      }); //callback and resolve()
    });
  }

  leaveGame(gameId: string): Promise<void> {
    return new Promise((resolve) => {
      this.socket?.emit("leave-game", gameId, () => {
        resolve();
      }); //callback and resolve()
    });
  }
}

export const socketService = new SocketService();
