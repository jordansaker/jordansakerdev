import { requireAuth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logoutAction } from "../login/actions";
import { toggleGstAction } from "./actions";
import { MobileShell } from "./mobile-shell";
import { Sidebar } from "./sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  const s = await getSettings();
  return (
    <MobileShell
      sidebar={
        <Sidebar
          gstRegistered={s.gstRegistered}
          toggleGstAction={toggleGstAction}
          logoutAction={logoutAction}
        />
      }
    >
      {children}
    </MobileShell>
  );
}
