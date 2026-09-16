import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as client } from '../../client/node_modules/socket.io-client/build/esm/index.js';
import { once } from 'node:events';
import setUpSocket from '../socket/index.socket.js';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const request = (socket, event, ...args) => socket.timeout(2000).emitWithAck(event, ...args);
async function fixture(t) {
  const http = createServer();
  const io = new Server(http);
  const records = new Map();
  const store = {
    list() { return structuredClone([...records.values()]); },
    async replace(game, id) {
      await delay(5); // Exercise real async boundaries between competing requests.
      if (game) records.set(id, structuredClone(game));
      else records.delete(id);
    },
  };
  const stop = setUpSocket(io, { store, graceMs: 80, authenticate: async token => {
    if (token === 'invalid') throw new Error('Invalid token');
    return { id: token, user_metadata: { username: 'same-name' } };
  } });
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const sockets = [];
  t.after(async () => { stop(); for (const s of sockets) s.disconnect(); await new Promise(resolve => io.close(resolve)); });
  async function connect(id, lobby = true) {
    const s = client(`http://127.0.0.1:${http.address().port}`, { auth: { token: id }, transports: ['websocket'], forceNew: true });
    sockets.push(s); await once(s, 'connect');
    if (lobby) assert.equal((await request(s, 'join-lobby')).ok, true);
    return s;
  }
  return { connect, store, io };
}
test('identity authorizes host, lobby is idempotent, and membership is singular', async t => {
  const { connect, store } = await fixture(t);
  const a = await connect('account-a'); const b = await connect('account-b');
  await request(a, 'join-lobby'); await request(a, 'join-lobby');
  const first = await request(a, 'create-game', { timeLimit: 30, numberOfProblems: 5 });
  assert.equal(store.list().length, 1);
  assert.equal((await request(a, 'create-game', { timeLimit: 30, numberOfProblems: 5 })).data.gameId, first.data.gameId);
  assert.equal((await request(b, 'start-game', first.data.gameId)).ok, false);
  const second = await request(b, 'create-game', { timeLimit: 30, numberOfProblems: 5 });
  assert.equal((await request(a, 'join-game', second.data.gameId)).ok, false);
  assert.equal((await request(a, 'start-game', first.data.gameId)).ok, true);
  assert.equal((await request(a, 'start-game', first.data.gameId)).ok, true);
  assert.equal(store.list().length, 2);
});
test('malformed events and missing acknowledgments do not break later requests', async t => {
  const { connect } = await fixture(t);
  const a = await connect('a', false);
  assert.equal((await request(a, 'create-game', { timeLimit: 30, numberOfProblems: 5 })).ok, false);
  a.emit('join-lobby'); a.emit('create-game', { timeLimit: 30, numberOfProblems: 5 }); a.emit('start-game', {}); a.emit('lobby-message', {});
  assert.equal((await request(a, 'join-game', {})).ok, false);
  assert.equal((await request(a, 'open-games')).data.length, 1);
});
test('lobby observers get membership and host snapshots; chat verifies membership and identity', async t => {
  const { connect } = await fixture(t);
  const a = await connect('a'); const b = await connect('b'); const observer = await connect('observer');
  const created = once(observer, 'games-snapshot');
  const { data: game } = await request(a, 'create-game', { timeLimit: 30, numberOfProblems: 5 });
  await created;
  const changed = once(observer, 'games-snapshot');
  await request(b, 'join-game', game.gameId);
  assert.equal((await changed)[0][0].players.length, 2);
  assert.equal((await request(observer, 'game-message', game.gameId, 'intrusion')).ok, false);
  const chat = once(b, 'chat-message');
  assert.equal((await request(a, 'game-message', game.gameId, 'hello')).ok, true);
  assert.equal((await chat)[0].userId, 'a');
  const transfer = once(observer, 'games-snapshot');
  await request(a, 'leave-game', game.gameId);
  assert.equal((await transfer)[0][0].hostId, 'b');
});
test('reconnect restores membership; final disconnect expires and transfers host', async t => {
  const { connect, store } = await fixture(t);
  const a = await connect('a'); const b = await connect('b');
  const { data: game } = await request(a, 'create-game', { timeLimit: 30, numberOfProblems: 5 });
  await request(b, 'join-game', game.gameId);
  a.disconnect();
  const restored = await connect('a');
  assert.equal((await request(restored, 'open-games')).data[0].players.length, 2);
  assert.equal((await request(restored, 'start-game', game.gameId)).ok, true);
  const anotherTab = await connect('a');
  restored.disconnect(); await delay(200);
  assert.equal(store.list()[0].hostId, 'a');
  anotherTab.disconnect(); await delay(200);
  assert.equal(store.list()[0].hostId, 'b');
  b.disconnect(); await delay(200);
  assert.equal(store.list().length, 0);
});
test('concurrent creates and joins preserve singular membership and all players', async t => {
  const { connect, store } = await fixture(t);
  const a = await connect('a'); const b = await connect('b'); const c = await connect('c');
  const [first, second] = await Promise.all([request(a, 'create-game', { timeLimit: 30, numberOfProblems: 5 }), request(a, 'create-game', { timeLimit: 30, numberOfProblems: 5 })]);
  assert.equal(first.data.gameId, second.data.gameId);
  assert.equal(store.list().length, 1);
  const joined = await Promise.all([request(b, 'join-game', first.data.gameId), request(c, 'join-game', first.data.gameId)]);
  assert.ok(joined.every(reply => reply.ok));
  assert.equal(store.list()[0].players.length, 3);
});
test('failed asynchronous writes return an error and do not poison the action queue', async t => {
  const { connect, store } = await fixture(t);
  const a = await connect('a');
  const replace = store.replace;
  store.replace = async () => { throw new Error('Database unavailable'); };
  const result = await request(a, 'create-game', { timeLimit: 30, numberOfProblems: 5 });
  assert.equal(result.ok, false);
  assert.equal(store.list().length, 0);
  store.replace = replace;
  assert.equal((await request(a, 'create-game', { timeLimit: 30, numberOfProblems: 5 })).ok, true);
});

test('game settings accept both boundaries and reject invalid requests without creating a game', async t => {
  const { connect, store } = await fixture(t);
  const a = await connect('a');
  for (const options of [undefined, {}, { timeLimit: 4, numberOfProblems: 5 }, { timeLimit: 100, numberOfProblems: 5 }, { timeLimit: 5, numberOfProblems: 4 }, { timeLimit: 5, numberOfProblems: 100 }, { timeLimit: 5.5, numberOfProblems: 5 }, { timeLimit: 5, numberOfProblems: 5.5 }, { timeLimit: '30', numberOfProblems: 5 }]) {
    assert.equal((await request(a, 'create-game', options)).ok, false);
  }
  assert.equal(store.list().length, 0);
  for (const value of [5, 99]) {
    const result = await request(a, 'create-game', { timeLimit: value, numberOfProblems: value });
    assert.equal(result.ok, true);
    assert.equal(result.data.timeLimit, value);
    assert.equal(result.data.numberOfProblems, value);
    assert.equal(store.list()[0].timeLimit, value);
    await request(a, 'leave-game', result.data.gameId);
  }
});
