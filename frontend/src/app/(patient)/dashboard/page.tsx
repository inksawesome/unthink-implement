"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/appointments`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setAppointments(data.appointments);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, []);

  const upcoming = appointments.filter(a => a.status === "BOOKED" || a.status === "PENDING");
  const past = appointments.filter(a => a.status === "COMPLETED" || a.status === "CANCELLED");

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Dashboard</h1>
        <p className="text-muted-foreground mt-2">Manage your upcoming appointments and view past visit summaries.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading appointments...</div>
      ) : (
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming">Upcoming Visits</TabsTrigger>
          <TabsTrigger value="past">Past Visits</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upcoming" className="mt-6 space-y-4">
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No upcoming appointments.
              </CardContent>
            </Card>
          ) : (
            upcoming.map(apt => (
              <Card key={apt.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle>{apt.doctor?.user?.name || 'Unknown Doctor'}</CardTitle>
                    <CardDescription>{apt.doctor?.specialization}</CardDescription>
                  </div>
                  <Badge variant={apt.status === "BOOKED" ? "default" : "secondary"}>
                    {apt.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium">
                    {format(new Date(apt.startTime), "EEEE, MMMM do, yyyy 'at' h:mm a")}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        
        <TabsContent value="past" className="mt-6 space-y-4">
          {past.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No past appointments.
              </CardContent>
            </Card>
          ) : (
            past.map(apt => (
              <Card key={apt.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle>{apt.doctor?.user?.name || 'Unknown Doctor'}</CardTitle>
                    <CardDescription>{format(new Date(apt.startTime), "MMMM do, yyyy")}</CardDescription>
                  </div>
                  <Badge variant={apt.status === "COMPLETED" ? "outline" : "destructive"}>
                    {apt.status}
                  </Badge>
                </CardHeader>
                {apt.postVisitSummaryPatient && (
                  <CardContent>
                    <div className="mt-2 text-sm bg-muted p-4 rounded-md">
                      <p className="font-semibold mb-2">Visit Summary & Instructions:</p>
                      <p className="text-muted-foreground leading-relaxed">
                        {apt.postVisitSummaryPatient}
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
