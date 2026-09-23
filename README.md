# Daemontime

React/TypeScript client, authenticated Node.js Socket.IO server, and Supabase auth.

The app uses **questions** throughout its UI, game state, and socket messages.
The Supabase bank table is `questions`, and the CSV prompt column is `question`.
The game-count column is `number_of_questions`, mapped to `numberOfQuestions` in
the app. New databases use `001_create_games.sql`.
The optional count default is configured with `GAME_NUMBER_OF_QUESTIONS`.
Run `node scripts/check-questions.js` from `server` to check the question bank.
Deploy the client and server together when changing the socket message format.
