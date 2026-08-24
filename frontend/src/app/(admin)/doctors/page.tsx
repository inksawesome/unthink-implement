"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Edit, Plus, X } from "lucide-react";

type WorkingHours = Record<string, string[]>;

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [slotDuration, setSlotDuration] = useState(30);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editSpecialization, setEditSpecialization] = useState("");
  const [editSlotDuration, setEditSlotDuration] = useState(30);
  const [editWorkingHours, setEditWorkingHours] = useState<WorkingHours>({});
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
      
      fetchDoctors();
    } catch (err) {
      setError("An unexpected error occurred");
      setCreating(false);
    }
  };

  const openEditModal = (doctor: any) => {
    setEditId(doctor.id);
    setEditName(doctor.user?.name || "");
    setEditSpecialization(doctor.specialization || "");
    setEditSlotDuration(doctor.slotDurationMins || 30);
    setEditWorkingHours(doctor.workingHours || {});
    setEditError("");
    setIsEditModalOpen(true);
  };

  const addShift = (day: string) => {
    const current = editWorkingHours[day] || [];
    let newStart = "09:00";
    let newEnd = "17:00";
    
    if (current.length > 0) {
      const lastShift = current[current.length - 1];
      const [, lastEnd] = lastShift.split("-");
      if (lastEnd && lastEnd < "23:00") {
        newStart = lastEnd;
        let endHour = parseInt(lastEnd.split(":")[0]) + 4;
        if (endHour > 23) endHour = 23;
        newEnd = `${endHour.toString().padStart(2, "0")}:00`;
      } else {
        setEditError(`Cannot add another shift on ${day.toUpperCase()}: previous shift ends too late.`);
        return;
      }
    }
    setEditError("");
    setEditWorkingHours({ ...editWorkingHours, [day]: [...current, `${newStart}-${newEnd}`] });
  };

  const updateShift = (day: string, index: number, start: string, end: string) => {
    const current = [...(editWorkingHours[day] || [])];
    current[index] = `${start}-${end}`;
    setEditWorkingHours({ ...editWorkingHours, [day]: current });
  };

  const removeShift = (day: string, index: number) => {
    const current = [...(editWorkingHours[day] || [])];
    current.splice(index, 1);
    setEditWorkingHours({ ...editWorkingHours, [day]: current });
  };

  const checkOverlaps = (hours: WorkingHours) => {
    for (const [day, shifts] of Object.entries(hours)) {
      if (!shifts || shifts.length === 0) continue;
      
      if (shifts.length > 1) {
        const sorted = [...shifts].sort((a, b) => a.localeCompare(b));
        for (let i = 0; i < sorted.length - 1; i++) {
          const [, end1] = sorted[i].split("-");
          const [start2, ] = sorted[i+1].split("-");
          
          if (end1 > start2) {
            return `Overlapping shifts detected on ${day.toUpperCase()}: ${sorted[i]} and ${sorted[i+1]}`;
          }
        }
      }
      
      for (const shift of shifts) {
        const [start, end] = shift.split("-");
        if (start >= end) {
          return `Invalid shift on ${day.toUpperCase()}: Start time (${start}) must be before end time (${end}).`;
        }
      }
    }
    return null;
  };

  const handleEditDoctor = async () => {
    setEditing(true);
    setEditError("");
    try {
      const validationError = checkOverlaps(editWorkingHours);
      if (validationError) {
        setEditError(validationError);
        setEditing(false);
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors/${editId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          name: editName,
          specialization: editSpecialization,
          slotDurationMins: editSlotDuration,
          workingHours: editWorkingHours
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setEditError(data.error || "Failed to update doctor");
        setEditing(false);
        return;
      }

      setIsEditModalOpen(false);
      setEditing(false);
      fetchDoctors();
    } catch (err) {
      setEditError("An unexpected error occurred");
      setEditing(false);
    }
  };

  const openDeleteModal = (id: string) => {
    setDeleteId(id);
    setDeleteError("");
    setIsDeleteModalOpen(true);
  };

  const handleDeleteDoctor = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors/${deleteId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete doctor");
        setDeleting(false);
        return;
      }

      setIsDeleteModalOpen(false);
      setDeleting(false);
      fetchDoctors();
    } catch (err) {
      setDeleteError("An unexpected error occurred");
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Doctors</h1>
          <p className="text-muted-foreground mt-1">Add, update, or remove doctor profiles.</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger render={<Button />}>Add Doctor</DialogTrigger>
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
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openEditModal(doctor)}>
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => openDeleteModal(doctor.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Doctor Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Doctor Profile</DialogTitle>
            <DialogDescription>Update details and working hours.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
            {editError && (
              <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm font-medium">
                {editError}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input placeholder="Dr. John Doe" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Specialization</Label>
                <Input placeholder="e.g. Neurologist" value={editSpecialization} onChange={e => setEditSpecialization(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Slot Duration (minutes)</Label>
                <Input type="number" value={editSlotDuration} onChange={e => setEditSlotDuration(parseInt(e.target.value) || 30)} />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">Working Hours</Label>
              <div className="space-y-3">
                {DAYS.map(day => (
                  <div key={day.key} className="border p-3 rounded-md bg-muted/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm">{day.label}</span>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addShift(day.key)}>
                        <Plus className="w-3 h-3 mr-1" /> Add Shift
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(editWorkingHours[day.key] || []).map((interval, index) => {
                        const [start, end] = interval.split("-");
                        return (
                          <div key={index} className="flex items-center space-x-3">
                            <Input 
                              type="time" 
                              className="w-32 h-8 text-sm" 
                              value={start} 
                              onChange={(e) => updateShift(day.key, index, e.target.value, end)} 
                            />
                            <span className="text-sm text-muted-foreground">to</span>
                            <Input 
                              type="time" 
                              className="w-32 h-8 text-sm" 
                              value={end} 
                              onChange={(e) => updateShift(day.key, index, start, e.target.value)} 
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeShift(day.key, index)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                      {(!editWorkingHours[day.key] || editWorkingHours[day.key].length === 0) && (
                        <p className="text-xs text-muted-foreground italic">Off</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleEditDoctor} disabled={editing || !editName || !editSpecialization}>
              {editing ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Doctor</DialogTitle>
            <DialogDescription>Are you sure you want to remove this doctor profile?</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {deleteError && (
              <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm font-medium">
                {deleteError}
              </div>
            )}
            {!deleteError && (
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. Doctors with existing appointments cannot be deleted to preserve medical history.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteDoctor} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Doctor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
