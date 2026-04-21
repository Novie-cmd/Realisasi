import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl text-center space-y-6 border border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-900">Aplikasi Mengalami Kendala</h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                Terjadi kesalahan teknis saat memuat tampilan. Ini mungkin disebabkan oleh data yang tidak valid atau masalah koneksi.
              </p>
              {this.state.error && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg text-left overflow-auto max-h-32">
                  <code className="text-[10px] text-red-500">{this.state.error.message}</code>
                </div>
              )}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Aplikasi</span>
            </button>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full text-slate-400 py-2 text-xs font-bold hover:text-red-500 transition-all uppercase tracking-widest"
            >
              Bersihkan Cache & Reset
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
