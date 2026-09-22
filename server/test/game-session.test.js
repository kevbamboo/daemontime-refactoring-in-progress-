import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGameSessions,
  normalizeQuestion,
} from "../socket/game-session.js";

function fixture(count = 2) {
  let clock = 0;
  let nextId = 0;
  const timers = new Map();
  const updates = [];
  const sessions = createGameSessions({
    emit: (userId, update) => updates.push({ userId, update }),
    now: () => clock,
    schedule(fn, ms) {
      const id = ++nextId;
      timers.set(id, { at: clock + ms, fn });
      return id;
    },
    cancel: (id) => timers.delete(id),
  });
  const questions = Array.from({ length: count }, (_, index) =>
    normalizeQuestion({
      question: `Question ${index}`,
      choices: ["a", "b", "c", "d"],
      answer: "2",
      short_explanation: "Short",
      long_explanation: "Long",
    }),
  );
  sessions.start(
    {
      gameId: "game",
      timeLimit: 5,
      players: [
        { id: "a", username: "A" },
        { id: "b", username: "B" },
      ],
    },
    questions,
  );
  return {
    sessions,
    updates,
    timers,
    get: (id) => sessions.snapshot("game", id),
    tick(ms) {
      const end = clock + ms;
      while (true) {
        const entry = [...timers]
          .filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        clock = entry[1].at;
        timers.delete(entry[0]);
        entry[1].fn();
      }
      clock = end;
    },
    elapseWithoutTimers(ms) {
      clock += ms;
    },
  };
}

test("3-second countdown, question deadline, 3-second scoreboard, and final personalized review", () => {
  const { sessions, get, tick } = fixture();
  assert.equal(get("a").phase, "countdown");
  assert.equal(get("a").question, undefined);
  tick(2999);
  assert.equal(get("a").phase, "countdown");
  tick(1);
  assert.equal(get("a").phase, "question");
  assert.deepEqual(get("a").question.choices, ["a", "b", "c", "d"]);
  assert.equal(get("a").question.correctAnswer, undefined);
  assert.equal(get("a").review, undefined);
  sessions.submit("game", "a", 0, 2);
  assert.equal(get("a").submitted, true);
  assert.equal(get("b").submitted, false);
  assert.equal(get("b").yourAnswer, null);
  assert.equal(get("a").scores.find((p) => p.id === "a").score, 2);
  sessions.submit("game", "b", 0, 2);
  assert.equal(get("b").scores.find((p) => p.id === "b").score, 1);
  assert.equal(get("a").phase, "scoreboard");
  tick(2999);
  assert.equal(get("a").phase, "scoreboard");
  tick(1);
  assert.equal(get("a").questionIndex, 1);
  assert.equal(get("a").submitted, false);
  sessions.submit("game", "b", 1, 1);
  tick(5000);
  assert.equal(get("a").phase, "scoreboard");
  tick(3000);
  assert.equal(get("a").phase, "finished");
  assert.equal(get("a").review[1].yourAnswer, null);
  assert.equal(get("b").review[1].yourAnswer, 1);
  assert.equal(get("b").review[1].correctAnswer, 2);
  assert.equal(get("b").review[1].shortExplanation, "Short");
  assert.equal(get("b").review[1].longExplanation, "Long");
  assert.equal(get("a").scores.find((p) => p.id === "a").score, 2);
  assert.equal(get("b").scores.find((p) => p.id === "b").score, 1);
});

test("rejects outsiders, invalid choices, duplicate, stale, early and late submissions", () => {
  const { sessions, get, tick, elapseWithoutTimers } = fixture();
  assert.throws(() => sessions.submit("game", "a", 0, 2), /no longer/);
  assert.throws(() => sessions.submit("game", "outsider", 0, 2), /not in/);
  assert.equal(get("outsider"), null);
  tick(3000);
  for (const value of [0, 5, 1.5, "2", null])
    assert.throws(() => sessions.submit("game", "a", 0, value), /1 to 4/);
  assert.throws(() => sessions.submit("game", "a", 1, 2), /no longer/);
  sessions.submit("game", "a", 0, 2);
  assert.throws(() => sessions.submit("game", "a", 0, 2), /already/);
  elapseWithoutTimers(5000);
  assert.throws(() => sessions.submit("game", "b", 0, 2), /Time is up/);
  assert.equal(get("a").phase, "scoreboard");
  assert.equal(get("b").scores.find((p) => p.id === "b").score, 0);
});

test("leaving releases remaining players and cancels timers when the game empties", () => {
  const { sessions, get, tick, timers } = fixture();
  tick(3000);
  sessions.submit("game", "a", 0, 2);
  sessions.leave("game", "b");
  assert.equal(get("a").phase, "scoreboard");
  assert.equal(get("b"), null);
  assert.equal(get("a").scores.find((p) => p.id === "b").active, false);
  sessions.leave("game", "a");
  assert.equal(timers.size, 0);
  assert.equal(get("a"), null);
});

test("stop cancels all timers and malformed question records are rejected", () => {
  const { sessions, timers } = fixture();
  sessions.stop();
  assert.equal(timers.size, 0);
  assert.throws(
    () => normalizeQuestion({ question: "Missing answers" }),
    /Questions must/,
  );
  for (const choices of [
    null,
    "[]",
    [],
    ["a", "b", "c"],
    ["a", "b", "c", 4],
    ["a", "b", "c", ""],
  ]) {
    assert.throws(
      () =>
        normalizeQuestion({ question: "Invalid choices", choices, answer: 1 }),
      /Questions must/,
    );
  }
});
