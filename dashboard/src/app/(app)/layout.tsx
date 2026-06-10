import { requireAuth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logoutAction } from "../login/actions";
import { toggleGstAction } from "./actions";
import { Sidebar } from "./sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  const s = await getSettings();
  return (
    <div className="grid grid-cols-[230px_1fr] min-h-screen">
      <Sidebar
        gstRegistered={s.gstRegistered}
        toggleGstAction={toggleGstAction}
        logoutAction={logoutAction}
      />
      <main className="px-10 pt-8 pb-16 min-w-0 max-w-[1180px]">{children}</main>
    </div>
  );
}
