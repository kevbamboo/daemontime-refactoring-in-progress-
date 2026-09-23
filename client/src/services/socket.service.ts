import { io, Socket } from "socket.io-client";
export type Player = { id: string; username: string };
export type OnlineUser = Player;
export type GameOptions = { timeLimit: number; numberOfQuestions: number };
export type Game = GameOptions & {
  gameId: string;
  hostId: string;
  players: Player[];
  started: boolean;
  solo?: boolean;
  startedAt?: number;
};
export type ChatMessage = {
  id: string;
  userId: string;
  username: string;
  text: string;
  gameId: string | null;
};
export type GameQuestion = { index: number; text: string; choices: string[] };
export type ReviewQuestion = GameQuestion & {
  correctAnswer: number;
  yourAnswer: number | null;
  points: number;
  shortExplanation: string;
  longExplanation: string;
};
export type GameUpdate = {
  gameId: string;
  phase: "countdown" | "question" | "scoreboard" | "finished" | "interrupted";
  serverNow: number;
  receivedAt?: number;
  endsAt: number | null;
  questionIndex: number;
  totalQuestions: number;
  submitted: boolean;
  yourAnswer: number | null;
  scores: (Player & { score: number; submitted: boolean; active: boolean })[];
  question?: GameQuestion;
  review?: ReviewQuestion[];
  message?: string;
};
type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

