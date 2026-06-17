/**
 * Enhanced Node Detail View
 * Beautiful panel showing detailed information about selected graph nodes
 */

import { useState, useMemo, useEffect } from "react";
import {
  ArrowSquareOut,
  Brain,
  CaretRight,
  DotsThree,
  Folder,
  Hash,
  Link,
  PencilSimple,
  Quotes,
  ShareNetwork,
  Sparkle,
  Tag,
  TextT,
  Trash,
  X,
} from "@phosphor-icons/react";
import { GraphNode, GraphEdge, GraphNodeType } from "./KnowledgeGraph";
import { useI18n } from "../../lib/i18n";

export interface NodeDetailViewProps {
  node: GraphNode;
  relatedNodes: GraphNode[];
  connectedEdges: GraphEdge[];
  onClose: () => void;
  onNavigate?: (nodeId: string) => void;
  onEdit?: (nodeId: string) => void;
  onSaveDetails?: (nodeId: string, updates: {
    label?: string;
    description?: string;
    category?: string;
    tags?: string[];
  }) => Promise<void> | void;
  onDelete?: (nodeId: string) => void;
}

const NODE_CONFIG = {
  [GraphNodeType.Document]: {
    icon: TextT,
    color: "blue",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    textColor: "text-blue-500",
    gradient: "from-blue-500/20 to-blue-600/5",
    labelKey: "graph.document",
  },
  [GraphNodeType.Extract]: {
    icon: Quotes,
    color: "green",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    textColor: "text-green-500",
    gradient: "from-green-500/20 to-green-600/5",
    labelKey: "graph.extract",
  },
  [GraphNodeType.Flashcard]: {
    icon: Brain,
    color: "purple",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    textColor: "text-purple-500",
    gradient: "from-purple-500/20 to-purple-600/5",
    labelKey: "graph.flashcard",
  },
  [GraphNodeType.Category]: {
    icon: Folder,
    color: "amber",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    textColor: "text-amber-500",
    gradient: "from-amber-500/20 to-amber-600/5",
    labelKey: "graph.categorySingular",
  },
  [GraphNodeType.Tag]: {
    icon: Tag,
    color: "cyan",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    textColor: "text-cyan-500",
    gradient: "from-cyan-500/20 to-cyan-600/5",
    labelKey: "graph.tag",
  },
};

const EDGE_TYPE_LABELS: Record<string, { labelKey: string; color: string }> = {
  reference: { labelKey: "graph.edgeReferences", color: "text-blue-400" },
  contains: { labelKey: "graph.edgeContains", color: "text-slate-400" },
  related: { labelKey: "graph.edgeRelated", color: "text-green-400" },
  derived: { labelKey: "graph.edgeDerivedFrom", color: "text-purple-400" },
  tagged: { labelKey: "graph.edgeTaggedWith", color: "text-cyan-400" },
};

