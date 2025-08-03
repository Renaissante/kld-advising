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
import { CheckCircle2, AlertCircle, Info, Plus, FileCheck, X, Loader2, AlertTriangle, BookOpenCheck } from "lucide-react" // Added BookOpenCheck icon
import { useAuth } from "@/hooks/useAuth"
// Import Tooltip components
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { API_BASE_URL } from '@/config/api';

export default function AdvisingModal({
  isOpen,
  onClose,
  student,
  activeAcademicYear,
  activeSemester,
  onAdvisingComplete, // Accept the new prop
}) {
  const { user } = useAuth()
  const [selectedTab, setSelectedTab] = useState("eligible")
  const [selectedCourses, setSelectedCourses] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // State for fetched data
  const [previousGrades, setPreviousGrades] = useState([]) // Grades for the *current* active semester
  const [eligibleCourses, setEligibleCourses] = useState([]) // Eligible courses for the *next* period (if advising not completed)
  const [advisedCourses, setAdvisedCourses] = useState([]) // Advised courses for the *current* active period (if advising completed)
  const [advisingCompleted, setAdvisingCompleted] = useState(false) // Flag from backend
  const [isLoadingAdvisingData, setIsLoadingAdvisingData] = useState(false)
  const [advisingDataError, setAdvisingDataError] = useState(null)

  // Effect to fetch data when modal opens and student is selected
  useEffect(() => {
    const fetchAdvisingData = async () => {
      if (!student?.id || !activeAcademicYear?.id || !activeSemester?.id || !user?.id) {
        // Don't fetch if required data is missing
        setPreviousGrades([]);
        setEligibleCourses([]);
        setAdvisedCourses([]); // Reset advised courses
        setAdvisingCompleted(false); // Reset advising completed flag
        setIsLoadingAdvisingData(false);
        setAdvisingDataError(null);
        return;
      }

      setIsLoadingAdvisingData(true);
      setAdvisingDataError(null);
      setPreviousGrades([]);
      setEligibleCourses([]);
      setAdvisedCourses([]); // Reset advised courses
      setAdvisingCompleted(false); // Reset advising completed flag
      setSelectedCourses([]); // Clear selected courses on new student/fetch

      try {
        const apiUrl = `${API_BASE_URL}/faculty/get_student_advising_data.php?student_id=${student.id}&active_academic_year_id=${activeAcademicYear.id}&active_semester_id=${activeSemester.id}&faculty_id=${user.id}`;

        console.log("Fetching advising data from:", apiUrl);
        const response = await fetch(apiUrl);

        if (!response.ok) {
          let errorMsg = `HTTP error! status: ${response.status}`;
          let errorData = null;
          try {
            errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
            console.error("Advising data fetch error response:", errorData);
          } catch (e) {
             console.error("Advising data fetch error (non-JSON):", await response.text());
           }
          throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("Advising data API response:", data);

        if (data.success && data.data) {
           setAdvisingCompleted(data.data.advising_completed); // Set the advising completed flag

           if (data.data.advising_completed) {
               // If advising is completed, set advised courses
               setAdvisedCourses(data.data.advised_courses || []);
               // No need to set eligibleCourses or fullGradeHistory if advising is completed
               setPreviousGrades([]); // Ensure previous grades are cleared if not sent
               setEligibleCourses([]); // Ensure eligible courses are cleared if not sent
           } else {
               // If advising is NOT completed, set eligible courses and previous grades
               // Filter full_grade_history to get only current semester grades for display
               const currentYearLevelId = data.data.current_year_level_id;
               const currentSemesterId = data.data.current_semester_id;

               const currentSemGrades = (data.data.full_grade_history || []).filter(grade =>
                   grade.year_level_id === currentYearLevelId &&
                   grade.semester_id === currentSemesterId
               );
               setPreviousGrades(currentSemGrades); // Use filtered grades for display

               // eligible_courses now includes can_select and prerequisite_reason
               setEligibleCourses(data.data.eligible_courses || []);
               setAdvisedCourses([]); // Ensure advised courses are cleared if not sent
           }

           console.log("Advising data state set:", data.data);
        } else {
           // API returned success:false or missing data field
           throw new Error(data.message || "API returned success:false or missing data field.");
        }
      } catch (error) {
        console.error("Fetching advising data failed:", error);
        setAdvisingDataError(error.message || "Failed to load advising data. Please try again later.");
        setPreviousGrades([]);
        setEligibleCourses([]);
        setAdvisedCourses([]);
        setAdvisingCompleted(false);
      } finally {
        setIsLoadingAdvisingData(false);
      }
    };

    if (isOpen && student && user?.id) {
      fetchAdvisingData();
    } else {
        // Reset data when modal is closed or student is cleared
        setPreviousGrades([]);
        setEligibleCourses([]);
        setAdvisedCourses([]);
        setAdvisingCompleted(false);
        setSelectedCourses([]);
        setIsLoadingAdvisingData(false);
        setAdvisingDataError(null);
    }

  }, [isOpen, student, activeAcademicYear, activeSemester, user]); // Dependencies include props and user

  // Reset selected courses and tab when modal opens with a new student
  useEffect(() => {
    if (isOpen) {
      setSelectedCourses([]) // Clear selections when modal opens
      setSelectedTab("eligible") // Reset to eligible tab
    }
  }, [isOpen, student]) // Dependency array includes student to reset if student changes while modal is open (less common)

  // Return null if modal is not open or no student data is available yet
  if (!isOpen || !student) return null

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
  const handleSubmitAdvising = async () => { // Made async
    if (selectedCourses.length === 0) {
      toast.error("Please select at least one course to recommend.")
      return
    }

    setIsSubmitting(true)
    console.log("Submitting advising for:", student.id, "Courses:", selectedCourses)

    const advisingData = {
        student_id: student.id,
        advisor_id: user.id, // Get advisor ID from the logged-in user
        active_academic_year_id: activeAcademicYear.id,
        active_semester_id: activeSemester.id,
        selected_course_ids: selectedCourses,
    };

    try {
        const response = await fetch(`${API_BASE_URL}/faculty/submit_advising.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(advisingData),
        });

        // Check for success (200-299) or multi-status (207)
        if (!response.ok && response.status !== 207) {
             let errorMsg = `HTTP error! status: ${response.status}`;
             let errorData = null;
             try {
                 errorData = await response.json();
                 errorMsg = errorData.message || errorMsg;
                 console.error("Advising submission error response:", errorData);
             } catch (e) {
                 console.error("Advising submission error (non-JSON):", await response.text());
             }
             throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("Advising submission API response:", data);

        if (data.success) {
            // Use toast based on the backend message
            if (response.status === 207) {
                 toast.warning(data.message, { icon: <AlertTriangle className="h-4 w-4" /> });
                 if (data.failed_insertions && data.failed_insertions.length > 0) {
                     console.error("Failed course insertions:", data.failed_insertions);
                 }
            } else {
                toast.success(data.message, { icon: <CheckCircle2 className="h-4 w-4" /> });
            }
            // After successful submission (even partial), advising is now completed for this period
            setAdvisingCompleted(true);
            // Call the callback to update the parent state, passing the total selected units
            if (onAdvisingComplete && student?.id) {
                onAdvisingComplete(student.id, totalSelectedUnits); // Pass totalSelectedUnits
            }
            onClose(); // Close the modal on successful or partial submission
        } else {
            // Handle success: false from backend
            toast.error(data.message || "Advising submission failed.", { icon: <AlertCircle className="h-4 w-4" /> });
            if (data.failed_insertions && data.failed_insertions.length > 0) {
                console.error("Failed course insertions:", data.failed_insertions);
            }
        }

    } catch (error) {
        console.error("Error submitting advising:", error);
        toast.error(error.message || "Failed to submit advising. Please try again.", { icon: <AlertCircle className="h-4 w-4" /> });
    } finally {
        setIsSubmitting(false);
    }
  }

  // Calculate total units for selected courses (only relevant if advising is not completed)
  const totalSelectedUnits = advisingCompleted ? 0 : eligibleCourses
    .filter((c) => selectedCourses.includes(c.id))
    .reduce((acc, curr) => acc + curr.units, 0)

  // Calculate total units for advised courses (only relevant if advising is completed)
  const totalAdvisedUnits = advisedCourses.reduce((acc, curr) => acc + curr.units, 0);


  return (
    // Wrap Dialog in TooltipProvider
    <TooltipProvider>
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
        {/* Use a single column if advising is completed, two columns otherwise */}
        <div className={`grid grid-cols-1 ${!advisingCompleted ? 'lg:grid-cols-2' : ''} gap-6 mt-4 max-h-[70vh] overflow-y-auto pr-2`}> {/* Added scroll and conditional grid */}
          {/* Previous Semester Grades Card - Conditionally rendered */}
          {!advisingCompleted && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <Info className="h-4 w-4 mr-2 text-muted-foreground" />
                  Current Semester Grades
                </CardTitle>
                <CardDescription>Academic performance this semester</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAdvisingData ? (
                   <div className="flex items-center justify-center p-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      <span>Loading grades...</span>
                   </div>
                ) : advisingDataError ? (
                   <div className="flex justify-center items-center p-8 bg-destructive/10 text-destructive rounded-md">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        <p>Error loading grades: {advisingDataError}</p>
                   </div>
                ) : (
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
                        {previousGrades.length > 0 ? (
                          previousGrades.map((grade) => (
                            <TableRow key={grade.course_id}>
                              <TableCell className="font-medium">{grade.course_code}</TableCell>
                              <TableCell>{grade.course_title}</TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant={
                                    parseFloat(grade.transmutation) === 5.00 || parseFloat(grade.transmutation) === 0.00
                                      ? "destructive"
                                      : "default"
                                  }
                                >
                                  {grade.transmutation}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">{grade.units}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                              No previous grades found for the current semester.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}


          {/* Right-hand Card: Conditional Content */}
          <Card className={advisingCompleted ? 'lg:col-span-2' : ''}> {/* Make this card span 2 columns if advising is completed */}
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                 {advisingCompleted ? (
                    <>
                       <BookOpenCheck className="h-4 w-4 mr-2 text-muted-foreground" /> {/* Icon for completed advising */}
                       Advised Courses for Current Semester
                    </>
                 ) : (
                    <>
                       <CheckCircle2 className="h-4 w-4 mr-2 text-muted-foreground" />
                       Eligible Courses for Next Semester
                    </>
                 )}
              </CardTitle>
              <CardDescription>
                 {advisingCompleted ? (
                    "Courses recommended and submitted for this advising period."
                 ) : (
                    "Select courses to recommend for enrollment"
                 )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAdvisingData ? (
                 <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    <span>Loading courses...</span>
                 </div>
              ) : advisingDataError ? (
                 <div className="flex justify-center items-center p-8 bg-destructive/10 text-destructive rounded-md">
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      <p>Error loading courses: {advisingDataError}</p>
                 </div>
              ) : advisingCompleted ? (
                 // Display Advised Courses if advising is completed
                 <div className="rounded-md border">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Code</TableHead>
                         <TableHead>Title</TableHead>
                         <TableHead className="text-center">Units</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {advisedCourses.length > 0 ? (
                         advisedCourses.map((course) => (
                           <TableRow key={course.course_id}>
                             <TableCell className="font-medium">{course.course_code}</TableCell>
                             <TableCell>{course.course_title}</TableCell>
                             <TableCell className="text-center">{course.units}</TableCell>
                           </TableRow>
                         ))
                       ) : (
                         <TableRow>
                           <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                             No advised courses found for this period.
                           </TableCell>
                         </TableRow>
                       )}
                     </TableBody>
                   </Table>
                 </div>
              ) : (
                 // Display Eligible/Selected Tabs if advising is NOT completed
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
                            {eligibleCourses.length > 0 ? (
                              eligibleCourses.map((course) => {
                                 // Determine if the course is selectable based on backend data
                                 const canSelect = course.can_select;
                                 const prerequisiteReason = course.prerequisite_reason;
                                 const isSelected = selectedCourses.includes(course.id);

                                 return (
                                 <TableRow key={course.id}>
                                   <TableCell className="font-medium">{course.course_code}</TableCell>
                                   <TableCell>{course.course_title}</TableCell>
                                   <TableCell className="text-center">{course.units}</TableCell>
                                   <TableCell className="text-center">
                                     {/* Wrap button in Tooltip if not selectable */}
                                     {canSelect ? (
                                         <Button
                                           variant={isSelected ? "secondary" : "outline"}
                                           size="sm"
                                           onClick={() => handleSelectCourse(course.id)}
                                           disabled={isSelected} // Disable if already selected
                                         >
                                           {isSelected ? (
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
                                     ) : (
                                         <Tooltip>
                                             <TooltipTrigger asChild>
                                                 <Button
                                                   variant="secondary"
                                                   size="sm"
                                                    // Always disabled if canSelect is false
                                                   className="cursor-not-allowed" // Indicate it's not clickable
                                                 >
                                                     <AlertCircle className="h-4 w-4 mr-1.5 text-muted-foreground" />
                                                     Cannot Select
                                                 </Button>
                                             </TooltipTrigger>
                                             <TooltipContent>
                                                 <p>{prerequisiteReason || "Cannot select due to unmet prerequisites."}</p>
                                             </TooltipContent>
                                         </Tooltip>
                                     )}
                                   </TableCell>
                                 </TableRow>
                              )})
                            ) : (
                              <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                  No eligible courses found for the next semester in the curriculum.
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
                               const course = eligibleCourses.find((c) => c.id === courseId)
                               if (!course) return null
                               return (
                                 <TableRow key={course.id}>
                                   <TableCell className="font-medium">{course.course_code}</TableCell>
                                   <TableCell>{course.course_title}</TableCell>
                                   <TableCell className="text-center">{course.units}</TableCell>
                                   <TableCell className="text-center">
                                     <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => handleSelectCourse(course.id)}
                                       className="text-destructive hover:text-destructive"
                                     >
                                       <X className="h-4 w-4 mr-1.5" />
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
              )}
            </CardContent>
          </Card>
        </div> {/* End grid */}

        {/* Dialog Footer */}
        <DialogFooter className="mt-6 pt-4 border-t">
          {/* Info section on the left */}
          <div className="flex items-center text-sm text-muted-foreground mr-auto">
            <Info className="h-4 w-4 mr-2 flex-shrink-0" />
            {advisingCompleted ? (
                <span>
                   Total advised: {advisedCourses.length} course{advisedCourses.length !== 1 ? 's' : ''} ({totalAdvisedUnits} units)
                </span>
            ) : (
                <span>
                  Total selected: {selectedCourses.length} course{selectedCourses.length !== 1 ? 's' : ''} ({totalSelectedUnits} units)
                </span>
            )}
          </div>
          {/* Action buttons on the right */}
          <Button variant="outline" onClick={onClose} disabled={isSubmitting || isLoadingAdvisingData}>
            Close
          </Button>
          {!advisingCompleted && ( // Only show submit button if advising is NOT completed
              <Button
                variant="green"
                onClick={handleSubmitAdvising}
                disabled={selectedCourses.length === 0 || isSubmitting || isLoadingAdvisingData || advisingDataError}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FileCheck className="h-4 w-4 mr-2" />
                    Complete Advising
                  </>
                )}
              </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </TooltipProvider> // Close TooltipProvider
  )
}