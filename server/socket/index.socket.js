import { randomUUID } from "crypto";
import { supabase } from "../lib/supabase.js";

export default function setUpSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("No authentication token"));
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        return next(new Error("Invalid authentication token"));
      }

      socket.data.user = user;

      if (user.is_anonymous) {
        console.log("a");
        socket.data.username = "Guest-" + randomUUID().substring(0, 8);
        socket.data.isGuest = true;
      } else {
        console.log("b");
        socket.data.username = user.user_metadata.username;
        socket.data.isGuest = false;
      }

      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  const games = new Map(); // map: gameId => {gameId, host, set of users, started}
  // map from gameId to Set of users, (js map and set preserves insertion order)
  // only host (first) can start game.

  // prevent joining a game before joining lobby
  // on join lobby, bind socket id to username
  io.on("connection", (socket) => {
    console.log("SOCKET CONNECTED:", socket.id);

    socket.on("join-lobby", (callback) => {
      socket.join("lobby");

      socket.on("lobby-message", (message) => {
        socket.to("lobby").emit("lobby-message", message);
      });

      socket.on("open-games", (callback) => {
        callback([...games.values()]);
      });

      socket.on("create-game", (callback) => {
        // check if in game?
        const gameId = randomUUID();

        console.log("server create game");
        socket.join(gameId);

        const game = {
          gameId,
          host: socket.data.username,
          numPlayers: 1,
          started: false,
        };
        console.log(socket.data.username);
        console.log("USERNAME ABOVE");
        games.set(gameId, game);

        io.emit("game-created", game);
        callback(game);
      });

      socket.on("join-game", (gameId, callback) => {
        const room = io.sockets.adapter.rooms.get(gameId);
        const playerCount = room?.size ?? 0;
        if (playerCount == 0) {
        } // TODO: DON"T ALLOW ENTER

        // don't let join if already in a game? or let
        socket.join(gameId);
        callback();
        // way to tell everyone only in room that you joined?
        // should we store this in db or just in sockets?
      });

      socket.on("start-game", (gameId) => {
        if (games.get(gameId).started) {
        } else {
          // check is host, change map element
          io.emit("game-started", gameId);
        }
      });

      socket.on("leave-game", (gameId, callback) => {
        // need user id or socket.id
        callback = typeof callback === "function" ? callback : () => {};

        const room = io.sockets.adapter.rooms.get(gameId);
        const playerCount = room?.size ?? 0;
        if (playerCount == 0) {
          /* throw error?*/
        }
        socket.leave(gameId);
        if (playerCount == 1) {
          io.emit("game-deleted", gameId);
          games.delete(gameId);
          callback("empty");
        } else {
          callback("left");
        }
      });

      socket.on("game-message", (gameId, message) => {
        if (socket.rooms.has(gameId))
          socket.to(gameId).emit("game-message", message);
      });

      callback();
    });
  });
}
