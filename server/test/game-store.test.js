import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createGameStore } from '../db/game-store.js';

function database() {
  const records = new Map();
  let failure = false;
  const supabase = createClient('https://example.supabase.co', 'test-server-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input);
      assert.equal(url.pathname, '/rest/v1/currentGames');
      if (failure) return new Response(JSON.stringify({ message: 'database unavailable' }), { status: 503 });
      let result = null;
      if (init.method === 'GET') {
        const start = Number(url.searchParams.get('offset') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? 1000);
        result = [...records.values()].sort((a,b) => a.game_id.localeCompare(b.game_id)).slice(start, start + limit);
      } else if (init.method === 'POST') {
        assert.equal(url.searchParams.get('on_conflict'), 'game_id');
        const row = JSON.parse(init.body);
        for (const field of ['game_id', 'host_id', 'host_handle', 'users_in_game', 'state', 'time_limit', 'number_of_problems']) assert.notEqual(row[field], undefined, field);
        assert.equal(typeof row.state, 'string');
        assert.ok(Array.isArray(row.users_in_game));
        assert.ok(!('time_created' in row));
        assert.ok(!('questions' in row));
        records.set(row.game_id, structuredClone(row));
      } else if (init.method === 'DELETE') {
        const id = url.searchParams.get('game_id').slice(3);
        records.delete(id);
      } else throw new Error(`Unexpected method ${init.method}`);
      return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  return { supabase, records, fail(value) { failure = value; } };
}
const game = { timeLimit: 42, numberOfProblems: 17, gameId: 'game', hostId: 'a', players: [{ id: 'a', username: 'A' }], started: false };

test('Supabase game store persists writes across reloads and deletes rows', async () => {
  const db = database();
  const store = await createGameStore(db.supabase, { timeLimit: 30, numberOfProblems: 20 });
  await store.replace(game, game.gameId);
  assert.equal(db.records.get(game.gameId).time_limit, 42);
  assert.equal(db.records.get(game.gameId).number_of_problems, 17);
  const restarted = await createGameStore(db.supabase, { timeLimit: 30, numberOfProblems: 5 });
  assert.deepEqual(restarted.list(), [game]);
  const copy = restarted.list(); copy[0].players.length = 0;
  assert.equal(restarted.list()[0].players.length, 1);
  await restarted.replace(null, game.gameId);
  assert.equal((await createGameStore(db.supabase, { timeLimit: 25, numberOfProblems: 20 })).list().length, 0);
});
test('failed Supabase writes leave the snapshot intact and missing table fails startup', async () => {
  const db = database(); const store = await createGameStore(db.supabase, { timeLimit: 25, numberOfProblems: 20 });
  await store.replace(game, game.gameId);
  db.fail(true);
  await assert.rejects(store.replace({ ...game, started: true }, game.gameId), /Unable to save/);
  await assert.rejects(store.replace(null, game.gameId), /Unable to save/);
  assert.deepEqual(store.list(), [game]);
  await assert.rejects(createGameStore(db.supabase, { timeLimit: 25, numberOfProblems: 20 }), /Unable to load/);
});
test('startup reads beyond the default Supabase page size', async () => {
  const db = database();
  for (let i = 0; i < 1001; i++) {
    const id = String(i).padStart(4, '0');
    db.records.set(id, { game_id: id, host_id: 'a', host_handle: 'A', users_in_game: ['a'], state: 'waiting', time_limit: 25, number_of_problems: 20 });
  }
  assert.equal((await createGameStore(db.supabase, { timeLimit: 25, numberOfProblems: 20 })).list().length, 1001);
});

test('existing game settings survive updates and host transfer uses the new handle', async () => {
  const db = database();
  db.records.set('game', { game_id: 'game', host_id: 'a', host_handle: 'A', users_in_game: ['a', 'b'], state: 'waiting', time_limit: 10, number_of_problems: 5 });
  const store = await createGameStore(db.supabase, { timeLimit: 25, numberOfProblems: 20 });
  store.rememberPlayer('b', 'B');
  const current = store.list()[0];
  await store.replace({ ...current, hostId: 'b', players: current.players.filter(p => p.id === 'b'), started: true }, 'game');
  const row = db.records.get('game');
  assert.equal(row.time_limit, 10);
  assert.equal(row.number_of_problems, 5);
  assert.equal(row.host_handle, 'B');
  assert.equal(row.state, 'started');
  assert.deepEqual(row.users_in_game, ['b']);
});