class SocketService {
  private socket: Socket | null = null;
  private games: Game[] = [];
  private gameListeners = new Set<(games: Game[]) => void>();
  private gameUpdateListeners = new Set<(update: GameUpdate | null) => void>();
  private gameUpdate: GameUpdate | null = null;
  private acceptGameUpdate(update: GameUpdate | null) {
    this.gameUpdate = update;
    for (const listener of this.gameUpdateListeners) listener(update);
  }
  private messageListeners = new Set<() => void>();
  private statusListeners = new Set<() => void>();
  private onlineUserListeners = new Set<() => void>();
  error = "";
  ready = false;
  userId = "";
  username = "";
  lobbyMessages: ChatMessage[] = [];
  gameMessages: ChatMessage[] = [];
  onlineUsers: OnlineUser[] = [];
  get currentGame() {
    return this.games.find((g) => g.players.some((p) => p.id === this.userId));
  }
  get currentGameId() {
    return this.currentGame?.gameId ?? "";
  }
  get isCurrentGameHost() {
    return !!this.userId && this.currentGame?.hostId === this.userId;
  }
  private notifyStatus() {
    for (const listener of this.statusListeners) listener();
  }
  private acceptGames(games: Game[]) {
    const previous = this.currentGameId;
    this.games = games;
    if (previous !== this.currentGameId) {
      this.gameMessages = [];
      this.notifyMessages();
      this.acceptGameUpdate(null);
    }
    for (const listener of this.gameListeners) listener(this.games);
  }
  connect(token: string, userId: string) {
    if (this.socket && this.userId !== userId) this.disconnect();
    this.userId = userId;
    if (this.socket) {
      this.socket.auth = { token };
      if (!this.socket.connected) this.socket.connect();
      return;
    }
    const socket = io(
      import.meta.env.VITE_SOCKET_URL || window.location.origin,
      { auth: { token }, autoConnect: false },
    );
    this.socket = socket;
    socket.on(
      "socket-identity",
      (identity: { userId: string; username: string }) => {
        this.userId = identity.userId;
        this.username = identity.username;
      },
    );
    socket.on("connect", () => {
      void this.joinLobby().catch((error) => this.reportError(error));
    });
    socket.on("disconnect", () => {
      this.ready = false;
      this.error = "Connection lost. Reconnecting…";
      this.notifyStatus();
    });
    socket.on("connect_error", (error: Error) => this.reportError(error));
    socket.on("games-snapshot", (games: Game[]) => this.acceptGames(games));
    socket.on("game-update", (update: GameUpdate) => {
      if (update.gameId === this.currentGameId)
        this.acceptGameUpdate({ ...update, receivedAt: Date.now() });
    });
    socket.on("online-users", (users: OnlineUser[]) => {
      this.onlineUsers = users;
      for (const listener of this.onlineUserListeners) listener();
    });
    socket.on("chat-message", (message: ChatMessage) => {
      if (message.gameId === null)
        this.lobbyMessages = [...this.lobbyMessages.slice(-199), message];
      else if (message.gameId === this.currentGameId)
        this.gameMessages = [...this.gameMessages.slice(-199), message];
      this.notifyMessages();
    });
    socket.connect();
  }
  reportError(error: unknown) {
    this.error = error instanceof Error ? error.message : "Request failed";
    this.notifyStatus();
  }
  async retryConnection() {
    if (!this.socket) throw new Error("Sign in before connecting");
    if (!this.socket.connected) {
      this.socket.connect();
      return;
    }
    await this.joinLobby();
  }
  disconnect() {
    this.acceptGameUpdate(null);
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.ready = false;
    this.error = "";
    this.userId = "";
    this.username = "";
    this.lobbyMessages = [];
    this.gameMessages = [];
    this.onlineUsers = [];
    this.acceptGames([]);
    this.notifyMessages();
    this.notifyStatus();
  }
  subscribeToGames(listener: (games: Game[]) => void) {
    this.gameListeners.add(listener);
    listener(this.games);
    return () => {
      this.gameListeners.delete(listener);
    };
  }
  subscribeToGameUpdates(listener: (update: GameUpdate | null) => void) {
    this.gameUpdateListeners.add(listener);
    listener(this.gameUpdate);
    return () => {
      this.gameUpdateListeners.delete(listener);
    };
  }
  subscribeToStatus(listener: () => void) {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }
  subscribeToMessages(listener: () => void) {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }
  subscribeToOnlineUsers(listener: () => void) {
    this.onlineUserListeners.add(listener);
    listener();
    return () => {
      this.onlineUserListeners.delete(listener);
    };
  }
  private notifyMessages() {
    for (const listener of this.messageListeners) listener();
  }
  private request<T>(event: string, ...args: unknown[]): Promise<T> {
    const socket = this.socket;
    if (!socket?.connected)
      return Promise.reject(
        new Error("Not connected. Please retry when connected."),
      );
    return new Promise((resolve, reject) => {
      socket
        .timeout(8000)
        .emit(event, ...args, (error: Error | null, reply: Reply<T>) => {
          if (socket !== this.socket)
            return reject(new Error("Session changed"));
          if (error)
            return reject(new Error("Request timed out. Please retry."));
          if (!reply?.ok)
            return reject(new Error(reply?.error || "Invalid server response"));
          this.error = "";
          this.notifyStatus();
          resolve(reply.data);
        });
    });
  }
  async joinLobby() {
    const socket = this.socket;
    const games = await this.request<Game[]>("join-lobby");
    if (socket !== this.socket || !socket?.connected) return;
    this.acceptGames(games);
    this.ready = true;
    this.error = "";
    this.notifyStatus();
  }
  async createGame(options: GameOptions) {
    return this.request<Game>("create-game", options);
  }
  async joinGame(id: string) {
    return this.request<Game>("join-game", id);
  }
  async startGame(id: string) {
    return this.request<boolean>("start-game", id);
  }
  async submitAnswer(id: string, questionIndex: number, choice: number) {
    return this.request<boolean>("submit-answer", id, questionIndex, choice);
  }
  async leaveGame(id: string) {
    return this.request<boolean>("leave-game", id);
  }
  async sendMessage(text: string, gameId?: string) {
    return gameId
      ? this.request<boolean>("game-message", gameId, text)
      : this.request<boolean>("lobby-message", text);
  }
}
export const socketService = new SocketService();
