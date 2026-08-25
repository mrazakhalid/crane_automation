import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '../api/client.js';
import * as api from '../api/plc-connections.js';
import { useToast } from './useToast.js';
import type { PlcTagConfig, TagInput } from '../types/plc-config.js';

/**
 * Tag-mappings data hook for one connection (PLC Manager, super-admin).
 *
 * Purpose: Own the tag list + CRUD for the selected connection with optimistic
 *   updates and toasts. Reloads when `connectionId` changes; a null id clears.
 * Args: connectionId — the owning connection, or null when none is selected.
 * Returns: the list, load state, and add/remove actions.
 */
export function usePlcTags(connectionId: string | null) {
  const { notify } = useToast();
  const [tags, setTags] = useState<PlcTagConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!connectionId) {
      setTags([]);
      return;
    }
    setLoading(true);
    try {
      setTags(await api.listTags(connectionId));
    } catch (err) {
      notify(apiErrorMessage(err, 'Failed to load tags'), 'error');
    } finally {
      setLoading(false);
    }
  }, [connectionId, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const add = useCallback(
    async (input: TagInput): Promise<boolean> => {
      if (!connectionId) return false;
      try {
        const tag = await api.createTag(connectionId, input);
        setTags((prev) => [...prev, tag]);
        notify(`Tag "${tag.label}" added`, 'success');
        return true;
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not add tag'), 'error');
        return false;
      }
    },
    [connectionId, notify],
  );

  const remove = useCallback(
    async (tagId: string): Promise<void> => {
      if (!connectionId) return;
      const snapshot = tags;
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      try {
        await api.deleteTag(connectionId, tagId);
        notify('Tag removed', 'success');
      } catch (err) {
        setTags(snapshot);
        notify(apiErrorMessage(err, 'Delete failed'), 'error');
      }
    },
    [connectionId, tags, notify],
  );

  return { tags, loading, reload: load, add, remove };
}
