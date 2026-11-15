export default function Skeleton({ className = '' }) {
  return <span aria-hidden="true" className={`ui-skeleton ${className}`} />;
}

export function HistorySkeleton() {
  return <div className="ui-skeleton-grid" role="status" aria-label="Loading screening history">
    <div className="ui-skeleton-card"><Skeleton className="ui-skeleton-title" /><Skeleton className="ui-skeleton-line" /><Skeleton className="ui-skeleton-line short" /><Skeleton className="ui-skeleton-block" /></div>
    <div className="ui-skeleton-card"><Skeleton className="ui-skeleton-title" /><Skeleton className="ui-skeleton-line" /><Skeleton className="ui-skeleton-line short" /><Skeleton className="ui-skeleton-block" /></div>
  </div>;
}
