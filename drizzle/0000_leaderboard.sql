CREATE TABLE IF NOT EXISTS leaderboard (
  day TEXT NOT NULL,
  player TEXT NOT NULL,
  nickname TEXT NOT NULL,
  lives INTEGER NOT NULL CHECK (lives BETWEEN 1 AND 3),
  elapsed INTEGER NOT NULL CHECK (elapsed > 0),
  submitted INTEGER NOT NULL,
  PRIMARY KEY (day, player)
);

CREATE INDEX IF NOT EXISTS leaderboard_rank
  ON leaderboard (day, lives DESC, elapsed ASC, submitted ASC, player ASC);
