"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Clock, Loader2 } from "lucide-react";

export default function BookAppointment({ params }: { params: Promise<{ doctorId: string }> }) {
  const { doctorId } = use(params);
  const router = useRouter();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState("");

  // Fetch slots whenever date changes
  useEffect(() => {
    if (!date) return;
    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const dateStr = format(date, "yyyy-MM-dd");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/doctors/${doctorId}/slots?date=${dateStr}`, {
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
  }, [date, doctorId]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isModalOpen && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isModalOpen) {
      setIsModalOpen(false);
      setSelectedSlot(null);
      setHoldToken(null);
      alert("Your 10-minute slot hold has expired. Please select a slot again.");
    }
    return () => clearInterval(timer);
  }, [isModalOpen, timeLeft]);

  const handleSelectSlot = async (slotTimeStr: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/appointments/hold`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ doctorId, startTime: slotTimeStr })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to hold slot");
        return;
      }
      setHoldToken(data.holdToken);
      setSelectedSlot(slotTimeStr);
      setTimeLeft(600);
      setIsModalOpen(true);
    } catch (err) {
      alert("An error occurred holding the slot.");
    }
  };

  const handleCancelHold = async () => {
    setIsModalOpen(false);
    if (selectedSlot && holdToken) {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/appointments/hold`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ doctorId, startTime: selectedSlot, holdToken })
      });
    }
    setSelectedSlot(null);
    setHoldToken(null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleConfirmBooking = async () => {
    setIsBooking(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/appointments/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ doctorId, startTime: selectedSlot, holdToken, symptomsRaw: symptoms })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to book appointment");
        setIsBooking(false);
        return;
      }
      setIsBooking(false);
      setIsModalOpen(false);
      router.push("/dashboard");
    } catch (err) {
      setError("An unexpected error occurred");
      setIsBooking(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Book Appointment</h1>
        <p className="text-muted-foreground mt-2">Select a date and time for your visit.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
              disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available Slots</CardTitle>
            <CardDescription>
              {date ? format(date, "EEEE, MMMM do, yyyy") : "Please select a date"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!date ? (
              <div className="text-center text-muted-foreground py-8">
                Select a date to view available time slots.
              </div>
            ) : loadingSlots ? (
              <div className="flex justify-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No slots available on this date.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {availableSlots.map((slotTimeStr) => (
                  <Button 
                    key={slotTimeStr} 
                    variant={selectedSlot === slotTimeStr ? "default" : "outline"}
                    onClick={() => handleSelectSlot(slotTimeStr)}
                  >
                    {format(new Date(slotTimeStr), "h:mm a")}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        if (!open) {
          handleCancelHold();
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Confirm Appointment</DialogTitle>
            <DialogDescription>
              Please provide your symptoms. Your selected slot is held for a limited time.
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-muted p-4 rounded-lg flex items-center justify-between mb-4 border border-border">
            <div className="text-sm font-medium">
              {selectedSlot && format(new Date(selectedSlot), "MMM do, yyyy 'at' h:mm a")}
            </div>
            <div className={`flex items-center gap-2 font-mono text-lg font-bold ${timeLeft < 120 ? 'text-red-500' : 'text-primary'}`}>
              <Clock className="w-5 h-5" />
              {formatTime(timeLeft)}
            </div>
          </div>

          <div className="space-y-4 py-2">
            {error && (
              <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm font-medium">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="symptoms">Symptoms (Required)</Label>
              <Textarea 
                id="symptoms" 
                placeholder="Please describe your chief complaint, duration, and any other relevant details. This helps the AI prepare a summary for the doctor." 
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelHold} disabled={isBooking}>Cancel</Button>
            <Button onClick={handleConfirmBooking} disabled={!symptoms.trim() || isBooking}>
              {isBooking ? "Confirming..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
