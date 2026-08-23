"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";

export default function SearchDoctors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/doctors`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          }
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
    fetchDoctors();
  }, []);

  const filteredDoctors = doctors.filter(d => 
    (d.user?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (d.specialization || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Find a Doctor</h1>
        <p className="text-muted-foreground mt-2">Search by name or specialization to book an appointment.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input 
          className="pl-10 h-12 text-lg" 
          placeholder="Search for cardiologists, dermatologists..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading doctors...</div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {filteredDoctors.map(doctor => (
          <Card key={doctor.userId} className="flex flex-col">
            <CardHeader>
              <CardTitle>{doctor.user?.name}</CardTitle>
              <CardDescription>{doctor.specialization}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="text-sm text-muted-foreground">
                Slot Duration: <span className="font-medium text-foreground">{doctor.slotDurationMins} mins</span>
              </div>
            </CardContent>
            <CardFooter>
              <Link href={`/book/${doctor.userId}`} className="w-full">
                <Button className="w-full">Book Appointment</Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
        {filteredDoctors.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            No doctors found matching your search.
          </div>
        )}
      </div>
      )}
    </div>
  );
}
