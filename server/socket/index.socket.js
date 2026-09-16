import { randomUUID } from 'node:crypto';
const ack = (cb, value) => { if (typeof cb === 'function') cb(value); };
const room = id => `game:${id}`;

export default function setUpSocket(io, { authenticate, store, graceMs = 30_000 }) {
  // Serialize state changes across asynchronous database writes so two requests
  // cannot both act on the same stale membership snapshot.
  let pending = Promise.resolve();
  function enqueue(action) {
    const result = pending.then(action);
    pending = result.catch(() => {});
    return result;
  }
  const connections = new Map();
  const deadlines = new Map();
  const games = () => store.list();
  const membership = id => games().find(g => g.players.some(p => p.id === id));
  const publish = () => io.to('lobby').emit('games-snapshot', games());
  for (const game of games()) for (const p of game.players) deadlines.set(p.id, Date.now() + graceMs);
  async function removePlayer(id) {
    const game = membership(id);
    if (!game) return false;
    const players = game.players.filter(p => p.id !== id);
    await store.replace(players.length ? { ...game, players, hostId: game.hostId === id ? players[0].id : game.hostId } : null, game.gameId);
    for (const s of connections.get(id) ?? []) s.leave(room(game.gameId));
    deadlines.delete(id);
    publish();
    return true;
  }
  const timer = setInterval(() => {
    for (const [id, deadline] of deadlines) if (deadline <= Date.now()) {
      void enqueue(async () => {
        // The user may have reconnected while a database write was pending.
        if (connections.has(id) || (deadlines.get(id) ?? Infinity) > Date.now()) return;
        await removePlayer(id);
        deadlines.delete(id);
      }).catch(error => console.error('Unable to expire membership', error));
    }
  }, Math.min(graceMs, 1000));
  timer.unref();
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('Missing token');
      const user = await authenticate(token);
      if (!user?.id) throw new Error('Invalid token');
      socket.data.userId = user.id;
      const name = user.user_metadata?.username;
      socket.data.username = user.is_anonymous ? `Guest-${user.id.slice(0,8)}` : typeof name === 'string' && name.trim() ? name.trim().slice(0,64) : `Player-${user.id.slice(0,8)}`;
      next();
    } catch { next(new Error('Authentication failed')); }
  });
  io.on('connection', socket => {
    const userId = socket.data.userId;
    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId).add(socket);
    deadlines.delete(userId);
    socket.emit('socket-identity', { userId, username: socket.data.username });
    // Install once; lobby joins only restore rooms and return a snapshot.
    function handle(event, action) {
      socket.on(event, (...args) => {
        const cb = typeof args.at(-1) === 'function' ? args.pop() : undefined;
        void enqueue(async () => {
          if (!socket.connected) return;
          if (event !== 'join-lobby' && !socket.rooms.has('lobby')) throw new Error('Join the lobby first');
          ack(cb, { ok: true, data: await action(...args) });
        }).catch(error => ack(cb, { ok: false, error: error.message || 'Request failed' }));
      });
    }
    function attach(game) { for (const s of connections.get(userId) ?? []) s.join(room(game.gameId)); }
    function requireGame(id) {
      if (typeof id !== 'string') throw new Error('Invalid game ID');
      const game = games().find(g => g.gameId === id);
      if (!game) throw new Error('Game no longer exists');
      return game;
    }
    handle('join-lobby', () => {
      socket.join('lobby');
      store.rememberPlayer?.(userId, socket.data.username);
      const game = membership(userId);
      if (game) attach(game);
      if (game) publish();
      return games();
    });
    handle('open-games', games);
    handle('create-game', async (options) => {
      if (!options || !Number.isInteger(options.timeLimit) || options.timeLimit < 5 || options.timeLimit > 99 ||
          !Number.isInteger(options.numberOfProblems) || options.numberOfProblems < 5 || options.numberOfProblems > 99) {
        throw new Error('Time limit and number of problems must be whole numbers from 5 to 99.');
      }
      const existing = membership(userId);
      if (existing) { attach(existing); return existing; }
      const game = { gameId: randomUUID(), hostId: userId, players: [{ id: userId, username: socket.data.username }], started: false, timeLimit: options.timeLimit, numberOfProblems: options.numberOfProblems };
      await store.replace(game, game.gameId);
      attach(game); publish(); return game;
    });
    handle('join-game', async id => {
      const game = requireGame(id);
      const existing = membership(userId);
      if (existing && existing.gameId !== id) throw new Error('Leave your current game first');
      if (!existing) {
        if (game.started) throw new Error('Game already started');
        game.players.push({ id: userId, username: socket.data.username });
        await store.replace(game, id);
      }
      attach(game); publish(); return game;
    });
    handle('start-game', async id => {
      const game = requireGame(id);
      if (game.hostId !== userId || !socket.rooms.has(room(id))) throw new Error('Only the host can start this game');
      if (!game.started) { await store.replace({ ...game, started: true, startedAt: Date.now() }, id); publish(); }
      return true;
    });
    handle('leave-game', id => {
      if (membership(userId)?.gameId !== id) throw new Error('You are not in this game');
      return removePlayer(userId);
    });
    let lastMessage = 0;
    function message(target, text, gameId = null) {
      if (typeof text !== 'string' || !text.trim() || text.length > 2000) throw new Error('Messages must contain 1-2000 characters');
      if (Date.now() - lastMessage < 300) throw new Error('Please wait before sending another message');
      lastMessage = Date.now();
      io.to(target).emit('chat-message', { id: randomUUID(), userId, username: socket.data.username, text: text.trim(), gameId });
      return true;
    }
    handle('lobby-message', text => message('lobby', text));
    handle('game-message', (id, text) => {
      requireGame(id);
      if (membership(userId)?.gameId !== id || !socket.rooms.has(room(id))) throw new Error('You are not in this game');
      return message(room(id), text, id);
    });
    socket.on('disconnect', () => {
      const active = connections.get(userId);
      active?.delete(socket);
      if (!active?.size) {
        connections.delete(userId);
        deadlines.set(userId, Date.now() + graceMs);
      }
    });
  });
  return () => clearInterval(timer);
}
