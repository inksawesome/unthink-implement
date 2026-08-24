"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Reschedule state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(new Date());
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  const fetchAppointments = async () => {
    setLoading(true);
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

  useEffect(() => {
    fetchAppointments();
  }, []);

  useEffect(() => {
    if (!rescheduleModalOpen || !selectedAppt || !rescheduleDate) return;
    
    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const dateStr = format(rescheduleDate, "yyyy-MM-dd");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/doctors/${selectedAppt.doctor.userId}/slots?date=${dateStr}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableSlots(data.slots || []);
        } else {
          setAvailableSlots([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [rescheduleDate, rescheduleModalOpen, selectedAppt]);

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/appointments/${id}/cancel`, {
        method: 'DELETE',
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (res.ok) {
        alert("Appointment cancelled successfully");
        fetchAppointments();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to cancel");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReschedule = async (newStartTime: string) => {
    if (!selectedAppt) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/appointments/${selectedAppt.id}/reschedule`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ newStartTime })
      });
      if (res.ok) {
        alert("Appointment rescheduled successfully");
        setRescheduleModalOpen(false);
        fetchAppointments();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to reschedule");
      }
    } catch (err) {
      console.error(err);
    }
  };

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
                <CardFooter className="flex justify-end gap-2 pt-2 pb-4">
                  <Button variant="outline" onClick={() => {
                    setSelectedAppt(apt);
                    setRescheduleDate(new Date(apt.startTime));
                    setRescheduleModalOpen(true);
                  }}>
                    Reschedule
                  </Button>
                  <Button variant="destructive" onClick={() => handleCancel(apt.id)}>
                    Cancel
                  </Button>
                </CardFooter>
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

      <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              Select a new date and time for your appointment with {selectedAppt?.doctor?.user?.name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="flex justify-center border rounded-md p-2">
              <Calendar
                mode="single"
                selected={rescheduleDate}
                onSelect={setRescheduleDate}
                className="rounded-md"
              />
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Available Slots</h4>
              {loadingSlots ? (
                <div className="text-sm text-muted-foreground">Loading slots...</div>
              ) : availableSlots.length === 0 ? (
                <div className="text-sm text-muted-foreground">No slots available on this date.</div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-2">
                  {availableSlots.map(slot => (
                    <Button 
                      key={slot} 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleReschedule(slot)}
                    >
                      {format(new Date(slot), "h:mm a")}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
