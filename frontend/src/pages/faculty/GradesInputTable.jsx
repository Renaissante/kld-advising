import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export function GradesInputTable({ students, loading, onGradeChange }) {
  // Function to calculate transmuted grade based on average
  const calculateTransmutation = (average) => {
    if (!average || average === "") return "-";
    
    const numAverage = parseFloat(average);
    
    if (isNaN(numAverage)) return "-";
    
    // Transmutation scale (adjust according to your grading system)
    if (numAverage >= 97) return "1.00";
    if (numAverage >= 94) return "1.25";
    if (numAverage >= 91) return "1.50";
    if (numAverage >= 88) return "1.75";
    if (numAverage >= 85) return "2.00";
    if (numAverage >= 82) return "2.25";
    if (numAverage >= 79) return "2.50";
    if (numAverage >= 76) return "2.75";
    if (numAverage >= 70) return "3.00";
    if (numAverage >= 65) return "5.00";
    return "5.00"; // Failing grade
  };
  
  // Function to get remarks based on transmutation
  const getDefaultRemarks = (transmutation) => {
    if (transmutation === "-") return "-";
    if (transmutation === "5.00") return "Failed";
    return "Passed";
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
            <TableHead className="w-[120px] px-3 py-2">Student ID</TableHead>
            <TableHead className="min-w-[150px] px-3 py-2">Name</TableHead>
            <TableHead className="w-[100px] px-3 py-2">Section</TableHead>
            <TableHead className="w-[120px] px-3 py-2">Course Code</TableHead>
            <TableHead className="w-[100px] text-center px-3 py-2">Midterm</TableHead>
            <TableHead className="w-[100px] text-center px-3 py-2">Final</TableHead>
            <TableHead className="w-[100px] text-center px-3 py-2">Average</TableHead>
            <TableHead className="w-[100px] text-center px-3 py-2">Transmutation</TableHead>
            <TableHead className="w-[150px] px-3 py-2">Remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.length > 0 ? (
            students.map((student) => {
              const transmutedGrade = calculateTransmutation(student.average);
              const remarks = getDefaultRemarks(transmutedGrade);
              
              return (
                <TableRow key={student.student_id}>
                  <TableCell className="font-medium px-3 py-2">{student.student_id}</TableCell>
                  <TableCell className="px-3 py-2">{student.name}</TableCell>
                  <TableCell className="px-3 py-2">{student.section || "N/A"}</TableCell>
                  <TableCell className="px-3 py-2">{student.course_code || "N/A"}</TableCell>
                  <TableCell className="px-3 py-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={student.midterm}
                      onChange={(e) => onGradeChange(student.student_id, "midterm", e.target.value)}
                      className="w-full text-center h-8"
                      placeholder="0-100"
                      maxLength={5}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={student.final}
                      onChange={(e) => onGradeChange(student.student_id, "final", e.target.value)}
                      className="w-full text-center h-8"
                      placeholder="0-100"
                      maxLength={5}
                    />
                  </TableCell>
                  <TableCell className="text-center font-medium px-3 py-2">
                    {student.average || "-"}
                  </TableCell>
                  <TableCell className={`text-center font-medium px-3 py-2 ${
                    transmutedGrade === "5.00" ? "text-red-500" : 
                    transmutedGrade !== "-" ? "text-green-600" : ""
                  }`}>
                    {transmutedGrade}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    {remarks}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No students found for this section.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
