import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { HuntPilotLogo } from './ui/PhPrimitives';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMessage = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.error) {
        displayMessage = `Database ${parsed.operationType || 'operation'} error on "${parsed.path || 'record'}": ${parsed.error}`;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, message: displayMessage };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center p-6">
          <div className="mb-6">
            <HuntPilotLogo />
          </div>
          <div className="max-w-lg w-full bg-white border border-[#EAEAEA] rounded-2xl p-8">
            <div className="flex items-center gap-3 text-[#FF6154] mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#FFF1F0] border border-[#FFD6D2] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-[#202020]">
                Something interrupted your workspace
              </h2>
            </div>
            <p className="text-sm text-[#555555] leading-relaxed mb-6 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
