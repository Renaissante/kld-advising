import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export function GradesInputTable({ students, loading, onGradeChange }) {
  // Function to calculate transmuted grade based on average
  const calculateTransmutation = (average) => {
    // This function is now only used for numeric averages.
    if (average === null || average === "" || isNaN(parseFloat(average))) return null;

    const numAverage = parseFloat(average);

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

  // Function to get remarks based on transmutation (only for numeric grades)
  const getDefaultRemarks = (transmutation) => {
    // This function is now only used for numeric transmutations.
    if (transmutation === null || transmutation === "") return null;
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
              // Calculate average, transmutation, and remarks dynamically based on input values and statuses
              const midtermNumeric = student.midterm; // Can be number or null
              const finalNumeric = student.final;   // Can be number or null
              const midtermStatus = student.midterm_status; // Can be 'UD', 'OD', or null
              const finalStatus = student.final_status;   // Can be 'UD', 'OD', or null

              let calculatedAverage = null;
              let transmutedGrade = null;
              let remarks = null;

              if (midtermStatus === 'UD' || midtermStatus === 'OD') {
                  // If midterm status is set, the student dropped
                  calculatedAverage = "0.00";
                  transmutedGrade = "0.00";
                  remarks = midtermStatus === 'UD' ? "Unofficially Dropped" : "Officially Dropped";
              } else {
                  // No midterm status, calculate based on numeric grades if available
                  const isMidtermNumericValid = midtermNumeric !== null && !isNaN(midtermNumeric) && midtermNumeric >= 0 && midtermNumeric <= 100;
                  const isFinalNumericValid = finalNumeric !== null && !isNaN(finalNumeric) && finalNumeric >= 0 && finalNumeric <= 100;

                  if (isMidtermNumericValid && isFinalNumericValid) {
                      // Both are valid numbers (0-100)
                      calculatedAverage = ((midtermNumeric + finalNumeric) / 2).toFixed(2);
                      transmutedGrade = calculateTransmutation(calculatedAverage);
                      remarks = getDefaultRemarks(transmutedGrade);
                  }
                  // If not both numeric valid, average, transmutation, and remarks remain null
              }


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
                      // Display status if available, otherwise display numeric grade (or empty string if null)
                      value={midtermStatus || (midtermNumeric !== null ? String(midtermNumeric) : '')}
                      onChange={(e) => onGradeChange(student.student_id, "midterm", e.target.value)}
                      className="w-full text-center h-8"
                      placeholder="0-100, UD, OD"
                      maxLength={5}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Input
                      type="text"
                      inputMode="text"
                       // Display status if available, otherwise display numeric grade (or empty string if null)
                      value={finalStatus || (finalNumeric !== null ? String(finalNumeric) : '')}
                      onChange={(e) => onGradeChange(student.student_id, "final", e.target.value)}
                      className="w-full text-center h-8"
                      placeholder="0-100, UD, OD"
                      maxLength={5}
                    />
                  </TableCell>
                  <TableCell className="text-center font-medium px-3 py-2">
                    {/* Display calculated average or "-" */}
                    {calculatedAverage !== null ? calculatedAverage : "-"}
                  </TableCell>
                  <TableCell className={`text-center font-medium px-3 py-2 ${
                    // Apply red color for failing numeric grade (5.00) or dropped status (0.00)
                    transmutedGrade === "5.00" || transmutedGrade === "0.00" ? "text-red-500" :
                    // Apply green color for passing numeric grade
                    (transmutedGrade !== null && transmutedGrade !== "5.00") ? "text-green-600" : ""
                  }`}>
                    {/* Display calculated transmutation or "-" */}
                    {transmutedGrade !== null ? transmutedGrade : "-"}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    {/* Display calculated remarks or "-" */}
                    {remarks !== null ? remarks : "-"}
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