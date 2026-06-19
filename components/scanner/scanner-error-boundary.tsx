"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Isolates render-time failures in the scanner so an unexpected error shows a
 * recoverable message instead of blanking the whole page.
 */
export class ScannerErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "scanner.render_error",
        message: error instanceof Error ? error.message : String(error),
      })
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6"
        >
          <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-6 text-center">
            <p className="text-sm font-medium text-red-300">
              The scanner hit an unexpected error.
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Please reload the page and try again.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
