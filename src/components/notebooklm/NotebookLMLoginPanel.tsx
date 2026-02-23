/**
 * NotebookLM Login Panel
 * 
 * GUI-based authentication flow for NotebookLM CLI
 * - Checks CLI installation
 * - Guides user through login/logout process
 * - Shows authentication status
 */
import { useState, useEffect, useCallback } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Terminal,
  ExternalLink,
  LogOut,
  RefreshCw,
  Info,
  AlertCircle,
  Download
} from "lucide-react";
import {
  notebooklmCheckCLI,
  notebooklmCLILogin,
  notebooklmCLILogout,
  notebooklmCLIStatus,
  type CLIStatus,
  type CLIAuthStatus,
} from "../../api/integrations";

type LoginStep = "checking" | "not-installed" | "installed" | "logging-in" | "authenticated" | "error";

interface NotebookLMLoginPanelProps {
  onAuthChange?: (isAuthenticated: boolean) => void;
}

export function NotebookLMLoginPanel({ onAuthChange }: NotebookLMLoginPanelProps) {
  const [step, setStep] = useState<LoginStep>("checking");
  const [cliStatus, setCliStatus] = useState<CLIStatus | null>(null);
  const [authStatus, setAuthStatus] = useState<CLIAuthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginProgress, setLoginProgress] = useState(0);
  const [showBrowserHint, setShowBrowserHint] = useState(false);

  // Check CLI status on mount
  const checkStatus = useCallback(async () => {
    setStep("checking");
    setError(null);
    
    try {
      const status = await notebooklmCheckCLI();
      setCliStatus(status);
      
      if (!status.installed) {
        setStep("not-installed");
        return;
      }
      
      // CLI is installed, check auth status
      const auth = await notebooklmCLIStatus();
      setAuthStatus(auth);
      
      if (auth.is_authenticated) {
        setStep("authenticated");
        onAuthChange?.(true);
      } else {
        setStep("installed");
        onAuthChange?.(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check CLI status");
      setStep("error");
      onAuthChange?.(false);
    }
  }, [onAuthChange]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Handle login
  const handleLogin = async () => {
    setStep("logging-in");
    setError(null);
    setShowBrowserHint(true);
    setLoginProgress(10);
    
    try {
      // Start login - this opens the browser
      const result = await notebooklmCLILogin();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      setLoginProgress(50);
      
      // Poll for authentication status
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds
      
      const pollInterval = setInterval(async () => {
        attempts++;
        setLoginProgress(50 + (attempts / maxAttempts) * 40);
        
        try {
          const auth = await notebooklmCLIStatus();
          
          if (auth.is_authenticated) {
            clearInterval(pollInterval);
            setAuthStatus(auth);
            setStep("authenticated");
            setLoginProgress(100);
            onAuthChange?.(true);
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setError("Login timed out. Please try again.");
            setStep("installed");
            setShowBrowserHint(false);
            onAuthChange?.(false);
          }
        } catch (err) {
          // Continue polling on error
        }
      }, 1000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setStep("installed");
      setShowBrowserHint(false);
      onAuthChange?.(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    setStep("checking");
    setError(null);
    
    try {
      const result = await notebooklmCLILogout();
      
      if (result.success) {
        setAuthStatus(null);
        setStep("installed");
        onAuthChange?.(false);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
      setStep("authenticated");
    }
  };

  // Render different states
  const renderContent = () => {
    switch (step) {
      case "checking":
        return (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Checking NotebookLM CLI...</p>
          </div>
        );

      case "not-installed":
        return (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900 dark:text-red-100">CLI Not Found</h4>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    The NotebookLM CLI is not installed on your system.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>To install the CLI, run:</p>
              <code className="block bg-muted p-3 rounded text-xs font-mono">
                pip install notebooklm
              </code>
              <p className="text-xs">
                Or visit{" "}
                <a 
                  href="https://github.com/jaredquekjz/NotebookLM-CLI" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  the GitHub repository
                </a>{" "}
                for installation instructions.
              </p>
            </div>
            
            <button
              onClick={checkStatus}
              className="w-full px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Check Again
            </button>
          </div>
        );

      case "installed":
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">CLI Installed</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Version: {cliStatus?.version || "unknown"}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>Not authenticated with NotebookLM</span>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Click below to open your browser and sign in to NotebookLM.
              </p>
            </div>
            
            <button
              onClick={handleLogin}
              className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Sign In with Browser
            </button>
            
            <p className="text-xs text-center text-muted-foreground">
              You&apos;ll be redirected to Google to authorize NotebookLM access.
            </p>
          </div>
        );

      case "logging-in":
        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-4 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center space-y-2">
                <p className="font-medium">Waiting for authentication...</p>
                <p className="text-sm text-muted-foreground">
                  {showBrowserHint 
                    ? "A browser window should have opened. Complete sign-in there."
                    : "Checking authentication status..."
                  }
                </p>
              </div>
            </div>
            
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${loginProgress}%` }}
              />
            </div>
            
            {showBrowserHint && (
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded text-sm">
                <p className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Info className="h-4 w-4" />
                  <span>Browser should have opened automatically</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  If not, check your browser for a new tab, or check the terminal output.
                </p>
              </div>
            )}
            
            <button
              onClick={() => {
                setStep("installed");
                setShowBrowserHint(false);
              }}
              className="w-full px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        );

      case "authenticated":
        return (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900 dark:text-green-100">Authenticated</h4>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Successfully connected to NotebookLM
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">CLI Version</span>
                <span className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs font-medium">
                  {cliStatus?.version || "unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="px-2 py-0.5 bg-green-500/20 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                  Connected
                </span>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        );

      case "error":
        return (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900 dark:text-red-100">Error</h4>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {error || "An unexpected error occurred"}
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={checkStatus}
              className="w-full px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-2">
        <Terminal className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">NotebookLM CLI</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Manage your NotebookLM authentication
      </p>
      {renderContent()}
    </div>
  );
}

export default NotebookLMLoginPanel;
