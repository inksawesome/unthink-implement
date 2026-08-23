import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background text-foreground">
      <div className="z-10 w-full max-w-5xl items-center justify-center font-mono text-sm flex flex-col space-y-8">
        <h1 className="text-4xl font-bold">Healthcare Appointment Manager</h1>
        <p className="text-lg text-muted-foreground text-center max-w-2xl">
          A platform bridging the communication gap between patients and doctors with AI-powered pre-visit and post-visit summaries.
        </p>
        
        <div className="flex gap-4 mt-8">
          <Link href="/login">
            <Button size="lg" className="w-32">Login</Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline" className="w-32">Register</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
