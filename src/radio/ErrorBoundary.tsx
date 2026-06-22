import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Catches render/effect crashes so the page shows the actual error text instead of a
// blank black screen. Uses inline styles so it renders even if CSS/theme is the problem.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Radio] crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#0a0010',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'monospace',
        }}
      >
        <div style={{ maxWidth: 520, width: '100%' }}>
          <p style={{ color: '#ff6b6b', letterSpacing: 3, fontSize: 12, margin: 0 }}>
            // SUBSPACE RADIO — ERROR
          </p>
          <h1 style={{ fontSize: 22, margin: '8px 0 16px' }}>Something crashed while loading</h1>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 13,
              lineHeight: 1.5,
              color: '#ffe',
              background: '#1a0030',
              border: '1px solid #333',
              borderRadius: 6,
              padding: 12,
            }}
          >
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '12px 20px',
              fontFamily: 'monospace',
              letterSpacing: 2,
              fontSize: 12,
              background: '#7B2FBE',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            RELOAD
          </button>
        </div>
      </main>
    );
  }
}
