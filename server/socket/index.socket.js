import { randomUUID } from "node:crypto";
import { createGameSessions, normalizeQuestion } from "./game-session.js";
const ack = (cb, value) => {
  if (typeof cb === "function") cb(value);
};
const room = (id) => `game:${id}`;
const validGameSetting = (value) =>
  Number.isInteger(value) && value >= 5 && value <= 99;
function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export async function loadQuestionBank(supabase) {
  if (!supabase) throw new Error("Question database is not configured.");
  const questions = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("questions")
      .select(
        "id,question,choices,answer,difficulty,short_explanation,long_explanation,source,type",
      )
      .order("id")
      .range(offset, offset + 999)
      .abortSignal(AbortSignal.timeout(5000));
    if (error || !Array.isArray(data))
      throw new Error(
        "Unable to load questions. Check the questions table columns.",
      );
    questions.push(...data.map(normalizeQuestion));
    if (data.length < 1000) return questions;
  }
}

export default function setUpSocket(
  io,
  {
    authenticate,
    store,
    supabase,
    graceMs = 30_000,
    loadQuestions = () => loadQuestionBank(supabase),
  },
) {
  // Serialize state changes across asynchronous database writes so two requests
  // cannot both act on the same stale membership snapshot.
  let pending = Promise.resolve();
  function enqueue(action) {
    const result = pending.then(action);
    pending = result.catch(() => {});
    return result;
  }
  const connections = new Map();
  const sessions = createGameSessions({
    emit(userId, update) {
      for (const socket of connections.get(userId) ?? []) {
        if (socket.rooms.has(room(update.gameId)))
          socket.emit("game-update", update);
      }
    },
  });
  const deadlines = new Map();
  // Question records (including answers) stay on the server.
  const games = () => store.list();
  const publicGame = ({ questions, ...game }) => game;
  const publicGames = () => games().map(publicGame);
  const gameUpdate = (game, userId) =>
    sessions.snapshot(game.gameId, userId) ?? {
      gameId: game.gameId,
      phase: "interrupted",
      serverNow: Date.now(),
      endsAt: null,
      questionIndex: -1,
      totalQuestions: 0,
      submitted: false,
      yourAnswer: null,
      scores: [],
      message:
        "This game was interrupted by a server restart. Leave and create a new game.",
    };
  const membership = (id) =>
    games().find((g) => g.players.some((p) => p.id === id));
  const publish = () => io.to("lobby").emit("games-snapshot", publicGames());
  const publishOnlineUsers = () =>
    io.to("lobby").emit(
      "online-users",
      [...connections]
        .map(([id, sockets]) => ({
          id,
          username: [...sockets][0]?.data.username,
        }))
        .filter((user) => user.username),
    );
  for (const game of games())
    for (const p of game.players) deadlines.set(p.id, Date.now() + graceMs);
  async function removePlayer(id) {
    const game = membership(id);
    if (!game) return false;
    const players = game.players.filter((p) => p.id !== id);
    await store.replace(
      players.length
        ? {
            ...game,
            players,
            hostId: game.hostId === id ? players[0].id : game.hostId,
          }
        : null,
      game.gameId,
    );
    for (const s of connections.get(id) ?? []) s.leave(room(game.gameId));
    sessions.leave(game.gameId, id);
    deadlines.delete(id);
    publish();
    return true;
  }
  const timer = setInterval(
    () => {
      for (const [id, deadline] of deadlines)
        if (deadline <= Date.now()) {
          void enqueue(async () => {
            // The user may have reconnected while a database write was pending.
            if (
              connections.has(id) ||
              (deadlines.get(id) ?? Infinity) > Date.now()
            )
              return;
            await removePlayer(id);
            deadlines.delete(id);
          }).catch((error) =>
            console.error("Unable to expire membership", error),
          );
        }
    },
    Math.min(graceMs, 1000),
  );
  timer.unref();
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string" || !token) throw new Error("Missing token");
      const user = await authenticate(token);
      if (!user?.id) throw new Error("Invalid token");
      socket.data.userId = user.id;
      const name = user.user_metadata?.username;
      socket.data.username = user.is_anonymous
        ? `Guest-${user.id.slice(0, 8)}`
        : typeof name === "string" && name.trim()
          ? name.trim().slice(0, 64)
          : `Player-${user.id.slice(0, 8)}`;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });
  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId).add(socket);
    deadlines.delete(userId);
    socket.emit("socket-identity", { userId, username: socket.data.username });
    publishOnlineUsers();
    // Install once; lobby joins only restore rooms and return a snapshot.
    function handle(event, action) {
      socket.on(event, (...args) => {
        const cb = typeof args.at(-1) === "function" ? args.pop() : undefined;
        void enqueue(async () => {
          if (!socket.connected) return;
          if (event !== "join-lobby" && !socket.rooms.has("lobby"))
            throw new Error("Join the lobby first");
          ack(cb, { ok: true, data: await action(...args) });
        }).catch((error) =>
          ack(cb, { ok: false, error: error.message || "Request failed" }),
        );
      });
    }
    function attach(game) {
      for (const s of connections.get(userId) ?? []) s.join(room(game.gameId));
    }
    function requireGame(id) {
      if (typeof id !== "string") throw new Error("Invalid game ID");
      const game = games().find((g) => g.gameId === id);
      if (!game) throw new Error("Game no longer exists");
      return game;
    }
    handle("join-lobby", () => {
      socket.join("lobby");
      store.rememberPlayer?.(userId, socket.data.username);
      publishOnlineUsers();
      const game = membership(userId);
      if (game) attach(game);
      if (game) publish();
      if (game?.started) socket.emit("game-update", gameUpdate(game, userId));
      return publicGames();
    });
    handle("open-games", publicGames);
    handle("create-game", async (options) => {
      if (
        !options ||
        !validGameSetting(options.timeLimit) ||
        !validGameSetting(options.numberOfProblems)
      ) {
        throw new Error(
          "Time limit and number of problems must be whole numbers from 5 to 99.",
        );
      }
      const existing = membership(userId);
      if (existing) {
        attach(existing);
        return publicGame(existing);
      }
      const game = {
        gameId: randomUUID(),
        hostId: userId,
        players: [{ id: userId, username: socket.data.username }],
        started: false,
        timeLimit: options.timeLimit,
        numberOfProblems: options.numberOfProblems,
      };
      await store.replace(game, game.gameId);
      attach(game);
      publish();
      return publicGame(game);
    });
    handle("join-game", async (id) => {
      const game = requireGame(id);
      const existing = membership(userId);
      if (existing && existing.gameId !== id)
        throw new Error("Leave your current game first");
      if (!existing) {
        if (game.started) throw new Error("Game already started");
        game.players.push({ id: userId, username: socket.data.username });
        await store.replace(game, id);
      }
      attach(game);
      publish();
      return publicGame(game);
    });
    handle("start-game", async (id) => {
      const game = requireGame(id);
      if (game.hostId !== userId || !socket.rooms.has(room(id)))
        throw new Error("Only the host can start this game");
      if (!game.started) {
        if (
          !validGameSetting(game.timeLimit) ||
          !validGameSetting(game.numberOfProblems)
        ) {
          throw new Error(
            "Time limit and number of problems must be whole numbers from 5 to 99.",
          );
        }
        const bank = await loadQuestions();
        if (bank.length < game.numberOfProblems)
          throw new Error("Not enough questions available to start this game.");
        const questions = shuffled(bank).slice(0, game.numberOfProblems);
        await store.replace(
          {
            ...game,
            started: true,
            startedAt: Date.now(),
            solo: game.players.length === 1,
          },
          id,
        );
        publish();
        sessions.start(game, questions);
      }
      return true;
    });
    handle("submit-answer", (id, index, choice) => {
      requireGame(id);
      if (membership(userId)?.gameId !== id || !socket.rooms.has(room(id)))
        throw new Error("You are not in this game");
      return sessions.submit(id, userId, index, choice);
    });
    handle("leave-game", (id) => {
      if (membership(userId)?.gameId !== id)
        throw new Error("You are not in this game");
      return removePlayer(userId);
    });
    let lastMessage = 0;
    function message(target, text, gameId = null) {
      if (typeof text !== "string" || !text.trim() || text.length > 2000)
        throw new Error("Messages must contain 1-2000 characters");
      if (Date.now() - lastMessage < 3000)
        throw new Error("Message cooldown active");
      lastMessage = Date.now();
      io.to(target).emit("chat-message", {
        id: randomUUID(),
        userId,
        username: socket.data.username,
        text: text.trim(),
        gameId,
      });
      return true;
    }
    handle("lobby-message", (text) => message("lobby", text));
    handle("game-message", (id, text) => {
      requireGame(id);
      if (membership(userId)?.gameId !== id || !socket.rooms.has(room(id)))
        throw new Error("You are not in this game");
      return message(room(id), text, id);
    });
    socket.on("disconnect", () => {
      const active = connections.get(userId);
      active?.delete(socket);
      if (!active?.size) {
        connections.delete(userId);
        deadlines.set(userId, Date.now() + graceMs);
        publishOnlineUsers();
      }
    });
  });
  return () => {
    clearInterval(timer);
    sessions.stop();
  };
}
