import { randomUUID } from "crypto";
import { supabase } from "../lib/supabase.js";

export default function setUpSocket(io) {
  io.use(async (socket, next) => {
    try {
      let onlineUsers = new Set();
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

      onlineUsers.add(socket.data.username);

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
    socket.emit("socket-identity", {
      username: socket.data.username,
      //isGuest: socket.data.isGuest,
    });

    function leaveGame(gameId) {
      const game = games.get(gameId);
      const room = io.sockets.adapter.rooms.get(gameId);

      if (!game || !game.players?.includes(socket.data.username)) {
        return false;
      }

      const wasHost = game.host === socket.data.username;
      game.players = game.players.filter(
        (player) => player !== socket.data.username,
      );
      socket.leave(gameId);

      if (game.players.length === 0) {
        games.delete(gameId);
        io.emit("game-deleted", gameId);
        return true;
      }

      if (wasHost) {
        game.host = game.players[0];
        io.to(gameId).emit("new-host", gameId, game.host);
      }

      game.numPlayers = game.players.length;
      io.to(gameId).emit("game-players", gameId, game.players);
      return true;
    }

    socket.on("disconnecting", () => {
      if (!socket.data.isGuest) {
        return;
      }

      for (const gameId of socket.rooms) {
        if (gameId !== socket.id && gameId !== "lobby") {
          leaveGame(gameId);
        }
      }
    });

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
          players: [socket.data.username],
          started: false,
          questions: {},
        };
        console.log(socket.data.username);
        console.log("USERNAME ABOVE");
        games.set(gameId, game);

        io.emit("game-created", game);
        callback(game);
      });

      socket.on("join-game", (gameId, callback) => {
        if (!games.get(gameId)) {
          callback(false);
          return;
        }

        if (games.get(gameId).started) {
          callback(false);
          return;
        }

        const room = io.sockets.adapter.rooms.get(gameId);
        const playerCount = room?.size ?? 0;
        if (playerCount == 0) {
          callback(false);
          return;
        }
        // don't let join if already in a game?
        /*if (socket.rooms.size > 1) {
          callback(false);
          return;
        }*/

        socket.join(gameId);
        const game = games.get(gameId);
        if (!game.players.includes(socket.data.username)) {
          game.players.push(socket.data.username);
        }
        game.numPlayers = game.players.length;
        io.to(gameId).emit("game-players", gameId, game.players);
        callback(true);
        // way to tell everyone only in room that you joined?
        // should we store this in db or just in sockets?
      });

      socket.on("start-game", (gameId, callback) => {
        if (!games.get(gameId)) {
          callback(false);
          return;
        }
        if (games.get(gameId).started) {
        } else {
          // check is host, change map element
          if (socket.data.username == games.get(gameId).host) {
            let gameValue = games.get(gameId);
            gameValue.started = true;
            io.emit("game-started", gameId);
            callback(true);
          } else {
            callback(false);
            return;
          }
        }
      });

      socket.on("leave-game", (gameId, callback) => {
        callback = typeof callback === "function" ? callback : () => {};

        callback(leaveGame(gameId) ? "left" : false);
      });

      socket.on("game-message", (gameId, message) => {
        if (socket.rooms.has(gameId))
          socket.to(gameId).emit("game-message", message);
      });

      callback();
    });
  });
}
