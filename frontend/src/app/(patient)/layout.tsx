"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
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
        <div className="font-bold text-xl">Patient Portal</div>
        <nav className="flex items-center gap-6">
          <Link href="/dashboard" className={`text-sm font-medium ${pathname === '/dashboard' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
            Dashboard
          </Link>
          <Link href="/search" className={`text-sm font-medium ${pathname === '/search' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
            Find a Doctor
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
