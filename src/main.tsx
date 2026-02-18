import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Global error handler for non-React errors (Async, Event Handlers, etc.)
window.onerror = function (message, source, lineno, colno, error) {
  // Alert first to ensure visibility
  alert(`CRASH: ${message}\n${source}:${lineno}`);
  
  const errorContainer = document.getElementById("global-error-container") || document.createElement("div");
  errorContainer.id = "global-error-container";
  errorContainer.style.position = "fixed";
  errorContainer.style.top = "0";
  errorContainer.style.left = "0";
  errorContainer.style.width = "100%";
  errorContainer.style.backgroundColor = "#ffebee";
  errorContainer.style.color = "#c62828";
  errorContainer.style.padding = "20px";
  errorContainer.style.zIndex = "999999";
  errorContainer.style.borderBottom = "2px solid #b71c1c";
  errorContainer.style.fontFamily = "monospace";
  
  errorContainer.innerHTML = `
    <h3>Application Crash (Global Error)</h3>
    <p><strong>Message:</strong> ${message}</p>
    <p><strong>Source:</strong> ${source}:${lineno}:${colno}</p>
    <pre>${error?.stack || "No stack trace"}</pre>
    <button onclick="window.location.reload()" style="padding: 8px 16px; background: #c62828; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">Reload App</button>
  `;
  
  document.body.appendChild(errorContainer);
};

// Global promise rejection handler
window.onunhandledrejection = function (event) {
    const errorContainer = document.getElementById("global-error-container") || document.createElement("div");
    errorContainer.id = "global-error-container";
    errorContainer.style.position = "fixed";
    errorContainer.style.top = "0";
    errorContainer.style.left = "0";
    errorContainer.style.width = "100%";
    errorContainer.style.backgroundColor = "#ffebee";
    errorContainer.style.color = "#c62828";
    errorContainer.style.padding = "20px";
    errorContainer.style.zIndex = "999999";
    errorContainer.style.borderBottom = "2px solid #b71c1c";
    errorContainer.style.fontFamily = "monospace";
    
    errorContainer.innerHTML = `
      <h3>Unhandled Promise Rejection</h3>
      <p><strong>Reason:</strong> ${event.reason}</p>
      <button onclick="window.location.reload()" style="padding: 8px 16px; background: #c62828; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">Reload App</button>
    `;
    
    document.body.appendChild(errorContainer);
};

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