export function NodeDetailView({
  node,
  relatedNodes,
  connectedEdges,
  onClose,
  onNavigate,
  onEdit,
  onSaveDetails,
  onDelete,
}: NodeDetailViewProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"connections" | "metadata">("connections");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState(node.label);
  const [editDescription, setEditDescription] = useState(node.description || "");
  const [editCategory, setEditCategory] = useState(node.category || "");
  const [editTags, setEditTags] = useState((node.tags || []).join(", "));

  const config = NODE_CONFIG[node.type];
  const Icon = config.icon;
  const canInlineEdit = node.type === GraphNodeType.Document || node.type === GraphNodeType.Extract;

  useEffect(() => {
    setIsEditing(false);
    setIsSaving(false);
    setSaveError(null);
    setEditLabel(node.label);
    setEditDescription(node.description || "");
    setEditCategory(node.category || "");
    setEditTags((node.tags || []).join(", "));
  }, [node.id, node.label, node.description, node.category, node.tags]);

  // Group connections by type
  const groupedConnections = useMemo(() => {
    const groups: Record<string, { nodes: GraphNode[]; edges: GraphEdge[] }> = {};

    connectedEdges.forEach((edge) => {
      const type = edge.type || "related";
      if (!groups[type]) {
        groups[type] = { nodes: [], edges: [] };
      }
      groups[type].edges.push(edge);

      const relatedId = edge.source === node.id ? edge.target : edge.source;
      const relatedNode = relatedNodes.find((n) => n.id === relatedId);
      if (relatedNode && !groups[type].nodes.some((n) => n.id === relatedId)) {
        groups[type].nodes.push(relatedNode);
      }
    });

    return groups;
  }, [connectedEdges, relatedNodes, node.id]);

  const toggleGroup = (type: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedGroups(newExpanded);
  };

  const totalConnections = Object.values(groupedConnections).reduce(
    (sum, group) => sum + group.nodes.length,
    0
  );

  const handleEditClick = () => {
    if (canInlineEdit && onSaveDetails) {
      setActiveTab("metadata");
      setIsEditing(true);
      setSaveError(null);
      return;
    }
    onEdit?.(node.id);
  };

  const handleSave = async () => {
    if (!onSaveDetails) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveDetails(node.id, {
        label: editLabel.trim(),
        description: editDescription.trim(),
        category: editCategory.trim() || undefined,
        tags: editTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      setIsEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("graph.failedToSaveChanges"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-card/98 backdrop-blur-xl border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header with gradient */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${config.gradient} border-b ${config.borderColor}`}>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />

        <div className="relative px-5 py-5">
          <div className="flex items-start justify-between mb-4">
            <div
              className={`w-12 h-12 rounded-2xl ${config.bgColor} ${config.borderColor} border flex items-center justify-center`}
            >
              <Icon className={`w-6 h-6 ${config.textColor}`} />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <DotsThree className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mb-2">
            <span className={`text-xs font-medium uppercase tracking-wider ${config.textColor}`}>
              {t(config.labelKey)}
            </span>
          </div>
          <h2 className="text-xl font-semibold leading-tight mb-1">{node.label}</h2>
          {node.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{node.description}</p>
          )}

          {/* Quick stats */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-sm">
              <Link className="w-4 h-4 text-muted-foreground" />
              <span>{totalConnections}</span>
              <span className="text-muted-foreground">{t("graph.connections")}</span>
            </div>
            {node.tags && (
              <div className="flex items-center gap-1.5 text-sm">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <span>{node.tags.length}</span>
                <span className="text-muted-foreground">{t("graph.tags")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action menu */}
        {showActions && (
          <div className="absolute top-16 right-5 bg-card border border-border rounded-xl shadow-xl p-1 z-10 animate-in fade-in zoom-in-95 duration-100">
            {onNavigate && (
              <button
                onClick={() => {
                  onNavigate(node.id);
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-lg transition-colors"
              >
                <ArrowSquareOut className="w-4 h-4" />
                {t("graph.open")}
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => {
                  handleEditClick();
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-lg transition-colors"
              >
                <PencilSimple className="w-4 h-4" />
                {t("graph.edit")}
              </button>
            )}
            <button
              onClick={() => {
                setShowActions(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-lg transition-colors"
            >
              <ShareNetwork className="w-4 h-4" />
              {t("graph.share")}
            </button>
            {onDelete && (
              <button
                onClick={() => {
                  onDelete(node.id);
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              >
                <Trash className="w-4 h-4" />
                {t("graph.delete")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("connections")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === "connections" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("graph.connectionsTab")}
          {activeTab === "connections" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("metadata")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === "metadata" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("graph.details")}
          {activeTab === "metadata" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "connections" ? (
          <div className="p-4">
            {Object.entries(groupedConnections).length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Link className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">{t("graph.noConnectionsYet")}</p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  {t("graph.isolatedNode")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedConnections).map(([type, data]) => {
                  const edgeConfig = EDGE_TYPE_LABELS[type] || { labelKey: "", color: "text-slate-400" };
                  const isExpanded = expandedGroups.has(type);

                  return (
                    <div
                      key={type}
                      className="border border-border rounded-xl overflow-hidden bg-card"
                    >
                      <button
                        onClick={() => toggleGroup(type)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${edgeConfig.color}`}>
                            {edgeConfig.labelKey ? t(edgeConfig.labelKey) : type}
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {data.nodes.length}
                          </span>
                        </div>
                        <CaretRight
                          className={`w-4 h-4 text-muted-foreground transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border">
                          {data.nodes.map((relatedNode) => {
                            const relatedConfig = NODE_CONFIG[relatedNode.type];
                            const RelatedIcon = relatedConfig.icon;

                            return (
                              <button
                                key={relatedNode.id}
                                onClick={() => onNavigate?.(relatedNode.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
                              >
                                <div
                                  className={`w-8 h-8 rounded-lg ${relatedConfig.bgColor} flex items-center justify-center flex-shrink-0`}
                                >
                                  <RelatedIcon className={`w-4 h-4 ${relatedConfig.textColor}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                    {relatedNode.label}
                                  </p>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {t(NODE_CONFIG[relatedNode.type].labelKey)}
                                  </p>
                                </div>
                                <CaretRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {isEditing && (
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{t("graph.editDetails")}</div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t("graph.title")}</label>
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {node.type === GraphNodeType.Extract ? t("graph.content") : t("graph.description")}
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-y"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t("graph.category")}</label>
                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t("graph.tagsCommaSeparated")}</label>
                  <input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
                  />
                </div>
                {saveError && (
                  <div className="text-xs text-destructive">{saveError}</div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
                  >
                    {isSaving ? t("graph.saving") : t("graph.save")}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setSaveError(null);
                      setEditLabel(node.label);
                      setEditDescription(node.description || "");
                      setEditCategory(node.category || "");
                      setEditTags((node.tags || []).join(", "));
                    }}
                    disabled={isSaving}
                    className="px-3 py-2 rounded-lg border border-border text-sm"
                  >
                    {t("graph.cancel")}
                  </button>
                </div>
              </div>
            )}

            {/* Category */}
            {node.category && (
              <div className="bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Folder className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">{t("graph.category")}</span>
                </div>
                <span className="inline-flex items-center px-3 py-1.5 bg-card border border-border rounded-lg text-sm">
                  {node.category}
                </span>
              </div>
            )}

            {/* Tags */}
            {node.tags && node.tags.length > 0 && (
              <div className="bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Hash className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">{t("graph.tags")}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {node.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 bg-accent text-accent-foreground text-sm rounded-lg"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            {node.metadata && Object.keys(node.metadata).length > 0 && (
              <div className="bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <Sparkle className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">{t("graph.metadata")}</span>
                </div>
                <dl className="space-y-2">
                  {Object.entries(node.metadata).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between py-2 border-b border-border/50 last:border-0"
                    >
                      <dt className="text-sm text-muted-foreground capitalize">{key}</dt>
                      <dd className="text-sm text-right max-w-[150px] truncate">
                        {String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* ID */}
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">{t("graph.nodeId")}</span>
              </div>
              <code className="text-xs bg-card px-2 py-1 rounded border border-border font-mono">
                {node.id}
              </code>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="grid grid-cols-2 gap-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate(node.id)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 ${config.bgColor} ${config.textColor} rounded-xl font-medium transition-all hover:brightness-110`}
            >
              <ArrowSquareOut className="w-4 h-4" />
              {t("graph.open")}
            </button>
          )}
          {onEdit && (
            <button
              onClick={handleEditClick}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl font-medium hover:bg-muted transition-colors"
            >
              <PencilSimple className="w-4 h-4" />
              {t("graph.edit")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact node preview card
 */
export function NodePreviewCard({
  node,
  onClick,
  className = "",
}: {
  node: GraphNode;
  onClick?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const config = NODE_CONFIG[node.type];
  const Icon = config.icon;

  return (
    <div
      onClick={onClick}
      className={`bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-all ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${config.textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{node.label}</p>
          <p className={`text-xs ${config.textColor} capitalize`}>{t(config.labelKey)}</p>
        </div>
      </div>

      {node.description && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {node.description}
        </p>
      )}

      {node.tags && node.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {node.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-muted rounded-md text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
          {node.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{node.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Node tooltip for hover
 */
export function NodeTooltip({ node }: { node: GraphNode }) {
  const { t } = useI18n();
  const config = NODE_CONFIG[node.type];
  const Icon = config.icon;

  return (
    <div className="bg-card border border-border rounded-xl shadow-xl p-3 min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded-lg ${config.bgColor} flex items-center justify-center`}>
          <Icon className={`w-3 h-3 ${config.textColor}`} />
        </div>
        <span className={`text-xs font-medium uppercase tracking-wider ${config.textColor}`}>
          {t(config.labelKey)}
        </span>
      </div>
      <p className="font-medium text-sm">{node.label}</p>
      {node.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {node.description}
        </p>
      )}
    </div>
  );
}
