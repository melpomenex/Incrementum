/**
 * Optimistic Update Hook
 * Provides utilities for optimistic UI updates with rollback on failure
 */

import { useCallback, useRef } from 'react';
import { useToast } from '../components/common/Toast';
import { useUndoRedoStore, UndoableCommand, OperationType, createCommandId } from '../stores/undoRedoStore';

/**
 * Result of an optimistic update
 */
export interface OptimisticResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  rollback?: () => Promise<void>;
}

/**
 * Options for optimistic updates
 */
export interface OptimisticOptions<TSnapshot, TResult> {
  /** Description for undo/redo history */
  description: string;
  /** Operation type for categorization */
  operationType?: OperationType;
  /** Whether to add to undo/redo history */
  addToHistory?: boolean;
  /** Function to capture the current state snapshot */
  captureSnapshot: () => TSnapshot;
  /** Function to apply the optimistic update to the UI */
  applyOptimistic: (snapshot: TSnapshot) => void;
  /** Function to perform the actual async operation */
  execute: () => Promise<TResult>;
  /** Function to rollback on failure */
  rollback: (snapshot: TSnapshot) => Promise<void>;
  /** Optional function to apply after successful server response */
  onSuccess?: (result: TResult) => void;
  /** Optional function to handle errors */
  onError?: (error: Error) => void;
  /** Toast message to show on success */
  successMessage?: string;
  /** Toast message to show on error */
  errorMessage?: string;
}

/**
 * Hook for performing optimistic UI updates
 */
export function useOptimisticUpdate() {
  const toast = useToast();
  const pendingOperationsRef = useRef<Map<string, { snapshot: unknown; rollback: (s: unknown) => Promise<void> }>>(new Map());
  const { executeCommand } = useUndoRedoStore();

  /**
   * Perform an optimistic update with automatic rollback on failure
   */
  const performOptimistic = useCallback(async <TSnapshot, TResult>(
    options: OptimisticOptions<TSnapshot, TResult>
  ): Promise<OptimisticResult<TResult>> => {
    const {
      description,
      operationType,
      addToHistory = false,
      captureSnapshot,
      applyOptimistic,
      execute,
      rollback,
      onSuccess,
      onError,
      successMessage,
      errorMessage,
    } = options;

    const operationId = createCommandId();

    try {
      // 1. Capture the current state
      const snapshot = captureSnapshot();

      // 2. Store the operation for potential rollback
      pendingOperationsRef.current.set(operationId, {
        snapshot,
        rollback: rollback as (s: unknown) => Promise<void>,
      });

      // 3. Apply optimistic update immediately
      applyOptimistic(snapshot);

      // 4. Execute the actual operation
      const result = await execute();

      // 5. Remove from pending operations
      pendingOperationsRef.current.delete(operationId);

      // 6. Handle success
      if (onSuccess) {
        onSuccess(result);
      }

      // 7. Show success toast if message provided
      if (successMessage) {
        toast.success(description, successMessage);
      }

      // 8. Add to undo/redo history if requested
      if (addToHistory && operationType) {
        const command: UndoableCommand = {
          id: createCommandId(),
          type: operationType,
          description,
          timestamp: Date.now(),
          execute: async () => {
            const newSnapshot = captureSnapshot();
            applyOptimistic(newSnapshot);
            await execute();
          },
          undo: async () => {
            await rollback(snapshot);
          },
          redo: async () => {
            const newSnapshot = captureSnapshot();
            applyOptimistic(newSnapshot);
            await execute();
          },
        };
        await executeCommand(command);
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const pendingOp = pendingOperationsRef.current.get(operationId);

      // Rollback the optimistic update
      if (pendingOp) {
        try {
          await pendingOp.rollback(pendingOp.snapshot);
        } catch (rollbackError) {
          console.error('Failed to rollback optimistic update:', rollbackError);
        }
        pendingOperationsRef.current.delete(operationId);
      }

      const err = error instanceof Error ? error : new Error(String(error));

      if (onError) {
        onError(err);
      }

      toast.error(
        errorMessage || 'Operation failed',
        err.message
      );

      return {
        success: false,
        error: err,
        rollback: pendingOp ? async () => {
          await pendingOp.rollback(pendingOp.snapshot);
        } : undefined,
      };
    }
  }, [toast, executeCommand]);

  /**
   * Perform a batch of optimistic updates
   */
  const performBatchOptimistic = useCallback(async <T>(
    updates: Array<{
      captureSnapshot: () => T;
      applyOptimistic: (snapshot: T) => void;
      execute: () => Promise<void>;
      rollback: (snapshot: T) => Promise<void>;
    }>
  ): Promise<{ success: boolean; errors: Error[] }> => {
    const snapshots: T[] = [];
    const errors: Error[] = [];

    // Capture all snapshots and apply all optimistic updates
    for (const update of updates) {
      snapshots.push(update.captureSnapshot());
    }

    // Apply all optimistic updates
    for (let i = 0; i < updates.length; i++) {
      updates[i].applyOptimistic(snapshots[i]);
    }

    for (let i = 0; i < updates.length; i++) {
      try {
        await updates[i].execute();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        // Rollback this specific update
        try {
          await updates[i].rollback(snapshots[i]);
        } catch (rollbackError) {
          console.error('Failed to rollback batch update:', rollbackError);
        }
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }, []);

  /**
   * Cancel all pending operations and rollback
   */
  const cancelAllPending = useCallback(async () => {
    const pendingOps = Array.from(pendingOperationsRef.current.entries());
    pendingOperationsRef.current.clear();

    for (const [id, op] of pendingOps) {
      try {
        await op.rollback(op.snapshot);
      } catch (error) {
        console.error(`Failed to rollback operation ${id}:`, error);
      }
    }
  }, []);

  return {
    performOptimistic,
    performBatchOptimistic,
    cancelAllPending,
    hasPendingOperations: pendingOperationsRef.current.size > 0,
  };
}

/**
 * Higher-order function to create optimistic store actions
 */
export function createOptimisticAction<TState, TPayload, TResult>(
  getState: () => TState,
  setState: (state: Partial<TState>) => void,
  options: {
    optimisticUpdater: (state: TState, payload: TPayload) => Partial<TState>;
    serverAction: (payload: TPayload) => Promise<TResult>;
    rollbackUpdater: (state: TState, payload: TPayload) => Partial<TState>;
  }
) {
  return async (payload: TPayload): Promise<{ success: boolean; result?: TResult; error?: Error }> => {
    const currentState = getState();

    try {
      // Apply optimistic update
      const optimisticState = options.optimisticUpdater(currentState, payload);
      setState(optimisticState);

      const result = await options.serverAction(payload);

      return { success: true, result };
    } catch (error) {
      // Rollback on failure
      const rollbackState = options.rollbackUpdater(getState(), payload);
      setState(rollbackState);

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };
}

export default useOptimisticUpdate;
