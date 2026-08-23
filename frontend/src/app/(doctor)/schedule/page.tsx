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
