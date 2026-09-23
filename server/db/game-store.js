// Map the socket model to the existing currentGames PostgreSQL columns.
export async function createGameStore(
  supabase,
  { timeLimit, numberOfQuestions },
) {
  const games = new Map();
  const rows = new Map();
  const table = "currentGames";
  const pageSize = 1000;
  if (
    !Number.isInteger(timeLimit) ||
    timeLimit <= 0 ||
    !Number.isInteger(numberOfQuestions) ||
    numberOfQuestions <= 0
  ) {
    throw new Error(
      "Configure positive integer game time and question-count defaults.",
    );
  }
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(
        "game_id,host_id,host_handle,users_in_game,state,time_limit,number_of_questions",
      )
      .order("game_id")
      .range(offset, offset + pageSize - 1)
      .abortSignal(AbortSignal.timeout(5000));
    if (error)
      throw new Error(
        "Unable to load currentGames from Supabase. Check the server credentials and table columns.",
        { cause: error },
      );
    for (const row of data) {
      rows.set(row.game_id, row);
      games.set(row.game_id, {
        gameId: row.game_id,
        hostId: row.host_id,
        timeLimit: row.time_limit,
        numberOfQuestions: row.number_of_questions,
        players: row.users_in_game.map((id) => ({
          id,
          username:
            id === row.host_id ? row.host_handle : `Player-${id.slice(0, 8)}`,
        })),
        started: row.state !== "waiting",
      });
    }
    if (data.length < pageSize) break;
  }
  return {
    list() {
      return structuredClone([...games.values()]);
    },
    // Only host_handle is stored in this schema. Restore other display names
    // from their authenticated sockets as players reconnect.
    rememberPlayer(id, username) {
      for (const game of games.values()) {
        const player = game.players.find((player) => player.id === id);
        if (player) player.username = username;
      }
    },
    async replace(game, id) {
      const previous = rows.get(id);
      // Solo matches remain available to sockets, but have no persisted game row.
      if (game?.solo || (!game && games.get(id)?.solo)) {
        if (previous) {
          const { error } = await supabase
            .from(table)
            .delete()
            .eq("game_id", id)
            .abortSignal(AbortSignal.timeout(5000));
          if (error) throw new Error("Unable to remove solo game from the database.", { cause: error });
        }
        rows.delete(id);
        if (game) games.set(id, structuredClone(game));
        else games.delete(id);
        return;
      }
      const row = game
        ? {
            game_id: id,
            host_id: game.hostId,
            host_handle: game.players.find(
              (player) => player.id === game.hostId,
            ).username,
            users_in_game: game.players.map((player) => player.id),
            state: game.started ? "started" : "waiting",
            time_limit: previous?.time_limit ?? game.timeLimit ?? timeLimit,
            number_of_questions:
              previous?.number_of_questions ??
              game.numberOfQuestions ??
              numberOfQuestions,
          }
        : null;
      const query = row
        ? supabase
            .from(table)
            .upsert(row, { onConflict: "game_id", defaultToNull: false })
        : supabase.from(table).delete().eq("game_id", id);
      const { error } = await query.abortSignal(AbortSignal.timeout(5000));
      if (error) {
        console.error("Supabase game save failed", {
          table,
          code: error.code,
          message: error.message,
          hint: error.hint,
        });
        throw new Error(
          "Unable to save game. Check the server log for the database error.",
          { cause: error },
        );
      }
      if (game) {
        games.set(
          id,
          structuredClone({
            ...game,
            timeLimit: row.time_limit,
            numberOfQuestions: row.number_of_questions,
          }),
        );
        rows.set(id, row);
      } else {
        games.delete(id);
        rows.delete(id);
      }
    },
  };
}
