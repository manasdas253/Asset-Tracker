import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function PasswordForm({ required = false }: { required?: boolean }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const utils = trpc.useUtils();
  const change = trpc.auth.changePassword.useMutation({
    onSuccess: async () => { setCurrent(""); setNew(""); setConfirm(""); utils.invalidate(); toast.success("Password changed."); },
    onError: error => toast.error(error.message),
  });
  return <Card className="rounded-[22px] border-slate-200"><CardHeader><CardTitle>{required ? "Set your own password" : "Change password"}</CardTitle></CardHeader><CardContent>
    <p className="mb-4 text-sm text-slate-500">{required ? "Replace your temporary password before accessing the workspace." : "Changing your password signs out your other sessions."} Use at least 12 characters.</p>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (newPassword !== confirm) { toast.error("New passwords do not match."); return; } change.mutate({ currentPassword, newPassword }); }}>
      <label className="block text-sm font-semibold">Current password<Input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={event => setCurrent(event.target.value)} /></label>
      <label className="block text-sm font-semibold">New password<Input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={event => setNew(event.target.value)} /></label>
      <label className="block text-sm font-semibold">Confirm new password<Input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={event => setConfirm(event.target.value)} /></label>
      <Button disabled={change.isPending} type="submit">{change.isPending ? "Saving..." : "Change password"}</Button>
    </form>
  </CardContent></Card>;
}

export function FirstPasswordPage() {
  const { logout } = useAuth();
  return <main className="min-h-screen bg-[#f4f6f8] p-6"><div className="mx-auto max-w-md space-y-4 pt-12"><PasswordForm required /><Button variant="outline" onClick={() => void logout()}>Sign out</Button></div></main>;
}

export function ProfilePage() {
  const { user } = useAuth();
  return <div className="mx-auto max-w-2xl space-y-6"><h1 className="text-2xl font-black">My profile</h1><Card className="rounded-[22px]"><CardContent className="space-y-2 p-6"><p className="font-bold">{user?.name}</p><p>Employee ID: {user?.employeeId}</p><p>{user?.email}</p><p className="capitalize">{user?.role}</p></CardContent></Card><PasswordForm /></div>;
}

