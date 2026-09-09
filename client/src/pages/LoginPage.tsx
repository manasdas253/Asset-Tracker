import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";

export default function LoginPage() {
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f6f8] p-5"><section className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_16px_48px_rgba(26,67,85,0.10)]"><img src="/iims-logo-white.png" alt="IIMS" className="mx-auto h-14 rounded-xl bg-[#111418] p-2" /><p className="mt-7 text-xs font-black uppercase tracking-[0.16em] text-[#c5161d]">AssetTrack workspace</p><h1 className="mt-3 text-2xl font-black text-slate-900">Sign in to continue</h1><p className="mt-3 text-sm leading-6 text-slate-500">Use the Google account authorized for your asset-management workspace.</p><Button className="mt-7 h-11 w-full rounded-xl bg-[#151a20] text-white hover:bg-[#7f0d12]" onClick={startLogin}>Continue with Google</Button></section></main>;
}
