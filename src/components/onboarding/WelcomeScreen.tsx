/**
 * Welcome Screen - First screen of onboarding flow
 * Enhanced with demo content option and start fresh option
 */

import { useState } from 'react';
import {
  BookOpen,
  Layers,
  Brain,
  Sparkles,
  FileText,
  Play,
  ArrowRight,
  Zap,
} from 'lucide-react';

interface WelcomeScreenProps {
  onComplete: () => void;
  onImportDemo?: () => void;
}

export function WelcomeScreen({ onComplete, onImportDemo }: WelcomeScreenProps) {
  const [showOptions, setShowOptions] = useState(false);

  const handleGetStarted = () => {
    setShowOptions(true);
  };

  const handleStartFresh = () => {
    onComplete();
  };

  const handleImportDemo = () => {
    if (onImportDemo) {
      onImportDemo();
    }
    onComplete();
  };

  if (showOptions) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full animate-glass-scale-in">
          {/* Header */}
          <div className="p-8 text-center border-b border-border">
            <div className="w-16 h-16 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              How would you like to start?
            </h1>
            <p className="text-muted-foreground">
              Choose an option to begin your learning journey
            </p>
          </div>

          {/* Options */}
          <div className="p-6 space-y-4">
            {/* Demo Content Option */}
            <button
              onClick={handleImportDemo}
              className="w-full p-4 bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30 hover:border-primary/50 rounded-xl text-left transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Play className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">Try with Demo Content</h3>
                    <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                      Recommended
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Start with sample documents and flashcards to see how Incrementum works.
                    Perfect for exploring the features before adding your own content.
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-xs text-primary">
                    <FileText className="w-3 h-3" />
                    <span>Sample PDF</span>
                    <BookOpen className="w-3 h-3 ml-2" />
                    <span>Sample EPUB</span>
                    <Zap className="w-3 h-3 ml-2" />
                    <span>10 Demo Cards</span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>

            {/* Start Fresh Option */}
            <button
              onClick={handleStartFresh}
              className="w-full p-4 bg-muted/30 border border-border hover:border-border/80 hover:bg-muted/50 rounded-xl text-left transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Start Fresh</h3>
                  <p className="text-sm text-muted-foreground">
                    Begin with an empty library. Import your own documents and create
                    your personalized learning materials from scratch.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              You can always add more content later from the Documents page
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-8 text-center border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
          <div className="w-20 h-20 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome to Incrementum
          </h1>
          <p className="text-muted-foreground">
            Your incremental reading and spaced repetition companion
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="text-center p-4 bg-muted/30 rounded-xl border border-border">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-foreground font-medium mb-2">Import Documents</h3>
              <p className="text-sm text-muted-foreground">
                Add PDFs, EPUBs, YouTube videos, and more
              </p>
            </div>

            <div className="text-center p-4 bg-muted/30 rounded-xl border border-border">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Layers className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-foreground font-medium mb-2">Create Extracts</h3>
              <p className="text-sm text-muted-foreground">
                Highlight key passages and create notes
              </p>
            </div>

            <div className="text-center p-4 bg-muted/30 rounded-xl border border-border">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Brain className="w-6 h-6 text-purple-500" />
              </div>
              <h3 className="text-foreground font-medium mb-2">Learn Efficiently</h3>
              <p className="text-sm text-muted-foreground">
                Spaced repetition for long-term retention
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="glass-card rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">How it works</h2>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                  1
                </span>
                <p className="text-foreground">Import your documents (PDFs, EPUBs, videos, articles)</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                  2
                </span>
                <p className="text-foreground">Create extracts and learning items as you read</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                  3
                </span>
                <p className="text-foreground">Review with spaced repetition to remember what you learn</p>
              </li>
            </ol>
          </div>

          {/* Keyboard shortcut hint */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border">
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <span className="px-2 py-1 bg-muted rounded text-foreground text-xs font-mono">Ctrl/⌘ + K</span>
              <span>Open the command palette anytime to navigate quickly</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex justify-end items-center bg-muted/20">
          <button
            onClick={handleGetStarted}
            className="px-6 py-2.5 min-h-[44px] bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none flex items-center gap-2"
            aria-label="Get started with Incrementum"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;
