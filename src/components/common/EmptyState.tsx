/**
 * Empty state component
 * Used consistently across views when there's no data to display
 * Enhanced with format icons and engaging visuals for CTAs
 */

import { ReactNode } from "react";
import {
  FileText,
  BookOpen,
  Search,
  Inbox,
  BarChart3,
  Zap,
  FolderOpen,
  Plus,
  Youtube,
  Globe,
  Sparkles,
  PartyPopper,
  Target,
} from "lucide-react";

interface EmptyStateProps {
  icon?: "documents" | "queue" | "search" | "inbox" | "analytics" | "review" | "folder" | ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

const iconMap = {
  documents: FileText,
  queue: BookOpen,
  search: Search,
  inbox: Inbox,
  analytics: BarChart3,
  review: Zap,
  folder: FolderOpen,
};

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  secondaryAction,
  children,
}: EmptyStateProps) {
  const IconComponent = typeof icon === "string" ? iconMap[icon] : null;

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 md:p-12">
      {/* Icon */}
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
        {IconComponent ? (
          <IconComponent className="w-10 h-10 text-muted-foreground" />
        ) : (
          <div className="w-10 h-10 flex items-center justify-center">{icon}</div>
        )}
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>

      {/* Description */}
      <p className="text-muted-foreground max-w-md mb-6">{description}</p>

      {/* Custom content */}
      {children}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className="px-6 py-2.5 min-h-[44px] bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              {action.icon}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-6 py-2.5 min-h-[44px] text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-lg"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Format icons for import options
const formatIcons = [
  { icon: FileText, label: "PDF", color: "text-red-500" },
  { icon: BookOpen, label: "EPUB", color: "text-blue-500" },
  { icon: Youtube, label: "YouTube", color: "text-red-600" },
  { icon: Globe, label: "Web", color: "text-green-500" },
];

/**
 * Format Icons Grid - Shows supported import formats
 */
function FormatIconsGrid({ onImport }: { onImport?: () => void }) {
  return (
    <div className="mb-6">
      <p className="text-sm text-muted-foreground mb-3">Supported formats:</p>
      <div className="flex flex-wrap justify-center gap-3">
        {formatIcons.map(({ icon: Icon, label, color }) => (
          <button
            key={label}
            onClick={onImport}
            className="flex flex-col items-center gap-1.5 p-3 bg-card border border-border rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group"
            title={`Import ${label}`}
          >
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:scale-110 transition-transform">
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Pre-configured empty states for common scenarios

export function EmptyDocuments({ onImport }: { onImport?: () => void }) {
  return (
    <EmptyState
      icon={
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center">
            <FileText className="w-10 h-10 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
            <Plus className="w-4 h-4 text-green-500" />
          </div>
        </div>
      }
      title="Import your first document"
      description="Start building your knowledge library. Drag and drop files onto this page, or click a format below to get started."
      action={
        onImport
          ? {
              label: "Browse Files",
              onClick: onImport,
              icon: <Plus className="w-4 h-4" />,
            }
          : undefined
      }
    >
      <FormatIconsGrid onImport={onImport} />
    </EmptyState>
  );
}

export function EmptyQueue({ onStartReview }: { onStartReview?: () => void }) {
  return (
    <EmptyState
      icon={
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-full flex items-center justify-center">
            <Target className="w-10 h-10 text-blue-500" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
        </div>
      }
      title="Add items to your queue"
      description="Create extracts and flashcards from your documents. They'll appear here for spaced repetition review."
      action={
        onStartReview
          ? {
              label: "Start Review",
              onClick: onStartReview,
              icon: <Zap className="w-4 h-4" />,
            }
          : undefined
      }
      secondaryAction={{
        label: "Go to Documents",
        onClick: () => window.dispatchEvent(new CustomEvent("navigate", { detail: "/documents" })),
      }}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <div className="flex -space-x-2">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-red-500" />
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-blue-500" />
          </div>
        </div>
        <span>Extract from PDFs, EPUBs, and more</span>
      </div>
    </EmptyState>
  );
}

export function EmptySearch({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <EmptyState
      icon="search"
      title="No results found"
      description={`We couldn't find anything matching "${query}". Try adjusting your search terms or filters.`}
      action={{
        label: "Clear Search",
        onClick: onClear,
      }}
    />
  );
}

export function EmptyAnalytics({ onImport }: { onImport?: () => void }) {
  return (
    <EmptyState
      icon={
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-full flex items-center justify-center">
            <BarChart3 className="w-10 h-10 text-purple-500" />
          </div>
        </div>
      }
      title="No data to analyze"
      description="Start learning and reviewing to see your progress statistics. Import documents and create flashcards to begin tracking your journey."
      action={
        onImport
          ? {
              label: "Import Your First Document",
              onClick: onImport,
              icon: <Plus className="w-4 h-4" />,
            }
          : undefined
      }
    />
  );
}

/**
 * All Caught Up - Shown when no cards are due for review
 * Celebratory empty state to make users feel good about completing reviews
 */
export function EmptyReview({ onGoToQueue }: { onGoToQueue?: () => void }) {
  return (
    <EmptyState
      icon={
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/5 rounded-full flex items-center justify-center">
            <PartyPopper className="w-10 h-10 text-green-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500/30 rounded-full flex items-center justify-center animate-bounce">
            <Sparkles className="w-3 h-3 text-yellow-500" />
          </div>
          <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-primary" />
          </div>
        </div>
      }
      title="All caught up!"
      description="You've completed all your reviews for today. Great job! Come back tomorrow when new cards are due."
      action={
        onGoToQueue
          ? {
              label: "View Queue",
              onClick: onGoToQueue,
            }
          : undefined
      }
      secondaryAction={{
        label: "Import More Content",
        onClick: () => window.dispatchEvent(new CustomEvent("import-document")),
      }}
    >
      <div className="glass-card p-4 mb-6 max-w-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-foreground">Keep the streak going!</div>
            <div className="text-xs text-muted-foreground">
              Review daily for better retention
            </div>
          </div>
        </div>
      </div>
    </EmptyState>
  );
}

export function EmptyExtracts({ onOpenDocument }: { onOpenDocument?: () => void }) {
  return (
    <EmptyState
      icon={
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-full flex items-center justify-center">
            <FolderOpen className="w-10 h-10 text-amber-500" />
          </div>
        </div>
      }
      title="No extracts yet"
      description="Select text in any document to create extracts. These will become flashcards for your review sessions."
      action={
        onOpenDocument
          ? {
              label: "Open a Document",
              onClick: onOpenDocument,
              icon: <BookOpen className="w-4 h-4" />,
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <div className="px-3 py-1.5 bg-muted rounded-lg text-xs">
          <kbd className="font-mono">Select text</kbd> → <kbd className="font-mono">Create extract</kbd>
        </div>
      </div>
    </EmptyState>
  );
}

/**
 * Empty Learning Cards - When no flashcards exist yet
 */
export function EmptyLearningCards({ onCreateCards }: { onCreateCards?: () => void }) {
  return (
    <EmptyState
      icon={
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 rounded-full flex items-center justify-center">
            <Zap className="w-10 h-10 text-indigo-500" />
          </div>
        </div>
      }
      title="No learning cards yet"
      description="Create Q&A cards, cloze deletions, or extracts from your documents to start learning with spaced repetition."
      action={
        onCreateCards
          ? {
              label: "Create Cards",
              onClick: onCreateCards,
              icon: <Plus className="w-4 h-4" />,
            }
          : undefined
      }
    >
      <div className="grid grid-cols-3 gap-3 mb-6 max-w-xs">
        <div className="p-3 bg-card border border-border rounded-lg text-center">
          <div className="text-2xl mb-1">Q&A</div>
          <div className="text-xs text-muted-foreground">Question & Answer</div>
        </div>
        <div className="p-3 bg-card border border-border rounded-lg text-center">
          <div className="text-2xl mb-1">[...]</div>
          <div className="text-xs text-muted-foreground">Cloze Deletion</div>
        </div>
        <div className="p-3 bg-card border border-border rounded-lg text-center">
          <div className="text-2xl mb-1">📝</div>
          <div className="text-xs text-muted-foreground">Extract</div>
        </div>
      </div>
    </EmptyState>
  );
}

export default EmptyState;
