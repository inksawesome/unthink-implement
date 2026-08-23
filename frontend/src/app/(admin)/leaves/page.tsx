"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function AdminLeaves() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [doctorId, setDoctorId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [doctors, setDoctors] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/doctors`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
          const data = await res.json();
          setDoctors(data.doctors || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchDoctors();
  }, []);

  const handleMarkLeave = async () => {
    if (!date || !doctorId) return;
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const leaveDateStr = format(date, "yyyy-MM-dd");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/leaves`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ doctorId, leaveDate: leaveDateStr })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to mark leave");
      } else {
        setMessage(`Leave marked successfully. ${data.cancelledCount} appointments were cancelled and patients notified.`);
        setDoctorId("");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDoctor = doctors.find(d => d.userId === doctorId);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave Management</h1>
        <p className="text-muted-foreground mt-1">Mark a doctor on leave to automatically cancel their appointments and notify patients.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
            <CardDescription>Choose the date the doctor will be unavailable.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mark Leave</CardTitle>
            <CardDescription>Select the doctor to mark on leave.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {message && (
              <div className="bg-green-500/15 text-green-600 p-3 rounded-md text-sm font-medium">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm font-medium">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Doctor</Label>
              <Select value={doctorId} onValueChange={(val) => setDoctorId(val || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map(d => (
                    <SelectItem key={d.userId} value={d.userId}>{d.user?.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {date && selectedDoctor && (
              <div className="bg-destructive/10 p-4 rounded-md border border-destructive/20 text-sm">
                <p className="font-semibold text-destructive">Warning</p>
                <p className="text-muted-foreground mt-1">
                  Marking {selectedDoctor.user?.name} on leave for {format(date, "MMM do, yyyy")} will automatically cancel all their existing bookings for this day. This action cannot be undone.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              variant="destructive" 
              className="w-full" 
              disabled={!date || !doctorId || isSubmitting}
              onClick={handleMarkLeave}
            >
              {isSubmitting ? "Processing..." : "Confirm Leave & Cancel Appointments"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
