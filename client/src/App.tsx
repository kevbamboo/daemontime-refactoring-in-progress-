import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import "./App.css";

import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import Home from "./components/Home";
import Login from "./components/Login";
import Signup from "./components/Signup";

import { supabase } from "./lib/supabase";
import { socketService } from "./services/socket.service";

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    async function initialize() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setAuthenticated(true);
        await socketService.connect(
          session.access_token,
          session.user.user_metadata.username,
        );
      }

      setInitializing(false);
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setAuthenticated(true);
        await socketService.connect(
          session.access_token,
          session.user.user_metadata.username,
        );
      } else {
        setAuthenticated(false);
        socketService.disconnect();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (initializing) {
    return <div>Loading...</div>;
  }

  return (
    <BrowserRouter>
      <SiteHeader />

      <Routes>
        <Route
          path="/"
          element={
            <Home
              authenticated={authenticated}
              setAuthenticated={setAuthenticated}
            />
          }
        />

        <Route
          path="/login"
          element={<Login setAuthenticated={setAuthenticated} />}
        />

        <Route
          path="/signup"
          element={<Signup setAuthenticated={setAuthenticated} />}
        />
      </Routes>

      <SiteFooter />
    </BrowserRouter>
  );
}
