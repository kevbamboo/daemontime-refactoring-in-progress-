import express from "express";
const authRouter = express.Router();

// Authentication is owned by Supabase; this legacy endpoint is not used.
authRouter.post("/signup", (_req, res) => {
  res
    .status(410)
    .json({ error: "Use Supabase authentication to create an account" });
});

export default authRouter;