export function EmployeeAccountsPage() {
  const accounts = trpc.auth.accounts.useQuery();
  const [selectedId, setSelectedId] = useState(0);
  const [form, setForm] = useState({ employeeId: "", name: "", email: "" });
  const [credential, setCredential] = useState<{ temporaryPassword: string; expiresAt: Date; employeeId: string } | null>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetPage, setAssetPage] = useState(1);
  const grants = trpc.auth.permissions.useQuery({ accountId: selectedId }, { enabled: selectedId > 0 });
  const assets = trpc.asset.list.useQuery({ search: assetSearch, page: assetPage, pageSize: 20 });
  const audit = trpc.auth.audit.useQuery({ page: 1 });
  const utils = trpc.useUtils();
  const refresh = () => { void utils.auth.invalidate(); };
  const register = trpc.auth.registerEmployee.useMutation({ onSuccess: result => { setCredential(result); setSelectedId(result.accountId); setForm({ employeeId: "", name: "", email: "" }); refresh(); }, onError: error => toast.error(error.message) });
  const reset = trpc.auth.resetPassword.useMutation({ onSuccess: (result, input) => { setCredential({ ...result, employeeId: accounts.data?.find(account => account.id === input.accountId)?.employeeId ?? String(input.accountId) }); setSelectedId(input.accountId); refresh(); }, onError: error => toast.error(error.message) });
  const active = trpc.auth.setActive.useMutation({ onSuccess: refresh, onError: error => toast.error(error.message) });
  const permission = trpc.auth.setAssetPermission.useMutation({ onSuccess: refresh, onError: error => toast.error(error.message) });
  const selected = accounts.data?.find(account => account.id === selectedId);
  return <div className="mx-auto max-w-6xl space-y-6"><div><p className="text-xs font-bold uppercase text-[#c5161d]">Administration</p><h1 className="text-2xl font-black">Employee access</h1></div>
    {credential && <Card className="border-amber-300"><CardContent className="space-y-3 p-5"><p className="font-bold">Temporary password for {credential.employeeId}</p><code className="block break-all rounded bg-slate-100 p-3 text-lg">{credential.temporaryPassword}</code><p className="text-sm">Share privately with this employee. Expires {new Date(credential.expiresAt).toLocaleString()}. They must change it at first login. It is shown only here.</p><Button variant="outline" onClick={() => setCredential(null)}>Dismiss password</Button></CardContent></Card>}
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Register employee login</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={event => { event.preventDefault(); register.mutate({ ...form, email: form.email || undefined }); }}>
      <p className="text-sm text-slate-500">An existing Employee ID links to its employee record. New IDs create an employee record.</p>
      <label className="block text-sm font-semibold">Employee ID<Input value={form.employeeId} required maxLength={80} onChange={event => setForm({ ...form, employeeId: event.target.value })} /></label>
      <label className="block text-sm font-semibold">Employee name<Input value={form.name} required minLength={2} maxLength={160} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label className="block text-sm font-semibold">Email (optional)<Input type="email" value={form.email} maxLength={320} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
      <Button type="submit" disabled={register.isPending}>Generate temporary password</Button>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle>Accounts</CardTitle></CardHeader><CardContent className="space-y-3">
      {accounts.isError && <p role="alert">Could not load accounts.</p>}
      {accounts.data?.map(account => <div key={account.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${selectedId === account.id ? "border-[#c5161d]" : "border-slate-200"}`}><div><p className="font-semibold">{account.name}</p><p className="text-xs text-slate-500">{account.employeeId} · {account.role} · {account.isActive ? "Active" : "Inactive"}{account.mustChangePassword ? " · Password change required" : ""}</p></div>{account.role === "employee" && <Button variant="outline" onClick={() => { setSelectedId(account.id); setCredential(null); }}>Manage</Button>}</div>)}
    </CardContent></Card></div>
    {selected?.role === "employee" && <Card><CardHeader><CardTitle>Permissions for {selected.name} ({selected.employeeId})</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-3"><Button disabled={reset.isPending} variant="outline" onClick={() => reset.mutate({ accountId: selectedId })}>Reset password</Button><Button disabled={active.isPending} variant="outline" onClick={() => active.mutate({ accountId: selectedId, active: !selected.isActive })}>{selected.isActive ? "Deactivate account" : "Activate account"}</Button></div>
      <p className="text-sm text-slate-500">Employees can read only explicitly granted assets. Grants do not permit edits, checkout, reports or administration.</p>
      <Input aria-label="Search assets for permissions" placeholder="Search assets" value={assetSearch} onChange={event => { setAssetSearch(event.target.value); setAssetPage(1); }} />
      {grants.isError && <p role="alert">Could not load permissions.</p>}
      {assets.data?.rows.map(asset => <label key={asset.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" disabled={permission.isPending || !grants.data || grants.isFetching} checked={Boolean(grants.data?.some(grant => grant.assetId === asset.id))} onChange={event => permission.mutate({ accountId: selectedId, assetId: asset.id, allowed: event.target.checked })} /><span><b>{asset.assetId}</b> · {asset.name}</span></label>)}
      <div className="flex gap-3"><Button variant="outline" disabled={assetPage <= 1} onClick={() => setAssetPage(assetPage - 1)}>Previous</Button><Button variant="outline" disabled={assetPage * 20 >= (assets.data?.total ?? 0)} onClick={() => setAssetPage(assetPage + 1)}>Next</Button></div>
    </CardContent></Card>}
    <Card><CardHeader><CardTitle>Security audit (latest 100)</CardTitle></CardHeader><CardContent><div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Result</th><th>Details</th></tr></thead><tbody>{audit.data?.map(row => <tr className="border-t" key={row.id}><td className="p-2">{new Date(row.occurredAt).toLocaleString()}</td><td>{row.actor ?? row.accountId ?? "Anonymous"}</td><td>{row.action}</td><td>{row.outcome}</td><td className="max-w-xs break-words">{row.details}{row.assetId ? ` Asset #${row.assetId}` : ""}</td></tr>)}</tbody></table></div></CardContent></Card>
  </div>;
}
