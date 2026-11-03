import React, { useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { ConsolePage } from "./components/ConsolePage";
import { AuthPage } from "./components/AuthPage";

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || "/";
  });
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem("cse_admin_session") === "active";
  });

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || "/");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  // Route matching
  if (currentPath === "/console") {
    // If not logged in, show AuthPage or Console with guest indicator
    if (!isAdminLoggedIn) {
      return (
        <AuthPage
          onNavigate={navigate}
          onLoginSuccess={() => setIsAdminLoggedIn(true)}
        />
      );
    }
    return (
      <ConsolePage
        onNavigate={navigate}
        onLogout={() => setIsAdminLoggedIn(false)}
      />
    );
  }

  if (currentPath === "/auth") {
    return (
      <AuthPage
        onNavigate={navigate}
        onLoginSuccess={() => setIsAdminLoggedIn(true)}
      />
    );
  }

  return <LandingPage onNavigate={navigate} />;
}
