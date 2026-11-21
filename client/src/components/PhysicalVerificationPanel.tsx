import React, { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadPhysicalVerificationXlsx } from "@/lib/physicalVerificationXlsx";
import {
  ArrowRight,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  Filter,
  History,
  MapPin,
  Package,
  Plus,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { Link } from "wouter";
import "./AuditVerification.css";

export function PhysicalVerificationPanel() {
  const report = trpc.asset.verification.report.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });
  const review = trpc.asset.verification.review.useMutation({
    onSuccess: () => {
      setReviewNotes({});
      void report.refetch();
    },
  });
  const cycle = trpc.asset.verification.startCycle.useMutation({
    onSuccess: () => {
      setCycleName("");
      void report.refetch();
    },
  });
  const [cycleName, setCycleName] = useState("");
  const [showCycle, setShowCycle] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState({
    asset: "",
    employee: "",
    location: "",
    from: "",
    to: "",
    condition: "",
    status: "",
  });
  const [history, setHistory] = useState(() =>
    window.location.hash.startsWith("#verification-")
  );
  useEffect(() => {
    if (report.data && window.location.hash.startsWith("#verification-"))
      document
        .getElementById(window.location.hash.slice(1))
        ?.scrollIntoView?.();
  }, [report.data]);
  const rows =
    (history ? report.data?.history : report.data?.rows)?.filter(
      row =>
        (!filter.asset ||
          `${row.assetCode} ${row.assetName} ${row.category}`
            .toLowerCase()
            .includes(filter.asset.toLowerCase())) &&
        (!filter.employee ||
          `${row.employeeName} ${row.employeeCode}`
            .toLowerCase()
            .includes(filter.employee.toLowerCase())) &&
        (!filter.location ||
          row.location.toLowerCase().includes(filter.location.toLowerCase())) &&
        (!filter.from || row.date >= filter.from) &&
        (!filter.to || (Boolean(row.date) && row.date <= filter.to)) &&
        (!filter.status || row.status === filter.status) &&
        (!filter.condition || row.condition === filter.condition)
    ) ?? [];
  const currentRows = report.data?.rows ?? [];
  const counts = {
    Verified: currentRows.filter(row => row.status === "Verified").length,
    Pending: currentRows.filter(row => row.status === "Pending").length,
    Flagged: currentRows.filter(row => row.status === "Flagged").length,
  };
  const percentage = currentRows.length
    ? Math.round((counts.Verified / currentRows.length) * 100)
    : 0;
  const activeFilters = Object.values(filter).filter(Boolean).length;
  const clearFilters = () =>
    setFilter({
      asset: "",
      employee: "",
      location: "",
      from: "",
      to: "",
      condition: "",
      status: "",
    });
  return (
    <section
      className="av-workspace"
      aria-label="Physical verification workspace"
    >
      <div className="av-overview">
        <div className="av-cycle">
          <div className="av-eyebrow">
            <span className="av-live-dot" /> CURRENT VERIFICATION CYCLE
          </div>
          <h2>
            {report.data?.cycle.name ??
              (report.isError ? "Cycle unavailable" : "Loading cycle...")}
          </h2>
          <p>
            A clear picture of your assets. Every verification accounted for.
          </p>
          <div className="av-progress-label">
            <span>Verified assets</span>
            <strong>
              {report.isLoading || report.isError ? "—" : `${percentage}%`}
            </strong>
          </div>
          <div
            className="av-progress"
            role="progressbar"
            aria-label="Current cycle verified assets"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${percentage}%` }} />
          </div>
          <div className="av-cycle-footer">
            <span>
              {counts.Verified} of {currentRows.length} assets verified
            </span>
            <button
              type="button"
              onClick={() => setShowCycle(!showCycle)}
              aria-expanded={showCycle}
              aria-controls="av-cycle-form"
            >
              <Plus size={14} /> New cycle
            </button>
          </div>
        </div>
        <div className="av-stats" aria-label="Current cycle summary">
          {(
            [
              ["Verified", CheckCircle2, "Location confirmed", "green"],
              ["Pending", ClipboardCheck, "Awaiting verification", "amber"],
              ["Flagged", ShieldAlert, "Location mismatch", "red"],
            ] as const
          ).map(([status, Icon, subtitle, color]) => (
            <button
              type="button"
              key={status}
              className={`av-stat av-${color}`}
              aria-pressed={filter.status === status}
              aria-label={`Filter ${status} assets`}
              onClick={() =>
                setFilter(current => ({
                  ...current,
                  status: current.status === status ? "" : status,
                }))
              }
            >
              <span className="av-stat-top">
                <span className="av-stat-icon">
                  <Icon size={19} />
                </span>
                <ArrowRight size={16} />
              </span>
              <strong>
                {report.isLoading || report.isError ? "—" : counts[status]}
              </strong>
              <span className="av-stat-title">{status}</span>
              <span className="av-stat-note">{subtitle}</span>
            </button>
          ))}
        </div>
      </div>

      {showCycle && (
        <form
          id="av-cycle-form"
          className="av-cycle-form"
          onSubmit={event => {
            event.preventDefault();
            cycle.mutate({ name: cycleName });
          }}
        >
          <div className="av-cycle-copy">
            <h3>Begin a new verification cycle</h3>
            <p>
              All assets start as Pending. Previous records remain in history.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cycle-name">New verification cycle</Label>
            <Input
              id="cycle-name"
              required
              maxLength={120}
              placeholder="e.g. Annual audit 2026-27"
              value={cycleName}
              onChange={event => setCycleName(event.target.value)}
            />
          </div>
          <Button disabled={cycle.isPending || !cycleName.trim()}>
            {cycle.isPending ? "Starting..." : "Start new cycle"}
          </Button>
        </form>
      )}

      <div className="av-register">
        <div className="av-register-heading">
          <div>
            <div className="av-eyebrow">ASSET ASSURANCE</div>
            <h2>Physical verification</h2>
            <p>
              Track results, inspect evidence, and review location mismatches.
            </p>
          </div>
          <Button
            variant="outline"
            className="av-export"
            disabled={report.isLoading || report.isError || !rows.length}
            onClick={() =>
              downloadPhysicalVerificationXlsx(
                rows,
                history ? "All cycles" : report.data!.cycle.name
              )
            }
            aria-label="Download Physical Verification Report (.xlsx)"
          >
            <Download size={16} /> Export report{" "}
            <span className="av-file-type">XLSX</span>
          </Button>
        </div>
        <div className="av-register-nav">
          <div
            className="av-view-switch"
            role="group"
            aria-label="Verification records view"
          >
            <button
              type="button"
              aria-pressed={!history}
              onClick={() => setHistory(false)}
            >
              <ClipboardCheck size={15} /> Current cycle
            </button>
            <button
              type="button"
              aria-pressed={history}
              onClick={() => setHistory(true)}
            >
              <History size={15} /> All history
            </button>
          </div>
          <span className="av-record-count">
            {rows.length} {history ? "records" : "assets"}
          </span>
        </div>
        <div className="av-toolbar">
          <div className="av-search">
            <Search size={17} />
            <Input
              aria-label="Asset / category"
              id="filter-asset"
              placeholder="Search asset ID, name or category..."
              value={filter.asset}
              onChange={event =>
                setFilter(current => ({
                  ...current,
                  asset: event.target.value,
                }))
              }
            />
          </div>
          <select
            aria-label="Verification Status"
            className="av-select"
            value={filter.status}
            onChange={event =>
              setFilter(current => ({ ...current, status: event.target.value }))
            }
          >
            <option value="">All statuses</option>
            {["Verified", "Pending", "Flagged"].map(value => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            aria-expanded={showFilters}
            aria-controls="av-advanced-filters"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={15} /> Filters
            {activeFilters > 0 && (
              <span className="av-filter-count">{activeFilters}</span>
            )}
            <ChevronDown size={14} />
          </Button>
          {activeFilters > 0 && (
            <button type="button" className="av-clear" onClick={clearFilters}>
              <X size={14} /> Clear
            </button>
          )}
        </div>
        {showFilters && (
          <div id="av-advanced-filters" className="av-filters">
            {(
              [
                ["employee", "Employee name / ID", "text"],
                ["location", "Verification location", "text"],
                ["from", "From date", "date"],
                ["to", "To date", "date"],
              ] as const
            ).map(([key, label, type]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`filter-${key}`}>{label}</Label>
                <Input
                  id={`filter-${key}`}
                  type={type}
                  value={filter[key]}
                  onChange={event =>
                    setFilter(current => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="filter-condition">Asset Condition</Label>
              <select
                id="filter-condition"
                className="av-select w-full"
                value={filter.condition}
                onChange={event =>
                  setFilter(current => ({
                    ...current,
                    condition: event.target.value,
                  }))
                }
              >
                <option value="">All conditions</option>
                {["new", "good", "fair", "damaged"].map(value => (
                  <option key={value} value={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {(report.error || review.error || cycle.error) && (
          <p className="av-error" role="alert">
            {(report.error || review.error || cycle.error)?.message}
          </p>
        )}
        {cycle.isSuccess && (
          <p className="av-feedback" role="status">
            <CheckCircle2 size={16} /> New cycle started. Previous records are
            available in All history.
          </p>
        )}
        {review.isSuccess && (
          <p className="av-feedback" role="status">
            <CheckCircle2 size={16} /> Review saved.
          </p>
        )}
        <div
          className="av-table-scroll"
          role="region"
          aria-label="Verification records"
          tabIndex={0}
        >
          <table className="av-table">
            <thead>
              <tr>
                {[
                  "Asset",
                  "Verification status",
                  "Verified by",
                  "Location",
                  "Date & time",
                  "Evidence & review",
                ].map(label => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const key = row.id
                  ? String(row.id)
                  : `pending-${row.assetDbId}`;
                const isExpanded =
                  expanded === key ||
                  Boolean(
                    row.id && window.location.hash === `#verification-${row.id}`
                  );
                return (
                  <React.Fragment key={key}>
                    <tr
                      id={
                        row.id
                          ? `verification-${row.id}`
                          : `pending-${row.assetDbId}`
                      }
                    >
                      <td>
                        <div className="av-asset-cell">
                          <span className="av-asset-icon">
                            <Package size={18} />
                          </span>
                          <div>
                            <Link
                              className="av-asset-code"
                              href={`/assets/${row.assetDbId}`}
                            >
                              {row.assetCode}
                            </Link>
                            <span className="av-cell-primary">
                              {row.assetName}
                            </span>
                            <span className="av-cell-muted">
                              {row.category || "Uncategorized"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`av-status av-status-${row.status.toLowerCase()}`}
                        >
                          <span />
                          {row.status}
                        </span>
                        <span className="av-cell-muted mt-2">
                          {row.condition
                            ? `${row.condition.charAt(0).toUpperCase() + row.condition.slice(1)} condition`
                            : "Condition not recorded"}
                        </span>
                      </td>
                      <td>
                        <span className="av-cell-primary">
                          {row.employeeName || "Awaiting verification"}
                        </span>
                        <span className="av-cell-muted">
                          {row.employeeCode || "No submission yet"}
                        </span>
                      </td>
                      <td>
                        <span className="av-cell-primary">
                          {row.location || "Not recorded"}
                        </span>
                        <span className="av-cell-muted">
                          Registered: {row.registeredLocation || "Not set"}
                        </span>
                      </td>
                      <td>
                        <span className="av-cell-primary av-numeric">
                          {row.date || "—"}
                        </span>
                        <span className="av-cell-muted av-numeric">
                          {row.time || "Not submitted"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="av-details-button"
                          aria-expanded={isExpanded}
                          aria-controls={`av-detail-${key}`}
                          onClick={() => {
                            if (
                              window.location.hash === `#verification-${row.id}`
                            )
                              window.history.replaceState(
                                null,
                                "",
                                window.location.pathname +
                                  window.location.search
                              );
                            setExpanded(isExpanded ? null : key);
                          }}
                        >
                          {row.status === "Flagged"
                            ? "Review details"
                            : "View details"}
                          <ChevronDown
                            size={14}
                            className={isExpanded ? "rotate-180" : ""}
                          />
                        </button>
                        <span className="av-cell-muted mt-2">
                          {row.photos.length}{" "}
                          {row.photos.length === 1 ? "photo" : "photos"}
                          {row.review ? " · Reviewed" : ""}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="av-detail-row" id={`av-detail-${key}`}>
                        <td colSpan={6}>
                          <div className="av-detail-grid">
                            <div>
                              <h3>Verification evidence</h3>
                              <div className="av-evidence">
                                {row.photos.map(photo => (
                                  <a
                                    key={photo.id}
                                    download={photo.name}
                                    href={photo.dataUrl}
                                    title={`Download ${photo.name}`}
                                  >
                                    <img src={photo.dataUrl} alt={photo.name} />
                                  </a>
                                ))}
                                {!row.photos.length && (
                                  <p>No photos submitted.</p>
                                )}
                              </div>
                              <p className="av-detail-remarks">
                                {row.remarks || "No remarks recorded."}
                              </p>
                            </div>
                            <div>
                              <h3>Verification record</h3>
                              <p>
                                <MapPin size={14} /> Observed:{" "}
                                {row.location || "Not recorded"}
                              </p>
                              <p>
                                Registered:{" "}
                                {row.registeredLocation || "Not set"}
                              </p>
                              <p>
                                Latest successful verification:{" "}
                                {row.latestVerificationDate ||
                                  "Not yet verified"}
                              </p>
                              {row.status === "Flagged" && (
                                <div className="av-mismatch">
                                  <ShieldAlert size={16} /> Location differs
                                  from the registered location. Review the
                                  evidence and record your findings.
                                </div>
                              )}
                            </div>
                            <div>
                              <h3>Admin review</h3>
                              <p className="av-review-text">
                                {row.review || "No review recorded."}
                              </p>
                              {row.status === "Flagged" && row.id && (
                                <form
                                  className="space-y-2 mt-3"
                                  onSubmit={event => {
                                    event.preventDefault();
                                    review.mutate({
                                      id: row.id!,
                                      notes: reviewNotes[row.id!] ?? "",
                                    });
                                  }}
                                >
                                  <Label htmlFor={`review-${row.id}`}>
                                    Review notes
                                  </Label>
                                  <Input
                                    id={`review-${row.id}`}
                                    aria-label={`Review ${row.assetCode}`}
                                    placeholder="Record your findings..."
                                    required
                                    maxLength={2000}
                                    value={reviewNotes[row.id] ?? ""}
                                    onChange={event =>
                                      setReviewNotes(current => ({
                                        ...current,
                                        [row.id!]: event.target.value,
                                      }))
                                    }
                                  />
                                  <Button disabled={review.isPending}>
                                    <CheckCheck size={15} />
                                    {review.isPending
                                      ? "Saving..."
                                      : "Save review"}
                                  </Button>
                                </form>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {report.isLoading && (
          <div className="av-empty" role="status">
            <span className="av-loading" />
            <h3>Loading verification records</h3>
            <p>Preparing your current cycle and asset history.</p>
          </div>
        )}
        {!report.isLoading && !report.isError && !rows.length && (
          <div className="av-empty">
            <Search size={28} />
            <h3>
              {activeFilters
                ? "No matching records"
                : "No verification records yet"}
            </h3>
            <p>
              {activeFilters
                ? "Try another search or clear your filters to see more assets."
                : "Assets and submitted verifications will appear here."}
            </p>
            {activeFilters > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}
        <div className="av-register-footer">
          <span>
            <CheckCheck size={14} />{" "}
            {history
              ? "Historical records across verification cycles"
              : "Current cycle asset verification records"}
          </span>
          <span>Export includes the filtered results</span>
        </div>
      </div>
    </section>
  );
}
