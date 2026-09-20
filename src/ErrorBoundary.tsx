import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
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
    console.error("[Devizee ErrorBoundary] Uncaught render error:", error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 my-4 bg-surface-1 border border-status-danger/40 rounded-lg text-center space-y-4 shadow-raised max-w-lg mx-auto">
          <div className="w-12 h-12 mx-auto rounded-full bg-status-danger/20 text-status-danger flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-body font-bold text-primary">
              {this.props.fallbackTitle || "An unexpected error occurred in this view"}
            </h3>
            <p className="text-caption text-secondary mt-1">
              Top-level navigation remains active. You can recover this section without losing your session.
            </p>
            {this.state.error && (
              <p className="mt-2 p-2 bg-surface-0 rounded text-[11px] font-mono text-status-danger truncate text-left">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-md text-caption font-semibold flex items-center gap-2 mx-auto transition-all shadow-sm active:scale-95"
          >
            <RotateCcw size={14} />
            <span>Recover View</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
