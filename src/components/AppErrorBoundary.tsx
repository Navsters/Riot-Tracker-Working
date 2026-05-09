import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/** Catches runtime render crashes so users see actionable text instead of a blank `#root`. */

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[valorant-dashboard]', error.message, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="app-root fatal-root" role="alert">
          <div className="fatal-card">
            <h1>Something shattered the client render</h1>
            <p className="fatal-teaser">
              The UI crashed before React could paint. Copy the snippet below when filing an issue—it usually points to one
              bad dependency call.
            </p>
            <pre className="fatal-stack">{this.state.error.message}</pre>
            <button type="button" className="primary-btn" onClick={this.handleRetry}>
              Try again (soft reset boundary)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
