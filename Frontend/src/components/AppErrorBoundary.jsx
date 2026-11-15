import React from 'react';
import { Link } from 'react-router-dom';
import { reportClientError } from '../lib/telemetry';

export default class AppErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportClientError(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <main className="app-error-page"><div><p className="eyebrow">TEMPORARY ERROR</p><h1>We could not load this page.</h1><p>Please try again, or return to the hospital website.</p><div className="button-row"><button className="hospital-button" onClick={() => window.location.reload()}>Try again</button><Link className="hospital-button button-outline" to="/">Return home</Link></div></div></main>;
  }
}
