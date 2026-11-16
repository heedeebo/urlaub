import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { createLocalRepository } from "./data/localRepository";
import { StoreProvider, useStore } from "./data/store";
import { supabase } from "./data/supabase";
import { createSupabaseRepository } from "./data/supabaseRepository";
import CalendarPage from "./pages/CalendarPage";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Login from "./pages/Login";
import RequestDetail from "./pages/RequestDetail";
import RequestEditor from "./pages/RequestEditor";
import Requests from "./pages/Requests";
import Settings from "./pages/Settings";
import Welcome from "./pages/Welcome";

function Loading() {
  const { t } = useTranslation();
  return <div className="grid min-h-dvh place-items-center text-sm text-slate-500">{t("common.loading")}</div>;
}

function Shell() {
  const { ready, initialized } = useStore();
  if (!ready) return <Loading />;
  if (!initialized) return <Welcome />;
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/requests/new" element={<RequestEditor key="new" />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/requests/:id/edit" element={<RequestEditor />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const repo = useMemo(
    () => (supabase ? (userId ? createSupabaseRepository(supabase) : null) : createLocalRepository()),
    [userId],
  );

  if (supabase && session === undefined) return <Loading />;
  if (supabase && !session) return <Login />;
  if (!repo) return <Loading />;
  return (
    <StoreProvider key={userId ?? "local"} repo={repo}>
      <Shell />
    </StoreProvider>
  );
}
