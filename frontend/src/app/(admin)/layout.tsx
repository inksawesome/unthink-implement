"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    router.push("/");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="font-bold text-xl text-primary">Admin Portal</div>
        <nav className="flex items-center gap-6">
          <Link href="/doctors" className={`text-sm font-medium ${pathname === '/doctors' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
            Manage Doctors
          </Link>
          <Link href="/leaves" className={`text-sm font-medium ${pathname === '/leaves' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
            Leave Management
          </Link>
          <Button variant="ghost" onClick={handleLogout}>Logout</Button>
        </nav>
      </header>
      <main className="flex-1 p-6 md:p-12">
        {children}
      </main>
    </div>
  );
}
