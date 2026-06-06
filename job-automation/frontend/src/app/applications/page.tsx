'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  api,
  APPLICATION_STAGES,
  type Application,
  type ApplicationStage,
  type GroupedApplications,
} from '@/lib/api';
import ApplicationCard from '@/components/ApplicationCard';
import ApplicationDrawer from '@/components/ApplicationDrawer';
import { useDrawer } from '@/components/Drawer';

const STAGES: { id: ApplicationStage; label: string; color: string; icon: string }[] = [
  { id: 'applied',      label: 'Applied',       color: '#f59e0b', icon: '📨' },
  { id: 'phone_screen', label: 'Phone Screen',  color: '#a855f7', icon: '📞' },
  { id: 'technical',    label: 'Technical',     color: '#22c55e', icon: '💻' },
  { id: 'offer',        label: 'Offer',         color: '#10b981', icon: '🎉' },
  { id: 'rejected',     label: 'Rejected',      color: '#ef4444', icon: '✗'  },
  { id: 'ghosted',      label: 'Ghosted',       color: '#9ca3af', icon: '👻' },
];

function emptyGroups(): GroupedApplications {
  const out = {} as GroupedApplications;
  for (const s of APPLICATION_STAGES) out[s] = [];
  return out;
}

export default function ApplicationsPage() {
  const [groups, setGroups] = useState<GroupedApplications>(emptyGroups());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const drawer = useDrawer<Application>();

  // dnd-kit sensors: pointer (with 5px threshold so plain clicks pass through
  // to the card's onClick) + keyboard (space to pick up, arrows to move).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.applications.list();
      // Ensure every stage key exists even if backend omits empties
      setGroups({ ...emptyGroups(), ...res });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = useMemo(
    () => Object.values(groups).reduce((s, arr) => s + arr.length, 0),
    [groups]
  );

  /** Look up an application id across all stages. */
  function findApp(id: string): { app: Application; stage: ApplicationStage } | null {
    for (const stage of APPLICATION_STAGES) {
      const found = groups[stage].find((a) => a.id === id);
      if (found) return { app: found, stage };
    }
    return null;
  }

  async function moveToStage(appId: string, toStage: ApplicationStage) {
    const hit = findApp(appId);
    if (!hit || hit.stage === toStage) return;

    // Optimistic update
    const prev = groups;
    const next: GroupedApplications = { ...groups };
    next[hit.stage] = next[hit.stage].filter((a) => a.id !== appId);
    next[toStage] = [{ ...hit.app, stage: toStage }, ...next[toStage]];
    setGroups(next);

    try {
      await api.applications.patch(appId, { stage: toStage });
    } catch (e) {
      setGroups(prev); // rollback
      setError(`Move failed: ${(e as Error).message}`);
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const dropped = String(over.id);

    // The drop target can be either a column id (stage) or another card id.
    // If it's a card id, resolve to its stage.
    const stageGuess: ApplicationStage | null =
      APPLICATION_STAGES.includes(dropped as ApplicationStage)
        ? (dropped as ApplicationStage)
        : (findApp(dropped)?.stage ?? null);

    if (!stageGuess) return;
    moveToStage(String(active.id), stageGuess);
  }

  const onCardChange = (updated: Application) => {
    setGroups((g) => {
      const next: GroupedApplications = emptyGroups();
      // Re-bucket every application; if `updated` exists, replace it; if it
      // moved stages, swap into the right column.
      for (const stage of APPLICATION_STAGES) {
        next[stage] = g[stage]
          .filter((a) => a.id !== updated.id);
      }
      next[updated.stage] = [updated, ...next[updated.stage]];
      return next;
    });
    drawer.open(updated); // keep drawer in sync with optimistic update
  };

  const onCardDeleted = (id: string) => {
    setGroups((g) => {
      const next: GroupedApplications = emptyGroups();
      for (const stage of APPLICATION_STAGES) {
        next[stage] = g[stage].filter((a) => a.id !== id);
      }
      return next;
    });
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Applications</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${total} application${total === 1 ? '' : 's'} in your pipeline`}
          </p>
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}

      {!loading && total === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No applications yet</div>
            <div className="empty-sub">
              Apply to a job from the Jobs page to see it land here.
            </div>
            <a href="/jobs" className="btn btn-primary" style={{ marginTop: 12 }}>Browse jobs →</a>
          </div>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(220px, 1fr))',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 16,
            }}
          >
            {STAGES.map((s) => (
              <Column
                key={s.id}
                stage={s}
                items={groups[s.id]}
                onCardClick={(a) => drawer.open(a)}
              />
            ))}
          </div>
        </DndContext>
      )}

      {drawer.drawer((app) => (
        <ApplicationDrawer
          app={app}
          onChange={onCardChange}
          onClose={drawer.close}
          onDeleted={onCardDeleted}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Column — droppable region wrapping a SortableContext
// ---------------------------------------------------------------------------
function Column({
  stage, items, onCardClick,
}: {
  stage: { id: ApplicationStage; label: string; color: string; icon: string };
  items: Application[];
  onCardClick: (a: Application) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div ref={setNodeRef} className={`kanban-col ${isOver ? 'over' : ''}`}>
      <div className="kanban-col-head">
        <span className="kanban-col-dot" style={{ background: stage.color }} />
        <span className="kanban-col-name">
          {stage.icon} {stage.label}
        </span>
        <span className="kanban-col-count">{items.length}</span>
      </div>
      <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        {items.length === 0 && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '24px 8px',
            fontStyle: 'italic',
          }}>
            Drop here
          </div>
        )}
        {items.map((a) => (
          <ApplicationCard key={a.id} app={a} onClick={onCardClick} />
        ))}
      </SortableContext>
    </div>
  );
}
