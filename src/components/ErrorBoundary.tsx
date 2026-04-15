import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-primary/10 bg-card p-8 text-center">
          <div className="text-4xl">😕</div>
          <div>
            <p className="font-semibold text-foreground">Something went wrong</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This section couldn't load. Tap below to try again.
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="mt-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Full-page error boundary — for page-level wrapping */
export class PageErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("PageErrorBoundary caught:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 pt-[84px] text-center">
          <div className="text-5xl">🥲</div>
          <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
          <p className="max-w-sm text-muted-foreground">
            This page ran into an unexpected error. Tap below to retry.
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-2 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
          >
            Tap to retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
