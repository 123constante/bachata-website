import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=b03a606e"; const _jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import __vite__cjsImport1_reactDom_client from "/node_modules/.vite/deps/react-dom_client.js?v=b03a606e"; const createRoot = __vite__cjsImport1_reactDom_client["createRoot"];
import App from "/src/App.tsx";
import "/src/index.css";
import { ErrorBoundary } from "/src/components/ErrorBoundary.tsx";
// Global error handler for non-React errors (Async, Event Handlers, etc.)
window.onerror = function(message, source, lineno, colno, error) {
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
window.onunhandledrejection = function(event) {
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
createRoot(document.getElementById("root")).render(/*#__PURE__*/ _jsxDEV(ErrorBoundary, {
    children: /*#__PURE__*/ _jsxDEV(App, {}, void 0, false, {
        fileName: "C:/Users/ecual/OneDrive/Desktop/bachata-calendar-frontend/lovable-ui-refresh-main/src/main.tsx",
        lineNumber: 61,
        columnNumber: 5
    }, this)
}, void 0, false, {
    fileName: "C:/Users/ecual/OneDrive/Desktop/bachata-calendar-frontend/lovable-ui-refresh-main/src/main.tsx",
    lineNumber: 60,
    columnNumber: 3
}, this));

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4udHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNyZWF0ZVJvb3QgfSBmcm9tIFwicmVhY3QtZG9tL2NsaWVudFwiO1xuaW1wb3J0IEFwcCBmcm9tIFwiLi9BcHAudHN4XCI7XG5pbXBvcnQgXCIuL2luZGV4LmNzc1wiO1xuaW1wb3J0IHsgRXJyb3JCb3VuZGFyeSB9IGZyb20gXCJAL2NvbXBvbmVudHMvRXJyb3JCb3VuZGFyeVwiO1xuXG4vLyBHbG9iYWwgZXJyb3IgaGFuZGxlciBmb3Igbm9uLVJlYWN0IGVycm9ycyAoQXN5bmMsIEV2ZW50IEhhbmRsZXJzLCBldGMuKVxud2luZG93Lm9uZXJyb3IgPSBmdW5jdGlvbiAobWVzc2FnZSwgc291cmNlLCBsaW5lbm8sIGNvbG5vLCBlcnJvcikge1xuICAvLyBBbGVydCBmaXJzdCB0byBlbnN1cmUgdmlzaWJpbGl0eVxuICBhbGVydChgQ1JBU0g6ICR7bWVzc2FnZX1cXG4ke3NvdXJjZX06JHtsaW5lbm99YCk7XG4gIFxuICBjb25zdCBlcnJvckNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZ2xvYmFsLWVycm9yLWNvbnRhaW5lclwiKSB8fCBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBlcnJvckNvbnRhaW5lci5pZCA9IFwiZ2xvYmFsLWVycm9yLWNvbnRhaW5lclwiO1xuICBlcnJvckNvbnRhaW5lci5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIjtcbiAgZXJyb3JDb250YWluZXIuc3R5bGUudG9wID0gXCIwXCI7XG4gIGVycm9yQ29udGFpbmVyLnN0eWxlLmxlZnQgPSBcIjBcIjtcbiAgZXJyb3JDb250YWluZXIuc3R5bGUud2lkdGggPSBcIjEwMCVcIjtcbiAgZXJyb3JDb250YWluZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjZmZlYmVlXCI7XG4gIGVycm9yQ29udGFpbmVyLnN0eWxlLmNvbG9yID0gXCIjYzYyODI4XCI7XG4gIGVycm9yQ29udGFpbmVyLnN0eWxlLnBhZGRpbmcgPSBcIjIwcHhcIjtcbiAgZXJyb3JDb250YWluZXIuc3R5bGUuekluZGV4ID0gXCI5OTk5OTlcIjtcbiAgZXJyb3JDb250YWluZXIuc3R5bGUuYm9yZGVyQm90dG9tID0gXCIycHggc29saWQgI2I3MWMxY1wiO1xuICBlcnJvckNvbnRhaW5lci5zdHlsZS5mb250RmFtaWx5ID0gXCJtb25vc3BhY2VcIjtcbiAgXG4gIGVycm9yQ29udGFpbmVyLmlubmVySFRNTCA9IGBcbiAgICA8aDM+QXBwbGljYXRpb24gQ3Jhc2ggKEdsb2JhbCBFcnJvcik8L2gzPlxuICAgIDxwPjxzdHJvbmc+TWVzc2FnZTo8L3N0cm9uZz4gJHttZXNzYWdlfTwvcD5cbiAgICA8cD48c3Ryb25nPlNvdXJjZTo8L3N0cm9uZz4gJHtzb3VyY2V9OiR7bGluZW5vfToke2NvbG5vfTwvcD5cbiAgICA8cHJlPiR7ZXJyb3I/LnN0YWNrIHx8IFwiTm8gc3RhY2sgdHJhY2VcIn08L3ByZT5cbiAgICA8YnV0dG9uIG9uY2xpY2s9XCJ3aW5kb3cubG9jYXRpb24ucmVsb2FkKClcIiBzdHlsZT1cInBhZGRpbmc6IDhweCAxNnB4OyBiYWNrZ3JvdW5kOiAjYzYyODI4OyBjb2xvcjogd2hpdGU7IGJvcmRlcjogbm9uZTsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7IG1hcmdpbi10b3A6IDEwcHg7XCI+UmVsb2FkIEFwcDwvYnV0dG9uPlxuICBgO1xuICBcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChlcnJvckNvbnRhaW5lcik7XG59O1xuXG4vLyBHbG9iYWwgcHJvbWlzZSByZWplY3Rpb24gaGFuZGxlclxud2luZG93Lm9udW5oYW5kbGVkcmVqZWN0aW9uID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgY29uc3QgZXJyb3JDb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImdsb2JhbC1lcnJvci1jb250YWluZXJcIikgfHwgZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBlcnJvckNvbnRhaW5lci5pZCA9IFwiZ2xvYmFsLWVycm9yLWNvbnRhaW5lclwiO1xuICAgIGVycm9yQ29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiO1xuICAgIGVycm9yQ29udGFpbmVyLnN0eWxlLnRvcCA9IFwiMFwiO1xuICAgIGVycm9yQ29udGFpbmVyLnN0eWxlLmxlZnQgPSBcIjBcIjtcbiAgICBlcnJvckNvbnRhaW5lci5zdHlsZS53aWR0aCA9IFwiMTAwJVwiO1xuICAgIGVycm9yQ29udGFpbmVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwiI2ZmZWJlZVwiO1xuICAgIGVycm9yQ29udGFpbmVyLnN0eWxlLmNvbG9yID0gXCIjYzYyODI4XCI7XG4gICAgZXJyb3JDb250YWluZXIuc3R5bGUucGFkZGluZyA9IFwiMjBweFwiO1xuICAgIGVycm9yQ29udGFpbmVyLnN0eWxlLnpJbmRleCA9IFwiOTk5OTk5XCI7XG4gICAgZXJyb3JDb250YWluZXIuc3R5bGUuYm9yZGVyQm90dG9tID0gXCIycHggc29saWQgI2I3MWMxY1wiO1xuICAgIGVycm9yQ29udGFpbmVyLnN0eWxlLmZvbnRGYW1pbHkgPSBcIm1vbm9zcGFjZVwiO1xuICAgIFxuICAgIGVycm9yQ29udGFpbmVyLmlubmVySFRNTCA9IGBcbiAgICAgIDxoMz5VbmhhbmRsZWQgUHJvbWlzZSBSZWplY3Rpb248L2gzPlxuICAgICAgPHA+PHN0cm9uZz5SZWFzb246PC9zdHJvbmc+ICR7ZXZlbnQucmVhc29ufTwvcD5cbiAgICAgIDxidXR0b24gb25jbGljaz1cIndpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKVwiIHN0eWxlPVwicGFkZGluZzogOHB4IDE2cHg7IGJhY2tncm91bmQ6ICNjNjI4Mjg7IGNvbG9yOiB3aGl0ZTsgYm9yZGVyOiBub25lOyBib3JkZXItcmFkaXVzOiA0cHg7IGN1cnNvcjogcG9pbnRlcjsgbWFyZ2luLXRvcDogMTBweDtcIj5SZWxvYWQgQXBwPC9idXR0b24+XG4gICAgYDtcbiAgICBcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGVycm9yQ29udGFpbmVyKTtcbn07XG5cbmNyZWF0ZVJvb3QoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJyb290XCIpISkucmVuZGVyKFxuICA8RXJyb3JCb3VuZGFyeT5cbiAgICA8QXBwIC8+XG4gIDwvRXJyb3JCb3VuZGFyeT5cbik7XG4iXSwibmFtZXMiOlsiY3JlYXRlUm9vdCIsIkFwcCIsIkVycm9yQm91bmRhcnkiLCJ3aW5kb3ciLCJvbmVycm9yIiwibWVzc2FnZSIsInNvdXJjZSIsImxpbmVubyIsImNvbG5vIiwiZXJyb3IiLCJhbGVydCIsImVycm9yQ29udGFpbmVyIiwiZG9jdW1lbnQiLCJnZXRFbGVtZW50QnlJZCIsImNyZWF0ZUVsZW1lbnQiLCJpZCIsInN0eWxlIiwicG9zaXRpb24iLCJ0b3AiLCJsZWZ0Iiwid2lkdGgiLCJiYWNrZ3JvdW5kQ29sb3IiLCJjb2xvciIsInBhZGRpbmciLCJ6SW5kZXgiLCJib3JkZXJCb3R0b20iLCJmb250RmFtaWx5IiwiaW5uZXJIVE1MIiwic3RhY2siLCJib2R5IiwiYXBwZW5kQ2hpbGQiLCJvbnVuaGFuZGxlZHJlamVjdGlvbiIsImV2ZW50IiwicmVhc29uIiwicmVuZGVyIl0sIm1hcHBpbmdzIjoiO0FBQUEsU0FBU0EsVUFBVSxRQUFRLG1CQUFtQjtBQUM5QyxPQUFPQyxTQUFTLFlBQVk7QUFDNUIsT0FBTyxjQUFjO0FBQ3JCLFNBQVNDLGFBQWEsUUFBUSw2QkFBNkI7QUFFM0QsMEVBQTBFO0FBQzFFQyxPQUFPQyxPQUFPLEdBQUcsU0FBVUMsT0FBTyxFQUFFQyxNQUFNLEVBQUVDLE1BQU0sRUFBRUMsS0FBSyxFQUFFQyxLQUFLO0lBQzlELG1DQUFtQztJQUNuQ0MsTUFBTSxDQUFDLE9BQU8sRUFBRUwsUUFBUSxFQUFFLEVBQUVDLE9BQU8sQ0FBQyxFQUFFQyxRQUFRO0lBRTlDLE1BQU1JLGlCQUFpQkMsU0FBU0MsY0FBYyxDQUFDLDZCQUE2QkQsU0FBU0UsYUFBYSxDQUFDO0lBQ25HSCxlQUFlSSxFQUFFLEdBQUc7SUFDcEJKLGVBQWVLLEtBQUssQ0FBQ0MsUUFBUSxHQUFHO0lBQ2hDTixlQUFlSyxLQUFLLENBQUNFLEdBQUcsR0FBRztJQUMzQlAsZUFBZUssS0FBSyxDQUFDRyxJQUFJLEdBQUc7SUFDNUJSLGVBQWVLLEtBQUssQ0FBQ0ksS0FBSyxHQUFHO0lBQzdCVCxlQUFlSyxLQUFLLENBQUNLLGVBQWUsR0FBRztJQUN2Q1YsZUFBZUssS0FBSyxDQUFDTSxLQUFLLEdBQUc7SUFDN0JYLGVBQWVLLEtBQUssQ0FBQ08sT0FBTyxHQUFHO0lBQy9CWixlQUFlSyxLQUFLLENBQUNRLE1BQU0sR0FBRztJQUM5QmIsZUFBZUssS0FBSyxDQUFDUyxZQUFZLEdBQUc7SUFDcENkLGVBQWVLLEtBQUssQ0FBQ1UsVUFBVSxHQUFHO0lBRWxDZixlQUFlZ0IsU0FBUyxHQUFHLENBQUM7O2lDQUVHLEVBQUV0QixRQUFRO2dDQUNYLEVBQUVDLE9BQU8sQ0FBQyxFQUFFQyxPQUFPLENBQUMsRUFBRUMsTUFBTTtTQUNuRCxFQUFFQyxPQUFPbUIsU0FBUyxpQkFBaUI7O0VBRTFDLENBQUM7SUFFRGhCLFNBQVNpQixJQUFJLENBQUNDLFdBQVcsQ0FBQ25CO0FBQzVCO0FBRUEsbUNBQW1DO0FBQ25DUixPQUFPNEIsb0JBQW9CLEdBQUcsU0FBVUMsS0FBSztJQUN6QyxNQUFNckIsaUJBQWlCQyxTQUFTQyxjQUFjLENBQUMsNkJBQTZCRCxTQUFTRSxhQUFhLENBQUM7SUFDbkdILGVBQWVJLEVBQUUsR0FBRztJQUNwQkosZUFBZUssS0FBSyxDQUFDQyxRQUFRLEdBQUc7SUFDaENOLGVBQWVLLEtBQUssQ0FBQ0UsR0FBRyxHQUFHO0lBQzNCUCxlQUFlSyxLQUFLLENBQUNHLElBQUksR0FBRztJQUM1QlIsZUFBZUssS0FBSyxDQUFDSSxLQUFLLEdBQUc7SUFDN0JULGVBQWVLLEtBQUssQ0FBQ0ssZUFBZSxHQUFHO0lBQ3ZDVixlQUFlSyxLQUFLLENBQUNNLEtBQUssR0FBRztJQUM3QlgsZUFBZUssS0FBSyxDQUFDTyxPQUFPLEdBQUc7SUFDL0JaLGVBQWVLLEtBQUssQ0FBQ1EsTUFBTSxHQUFHO0lBQzlCYixlQUFlSyxLQUFLLENBQUNTLFlBQVksR0FBRztJQUNwQ2QsZUFBZUssS0FBSyxDQUFDVSxVQUFVLEdBQUc7SUFFbENmLGVBQWVnQixTQUFTLEdBQUcsQ0FBQzs7a0NBRUUsRUFBRUssTUFBTUMsTUFBTSxDQUFDOztJQUU3QyxDQUFDO0lBRURyQixTQUFTaUIsSUFBSSxDQUFDQyxXQUFXLENBQUNuQjtBQUM5QjtBQUVBWCxXQUFXWSxTQUFTQyxjQUFjLENBQUMsU0FBVXFCLE1BQU0sZUFDakQsUUFBQ2hDO2NBQ0MsY0FBQSxRQUFDRCJ9