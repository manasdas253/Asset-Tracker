import React from "react";
import { trpc } from "@/lib/trpc";

export function VerificationSummary({ assetId }: { assetId: number }) {
  const query = trpc.asset.verification.summary.useQuery(
    { assetId },
    { refetchInterval: 15000, refetchOnWindowFocus: true }
  );
  if (query.isError)
    return <p role="alert">Verification status unavailable.</p>;
  if (!query.data) return null;
  return (
    <p className="text-sm text-slate-500">
      Physical Verification: {query.data.status}
      <br />
      Latest successful verification:{" "}
      {query.data.latestVerificationDate ?? "Not yet verified"}
    </p>
  );
}
