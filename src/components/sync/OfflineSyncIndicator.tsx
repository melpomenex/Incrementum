/**
 * Sync Status Indicator Component
 * Shows connection state, offline queue, and allows switching connection modes
 */

import { useState, useEffect } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Wifi,
  WifiOff,
  Server,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import {
  subscribeOfflineQueue,
  getOfflineQueueStats,
  setConnectionMode,
  processOfflineQueue,
  clearOfflineQueue,
  getConnectionMode,
} from '../../lib/offline-queue';

type ConnectionMode = ReturnType<typeof getConnectionMode>;
type OfflineQueueState = {
  requests: any[];
  isOnline: boolean;
  connectionMode: ConnectionMode;
  localServerAvailable: boolean;
  cloudAvailable: boolean;
};
import { useI18n } from '../../lib/i18n';

interface SyncStatusIndicatorProps {
  className?: string;
}

export function SyncStatusIndicator({ className = '' }: SyncStatusIndicatorProps) {
  const { t } = useI18n();
  const [state, setState] = useState<OfflineQueueState | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeOfflineQueue((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  const handleModeChange = async (mode: ConnectionMode) => {
    setConnectionMode(mode);
    setShowMenu(false);
  };

  const handleProcessQueue = async () => {
    setIsProcessing(true);
    try {
      await processOfflineQueue();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearQueue = () => {
    if (confirm(t('delete.clearSyncItems'))) {
      clearOfflineQueue();
      setShowMenu(false);
    }
  };

  if (!state) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-lg ${className}`}>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
        <span className="text-xs text-muted-foreground">{t("common.loading")}</span>
      </div>
    );
  }

  const queueStats = getOfflineQueueStats();
  const hasPendingItems = queueStats.total > 0;
  const isOnline = state.isOnline;

  return (
    <div className={`relative ${className}`}>
      {/* Status Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
      >
        {/* Connection Icon */}
        {isOnline ? (
          <Wifi className="w-4 h-4 text-green-500" />
        ) : (
          <WifiOff className="w-4 h-4 text-gray-400" />
        )}

        {/* Status Text */}
        <span className="text-sm text-foreground">
          {isOnline ? t('syncIndicator.connected') : t('syncIndicator.offline')}
        </span>

        {/* Queue Badge */}
        {hasPendingItems && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
            <span className="font-medium">{queueStats.total}</span>
            <span className="hidden sm:inline">{t('syncIndicator.pending')}</span>
          </span>
        )}

        {/* Chevron */}
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showMenu ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-lg shadow-xl z-20 overflow-hidden">
            {/* Connection Mode */}
            <div className="p-3 border-b border-border">
              <div className="text-xs font-semibold text-foreground mb-2">{t('syncIndicator.connectionMode')}</div>
              <div className="space-y-1">
                <ConnectionModeOption
                  mode="dual"
                  currentMode={state.connectionMode}
                  onSelect={handleModeChange}
                  label={t('syncIndicator.dualMode')}
                  description={t('syncIndicator.dualModeDesc')}
                />
                <ConnectionModeOption
                  mode="local-only"
                  currentMode={state.connectionMode}
                  onSelect={handleModeChange}
                  label={t('syncIndicator.localOnly')}
                  description={t('syncIndicator.localOnlyDesc')}
                />
                <ConnectionModeOption
                  mode="cloud-only"
                  currentMode={state.connectionMode}
                  onSelect={handleModeChange}
                  label={t('syncIndicator.cloudOnly')}
                  description={t('syncIndicator.cloudOnlyDesc')}
                />
              </div>
            </div>

            {/* Server Status */}
            <div className="p-3 border-b border-border">
              <div className="text-xs font-semibold text-foreground mb-2">{t('syncIndicator.serverStatus')}</div>
              <div className="space-y-2">
                <ServerStatusItem
                  name={t('syncIndicator.localServer')}
                  available={state.localServerAvailable}
                  icon={<Server className="w-4 h-4" />}
                />
                <ServerStatusItem
                  name={t('syncIndicator.cloudApi')}
                  available={state.cloudAvailable}
                  icon={<Cloud className="w-4 h-4" />}
                />
              </div>
            </div>

            {/* Queue Actions */}
            {hasPendingItems && (
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-foreground">
                    {t('syncIndicator.offlineQueue', { count: queueStats.total })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleProcessQueue}
                    disabled={isProcessing || !isOnline}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded hover:opacity-90 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                    {t('syncIndicator.syncNow')}
                  </button>
                  <button
                    onClick={handleClearQueue}
                    className="px-3 py-1.5 bg-muted text-foreground text-sm rounded hover:bg-muted/80"
                  >
                    {t('syncIndicator.clear')}
                  </button>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {queueStats.byPriority.high > 0 && (
                    <div>{t('syncIndicator.highPriority', { count: queueStats.byPriority.high })}</div>
                  )}
                  {queueStats.byPriority.normal > 0 && (
                    <div>{t('syncIndicator.normal', { count: queueStats.byPriority.normal })}</div>
                  )}
                  {queueStats.byPriority.low > 0 && (
                    <div>{t('syncIndicator.low', { count: queueStats.byPriority.low })}</div>
                  )}
                </div>
              </div>
            )}

            {/* Last Sync */}
            <div className="p-3">
              <div className="text-xs text-muted-foreground">
                {t('syncIndicator.changesSyncAuto')}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface ConnectionModeOptionProps {
  mode: ConnectionMode;
  currentMode: ConnectionMode;
  onSelect: (mode: ConnectionMode) => void;
  label: string;
  description: string;
}

function ConnectionModeOption({
  mode,
  currentMode,
  onSelect,
  label,
  description,
}: ConnectionModeOptionProps) {
  const isSelected = mode === currentMode;

  return (
    <button
      onClick={() => onSelect(mode)}
      className={`w-full flex items-start gap-2 p-2 rounded-lg transition-colors text-left ${
        isSelected
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-muted text-foreground'
      }`}
    >
      <div className={`w-4 h-4 mt-0.5 rounded-full border-2 ${
        isSelected
          ? 'bg-primary border-primary'
          : 'border-muted-foreground'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{description}</div>
      </div>
    </button>
  );
}

interface ServerStatusItemProps {
  name: string;
  available: boolean;
  icon: React.ReactNode;
}

function ServerStatusItem({ name, available, icon }: ServerStatusItemProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={available ? 'text-green-500' : 'text-gray-400'}>
        {icon}
      </div>
      <span className="flex-1 text-foreground">{name}</span>
      {available ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : (
        <XCircle className="w-4 h-4 text-gray-400" />
      )}
    </div>
  );
}

/**
 * Compact sync indicator for use in headers
 */
export function CompactSyncIndicator({ className = '' }: { className?: string }) {
  const [hasPending, setHasPending] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsubscribe = subscribeOfflineQueue((state) => {
      setIsOnline(state.isOnline);
      setHasPending(state.requests.length > 0);
    });
    return unsubscribe;
  }, []);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {isOnline ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : (
        <CloudOff className="w-4 h-4 text-gray-400" />
      )}
      {hasPending && (
        <span className="px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full">
          {getOfflineQueueStats().total}
        </span>
      )}
    </div>
  );
}
