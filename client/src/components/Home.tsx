import { useState } from "react";
import { supabase } from "../lib/supabase";
import GameBox from "./GameBox";
import AuthModal from "./AuthModal";

type HomeProps = {
  authenticated: boolean;
  setAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function Home({ authenticated, setAuthenticated }: HomeProps) {
  return (
    <>
      {authenticated ? (
        <GameBox />
      ) : (
        <AuthModal setAuthenticated={setAuthenticated} />
      )}
    </>
  );
}
