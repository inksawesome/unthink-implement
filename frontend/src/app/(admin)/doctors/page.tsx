"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [slotDuration, setSlotDuration] = useState(30);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleCreateDoctor = async () => {
    setCreating(true);
    setError("");
    try {
      // Default working hours for a new doctor (mon-fri 9-5)
      const workingHours = {
        mon: ["09:00-17:00"],
        tue: ["09:00-17:00"],
        wed: ["09:00-17:00"],
        thu: ["09:00-17:00"],
        fri: ["09:00-17:00"]
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          name,
          email,
          password,
          specialization,
          slotDurationMins: slotDuration,
          workingHours
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create doctor");
        setCreating(false);
        return;
      }

      setIsModalOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setSpecialization("");
      setSlotDuration(30);
      setCreating(false);
      
      // Refresh list
      fetchDoctors();
    } catch (err) {
      setError("An unexpected error occurred");
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Doctors</h1>
          <p className="text-muted-foreground mt-1">Add or update doctor profiles and working hours.</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger render={<Button />}>
            Add Doctor
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Doctor</DialogTitle>
              <DialogDescription>Create a profile and credentials for a new doctor.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {error && (
                <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm font-medium">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label>Name</Label>
                <Input placeholder="Dr. John Doe" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input placeholder="doctor@clinic.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input placeholder="Min 8 characters" type="password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Specialization</Label>
                <Input placeholder="e.g. Neurologist" value={specialization} onChange={e => setSpecialization(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Slot Duration (minutes)</Label>
                <Input type="number" value={slotDuration} onChange={e => setSlotDuration(parseInt(e.target.value) || 30)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateDoctor} disabled={creating || !name || !email || !password || !specialization}>
                {creating ? "Creating..." : "Create Doctor"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Specialization</TableHead>
              <TableHead>Slot Duration</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : doctors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No doctors found.
                </TableCell>
              </TableRow>
            ) : doctors.map((doctor) => (
              <TableRow key={doctor.id}>
                <TableCell className="font-medium">{doctor.user?.name}</TableCell>
                <TableCell>{doctor.user?.email}</TableCell>
                <TableCell>{doctor.specialization}</TableCell>
                <TableCell>{doctor.slotDurationMins} mins</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">Edit Hours</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
