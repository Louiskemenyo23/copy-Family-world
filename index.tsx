
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

// Diagnostic: Log that the script has started
console.log("Family World Manager: Initializing entry point...");

if (!container) {
  console.error("Critical: Root container not found.");
  throw new Error("Could not find root element 'root'");
}

const root = createRoot(container);

// Safety check for local file protocol and global error catching
window.onerror = (message, source, lineno, colno, error) => {
  console.error("Global JS Error:", message, "at", source, ":", lineno);
  root.render(
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center font-mono">
      <div className="max-w-xl bg-slate-900 border border-rose-500/50 p-8 rounded-2xl shadow-2xl">
        <h1 className="text-2xl font-bold text-rose-500 mb-4 flex items-center justify-center gap-2">
          Critical Boot Error
        </h1>
        <div className="bg-black/40 p-4 rounded-lg text-left text-xs text-rose-300 mb-6 overflow-auto max-h-40">
          <p className="font-bold mb-2">Error Details:</p>
          <p>{String(message)}</p>
          <p className="mt-2 text-slate-500">Source: {String(source)} (Line: {lineno})</p>
        </div>
        <div className="text-slate-400 text-sm space-y-4">
          <p>This error usually occurs when deploying to a host like Netlify/GitHub without a build step (Vite/Webpack).</p>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p className="text-xs font-bold text-indigo-400 uppercase mb-2">Recommended Fix:</p>
            <p className="text-xs text-slate-300">Ensure your deployment includes a build command (e.g., <code>npm run build</code>) or use a hosting provider that supports TypeScript transpilations.</p>
          </div>
        </div>
      </div>
    </div>
  );
  return false;
};

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("Family World Manager: React tree mounted.");
} catch (error) {
  console.error("Mounting Error:", error);
}
