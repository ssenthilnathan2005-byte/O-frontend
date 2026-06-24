import React from "react";

interface Props {
  children: React.ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("[ErrorBoundary] Caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <p className="text-lg font-semibold text-gray-900">
            Something went wrong loading {this.props.fallbackLabel ?? "this page"}.
          </p>
          <button
            type="button"
            className="mt-4 bg-teal-500 text-white font-bold px-5 py-2.5 rounded-xl"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
