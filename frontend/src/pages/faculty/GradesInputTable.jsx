import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export function GradesInputTable({ students, loading, onGradeChange }) {

  // Function to get remarks based on transmutation (only for numeric grades on a 5-point scale)
  const getRemarksFromTransmutation = (transmutation) => {
    if (transmutation === null || transmutation === "") return null;
    
    const numTransmutation = parseFloat(transmutation);

    if (isNaN(numTransmutation)) {
        const lowerTransmutation = String(transmutation).toLowerCase();
        if (lowerTransmutation === 'inc') return 'Incomplete';
        if (lowerTransmutation === 'ud') return 'Unofficially Dropped';
        if (lowerTransmutation === 'od') return 'Officially Dropped';
        return null; // Unknown text
    }

    if (numTransmutation >= 1.00 && numTransmutation <= 3.00) return "Passed";
    if (numTransmutation >= 3.25 && numTransmutation <= 5.00) return "Failed";
    return null; 
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading students...</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-3 py-2">Student ID</TableHead>
            <TableHead className="min-w-[200px] px-3 py-2">Name</TableHead>
            <TableHead className="w-[100px] px-3 py-2">Section</TableHead>
            <TableHead className="px-3 py-2">Course Code</TableHead>
            <TableHead className="w-[120px] text-center px-3 py-2">Final Grade</TableHead>
            <TableHead className="w-[150px] px-3 py-2">Remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.length > 0 ? (
            students.map((student) => {
              const transmutationInput = student.transmutation || ""; // Value from state/prop
              const remarks = getRemarksFromTransmutation(transmutationInput);

              return (
                <TableRow key={student.student_id}>
                  <TableCell className="font-medium px-3 py-2">{student.student_id}</TableCell>
                  <TableCell className="px-3 py-2">{student.name}</TableCell>
                  <TableCell className="px-3 py-2">{student.section || "N/A"}</TableCell>
                  <TableCell className="px-3 py-2">{student.course_code || "N/A"}</TableCell>
                  <TableCell className="px-3 py-2">
                    <Input
                      type="text"
                      inputMode="text"
                      value={transmutationInput}
                      onChange={(e) => onGradeChange(student.student_id, "transmutation", e.target.value)}
                      className="w-full text-center h-8"
                      placeholder="1.00 - 5.00, INC, UD, OD"
                      maxLength={4}
                    />
                  </TableCell>
                  <TableCell className={`px-3 py-2 ${
                    remarks === "Failed" || remarks === "Unofficially Dropped" || remarks === "Officially Dropped" ? "text-red-500" : ""
                  }`}>
                    {remarks !== null ? remarks : "-"}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No students found for this section.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}