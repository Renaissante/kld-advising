"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { CheckCircle2, AlertCircle, Info, Plus, FileCheck, X } from "lucide-react"

// REMOVED: Direct import of sample data
// import { previousGradesData, eligibleCoursesData } from "@/lib/sample-data";

// Added previousGradesData and eligibleCoursesData back to props
export default function AdvisingModal({
  isOpen,
  onClose,
  student,
  previousGradesData = [], // Default to empty array if prop not passed
  eligibleCoursesData = [], // Default to empty array if prop not passed
}) {
  const [selectedTab, setSelectedTab] = useState("eligible")
  const [selectedCourses, setSelectedCourses] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset state when modal opens with a new student or closes
  useEffect(() => {
    if (isOpen) {
      setSelectedCourses([]) // Clear selections when modal opens
      setSelectedTab("eligible") // Reset to eligible tab
    }
  }, [isOpen, student]) // Dependency array includes student to reset if student changes while modal is open (less common)

  // Return null if no student data is available yet
  if (!student) return null

  // Use the props directly
  const studentPreviousGrades = previousGradesData
  const studentEligibleCourses = eligibleCoursesData

  // Handler to add/remove a course from the selection
  const handleSelectCourse = (courseId) => {
    setSelectedCourses((prev) => {
      if (prev.includes(courseId)) {
        // If already selected, remove it
        return prev.filter((id) => id !== courseId)
      } else {
        // If not selected, add it
        return [...prev, courseId]
      }
    })
  }

  // Handler for submitting the advising form
  const handleSubmitAdvising = () => {
    if (selectedCourses.length === 0) {
      toast.error("Please select at least one course to recommend.")
      return
    }

    setIsSubmitting(true)
    console.log("Submitting advising for:", student.id, "Courses:", selectedCourses)
    // Simulate API call
    setTimeout(() => {
      toast.success(`Advising completed for ${student.name}`, {
        description: `${selectedCourses.length} course${selectedCourses.length !== 1 ? 's' : ''} recommended.`,
        icon: <CheckCircle2 className="h-4 w-4" />,
      })
      setIsSubmitting(false)
      onClose() // Close the modal on successful submission
    }, 1000)
  }

  // Calculate total units for selected courses
  const totalSelectedUnits = studentEligibleCourses
    .filter((c) => selectedCourses.includes(c.id))
    .reduce((acc, curr) => acc + curr.units, 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Increased max-width */}
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Academic Advising: {student.name}</DialogTitle>
          <DialogDescription>
            Student ID: {student.id} • GPA: {student.gpa} • Status: {student.status}
          </DialogDescription>
        </DialogHeader>

        {/* Main content area with two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4 max-h-[70vh] overflow-y-auto pr-2"> {/* Added scroll */}
          {/* Previous Semester Grades Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <Info className="h-4 w-4 mr-2 text-muted-foreground" />
                Current Semester Grades
              </CardTitle>
              <CardDescription>Academic performance this semester</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      <TableHead className="text-center">Units</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentPreviousGrades.length > 0 ? (
                      studentPreviousGrades.map((grade) => (
                        <TableRow key={grade.courseCode}>
                          <TableCell className="font-medium">{grade.courseCode}</TableCell>
                          <TableCell>{grade.courseTitle}</TableCell>
                          <TableCell className="text-center">
                            {/* Grade Badge Logic - Adjust thresholds as needed */}
                            <Badge
                              variant={
                                parseFloat(grade.grade) <= 2.0 // Example: Good
                                  ? "default"
                                  : parseFloat(grade.grade) < 3.0 // Example: Okay
                                  ? "secondary"
                                  : "destructive" // Example: Needs attention/Failed
                              }
                            >
                              {grade.grade}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{grade.units}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          No previous grades found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Eligible Courses Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2 text-muted-foreground" />
                Eligible Courses for Next Semester
              </CardTitle>
              <CardDescription>Select courses to recommend for enrollment</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Tabs for Eligible vs Selected */}
              <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="eligible">Available Courses</TabsTrigger>
                  <TabsTrigger value="selected">Selected ({selectedCourses.length})</TabsTrigger>
                </TabsList>

                {/* Tab Content: Eligible Courses */}
                <TabsContent value="eligible">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead className="text-center">Units</TableHead>
                          <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentEligibleCourses.length > 0 ? (
                          studentEligibleCourses.map((course) => (
                            <TableRow key={course.id}>
                              <TableCell className="font-medium">{course.code}</TableCell>
                              <TableCell>{course.title}</TableCell>
                              <TableCell className="text-center">{course.units}</TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant={selectedCourses.includes(course.id) ? "secondary" : "outline"} // Use secondary for selected?
                                  size="sm"
                                  onClick={() => handleSelectCourse(course.id)}
                                  disabled={selectedCourses.includes(course.id)} // Disable if already selected
                                >
                                  {selectedCourses.includes(course.id) ? (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                      Selected
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="h-4 w-4 mr-1.5" />
                                      Select
                                    </>
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                              No eligible courses found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Tab Content: Selected Courses */}
                <TabsContent value="selected">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead className="text-center">Units</TableHead>
                          <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCourses.length > 0 ? (
                          selectedCourses.map((courseId) => {
                            // Find the full course details from the eligible list
                            const course = studentEligibleCourses.find((c) => c.id === courseId)
                            if (!course) return null // Should not happen if state is managed correctly
                            return (
                              <TableRow key={course.id}>
                                <TableCell className="font-medium">{course.code}</TableCell>
                                <TableCell>{course.title}</TableCell>
                                <TableCell className="text-center">{course.units}</TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSelectCourse(course.id)}
                                    className="text-destructive hover:text-destructive" // Make remove more distinct
                                  >
                                    <X className="h-4 w-4 mr-1.5" /> {/* Use X icon */}
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                              No courses selected yet. Go to "Available Courses" tab.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div> {/* End grid */}

        {/* Dialog Footer */}
        <DialogFooter className="mt-6 pt-4 border-t"> {/* Added border-t */}
          {/* Info section on the left */}
          <div className="flex items-center text-sm text-muted-foreground mr-auto">
            <Info className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>
              Total selected: {selectedCourses.length} course{selectedCourses.length !== 1 ? 's' : ''} ({totalSelectedUnits} units)
            </span>
          </div>
          {/* Action buttons on the right */}
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmitAdvising} disabled={selectedCourses.length === 0 || isSubmitting}>
            {isSubmitting ? (
              "Submitting..." // Simple text while submitting
            ) : (
              <>
                <FileCheck className="h-4 w-4 mr-2" />
                Complete Advising
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}