"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { format, addDays } from "date-fns";

export default function AppointmentDetails({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = params.id;
  const [apt, setApt] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [notes, setNotes] = useState("");
  const [prescriptions, setPrescriptions] = useState<{medicationName: string, frequency: string, durationDays: number}[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchApt = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/appointments/${id}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setApt(data.appointment);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchApt();
  }, [id]);

  const addPrescription = () => {
    setPrescriptions([...prescriptions, { medicationName: "", frequency: "DAILY", durationDays: 7 }]);
  };

  const updatePrescription = (index: number, field: string, value: string | number) => {
    const updated = [...prescriptions];
    updated[index] = { ...updated[index], [field]: value };
    setPrescriptions(updated);
  };

  const removePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      // 1. Submit notes
      const resNotes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/appointments/${id}/post-visit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ notes })
      });
      if (!resNotes.ok) {
        const data = await resNotes.json();
        throw new Error(data.error || "Failed to submit notes");
      }

      // 2. Submit prescriptions one by one
      for (const p of prescriptions) {
        if (!p.medicationName.trim()) continue;
        const startDate = format(new Date(), "yyyy-MM-dd");
        const endDate = format(addDays(new Date(), p.durationDays), "yyyy-MM-dd");
        
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/appointments/${id}/prescriptions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            medicationName: p.medicationName,
            frequency: p.frequency,
            startDate,
            endDate
          })
        });
      }

      setSubmitting(false);
      router.push("/schedule");
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!apt) {
    return <div className="text-center py-12">Appointment not found.</div>;
  }

  // Safely parse preVisitSummary if it's a JSON string, or just use it if it's an object
  let preVisitSummary = { urgency: "Unknown", complaint: "No summary generated", questions: [] };
  try {
    if (apt.preVisitSummaryRaw) {
      preVisitSummary = JSON.parse(apt.preVisitSummaryRaw);
    }
  } catch (e) {
    console.error("Failed to parse preVisitSummaryRaw");
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/schedule">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appointment with {apt.patient?.name}</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(apt.startTime), "MMMM do, yyyy")} • {format(new Date(apt.startTime), "h:mm a")}
          </p>
        </div>
        <div className="ml-auto">
          <Badge className="text-sm px-4 py-1" variant={apt.status === "BOOKED" ? "default" : "secondary"}>
            {apt.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <Card className="border-primary/50 shadow-sm shadow-primary/10">
            <CardHeader className="bg-primary/5 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  ✨ AI Pre-Visit Summary
                </CardTitle>
                <Badge variant={preVisitSummary.urgency === "High" ? "destructive" : preVisitSummary.urgency === "Medium" ? "default" : "secondary"}>
                  {preVisitSummary.urgency} Urgency
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-2">Chief Complaint</h3>
                <p className="font-medium text-lg">{preVisitSummary.complaint}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-2">Suggested Questions</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {preVisitSummary.questions.map((q: string, i: number) => (
                    <li key={i} className="text-muted-foreground">{q}</li>
                  ))}
                  {preVisitSummary.questions.length === 0 && <li className="text-muted-foreground">None generated</li>}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Raw Patient Input</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic bg-muted p-4 rounded-md">
                "{apt.symptomsRaw}"
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Post-Visit Notes</CardTitle>
              <CardDescription>
                These notes will be processed by AI to generate a patient-friendly summary.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && <div className="text-red-500 mb-4">{error}</div>}
              <Textarea 
                placeholder="Enter clinical notes, diagnosis, and treatment plan..." 
                className="min-h-[200px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={apt.status === "COMPLETED"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Prescriptions</CardTitle>
                <CardDescription>Add medications for the patient.</CardDescription>
              </div>
              {apt.status !== "COMPLETED" && (
                <Button variant="outline" size="sm" onClick={addPrescription}>
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {prescriptions.length === 0 && (!apt.prescriptions || apt.prescriptions.length === 0) ? (
                <div className="text-sm text-muted-foreground text-center py-4">No prescriptions added.</div>
              ) : (
                <>
                  {/* Show already saved prescriptions */}
                  {apt.prescriptions?.map((p: any) => (
                    <div key={p.id} className="flex items-start gap-4 p-4 border rounded-lg bg-muted/20">
                      <div className="flex-1 space-y-1">
                        <div className="font-semibold">{p.medicationName}</div>
                        <div className="text-sm text-muted-foreground">{p.frequency}</div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Show new prescriptions being added */}
                  {prescriptions.map((p, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 border rounded-lg bg-muted/50">
                      <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                          <Label>Medication Name</Label>
                          <Input value={p.medicationName} onChange={(e) => updatePrescription(index, "medicationName", e.target.value)} placeholder="e.g. Amoxicillin 500mg" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Frequency</Label>
                            <Select value={p.frequency} onValueChange={(val) => updatePrescription(index, "frequency", val || "")}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DAILY">Daily</SelectItem>
                                <SelectItem value="TWICE_DAILY">Twice Daily</SelectItem>
                                <SelectItem value="WEEKLY">Weekly</SelectItem>
                                <SelectItem value="AS_NEEDED">As Needed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Duration (Days)</Label>
                            <Input type="number" value={p.durationDays} onChange={(e) => updatePrescription(index, "durationDays", parseInt(e.target.value) || 0)} placeholder="e.g. 7" />
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive mt-8" onClick={() => removePrescription(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
            {apt.status !== "COMPLETED" && (
              <CardFooter className="bg-muted/30 pt-6">
                <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting || !notes.trim()}>
                  {submitting ? "Submitting..." : "Complete Visit & Generate Summary"}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
