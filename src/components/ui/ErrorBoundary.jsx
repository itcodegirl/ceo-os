import { Component } from 'react';
import Button from './Button';
import { emitAppErrorTelemetry } from '../../lib/experimental/telemetry/appErrorTelemetry';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps) {
    if (
      this.state.hasError
      && previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error, info) {
    emitAppErrorTelemetry(error, info, {
      boundary: this.props.name || 'ErrorBoundary',
    });

    if (import.meta.env.DEV) {
      console.error('App ErrorBoundary caught:', error, info);
    }
  }

  handleReturnHome = () => {
    if (typeof this.props.onReturnHome === 'function') {
      this.props.onReturnHome();
      return;
    }

    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      // Callers can supply a `fallback` for panel-level boundaries that should
      // not present the full "Reload App / Return Home" UI. fallback may be a
      // ReactNode or a function (() => ReactNode) for parity with React's own
      // fallback prop conventions.
      if (this.props.fallback !== undefined) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback()
          : this.props.fallback;
      }

      return (
        <div className="error-boundary" role="alert" aria-live="assertive">
          <h2>Something went wrong in this view.</h2>
          <p>Try refreshing or return to Focus Home.</p>
          <div className="error-boundary__actions">
            <Button
              type="button"
              onClick={() => window.location.reload()}
              ariaLabel="Reload the current view"
              icon={{ name: 'refresh', size: 14 }}
            >
              Reload App
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={this.handleReturnHome}
              ariaLabel="Return to Focus Home"
              icon={{ name: 'back', size: 14 }}
            >
              Return Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
