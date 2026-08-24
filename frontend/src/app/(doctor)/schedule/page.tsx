"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function DoctorSchedule() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/appointments/doctor`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setAppointments(data.appointments || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, []);

  const filteredAppointments = appointments.filter((apt) => {
    if (!date) return true;
    return format(new Date(apt.startTime), "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
  });

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground mt-1">Select a date to view your appointments.</p>
        </div>
        <Card>
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md"
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Integrations</CardTitle>
            <CardDescription>Sync your appointments</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full flex items-center gap-2" 
              variant="outline"
              onClick={async () => {
                try {
                  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/google/url`, {
                    headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
                  });
                  if (res.ok) {
                    const data = await res.json();
                    window.location.href = data.url;
                  } else {
                    alert("Failed to get Google Auth URL");
                  }
                } catch (err) {
                  alert("Error initiating calendar sync");
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-days"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
              Sync Google Calendar
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-semibold">
            {date ? format(date, "EEEE, MMMM do, yyyy") : "All Appointments"}
          </h2>
          <Badge variant="outline" className="text-sm">
            {filteredAppointments.length} Appointments
          </Badge>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 border rounded-lg border-dashed">
              No appointments scheduled for this date.
            </div>
          ) : (
            filteredAppointments.map((apt) => (
              <Card key={apt.id} className={apt.status === "COMPLETED" ? "opacity-75" : ""}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-mono font-semibold w-20">
                      {format(new Date(apt.startTime), "h:mm a")}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{apt.patient?.name}</CardTitle>
                      <CardDescription>
                        Status: <span className="font-medium">{apt.status}</span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link href={`/appointments/${apt.id}`}>
                      <Button variant={apt.status === "COMPLETED" ? "outline" : "default"}>
                        {apt.status === "COMPLETED" ? "View Details" : "Start Visit"}
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
