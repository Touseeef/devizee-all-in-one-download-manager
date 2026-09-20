import React from "react";
import ReactDOM from "react-dom/client";
import "./App.css";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="Devizee Application Error">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
