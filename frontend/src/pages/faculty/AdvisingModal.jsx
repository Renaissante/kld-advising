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
import { Input } from "@/components/ui/input"; // Import Input component

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
  const [editableGrades, setEditableGrades] = useState({}); // New state for editable grades

  // State for fetched data
  const [previousGrades, setPreviousGrades] = useState([]) // Grades for the *current* active semester
  const [eligibleCourses, setEligibleCourses] = useState([]) // Eligible courses for the *next* period (if advising not completed)
  const [studentSubmittedCourses, setStudentSubmittedCourses] = useState([]) // Student-submitted courses
  const [facultyApprovedCourses, setFacultyApprovedCourses] = useState([]) // Faculty-approved advised courses
  const [advisingCompleted, setAdvisingCompleted] = useState(false) // Flag from backend
  const [isLoadingAdvisingData, setIsLoadingAdvisingData] = useState(false)
  const [advisingDataError, setAdvisingDataError] = useState(null)
  const [nextAcademicYearId, setNextAcademicYearId] = useState(null); // New state for next academic year ID
  const [nextSemesterId, setNextSemesterId] = useState(null); // New state for next semester ID
  const [allCurriculumCoursesMap, setAllCurriculumCoursesMap] = useState({}); // New state for all curriculum courses map
  const [prerequisitesMap, setPrerequisitesMap] = useState({}); // New state for prerequisites map

  // Helper function to determine remarks based on grade (replicating backend logic)
  const getRemarksFromGrade = (grade) => {
    if (grade === null || grade === "") return null;

    const lowerGrade = String(grade).toLowerCase();
    if (lowerGrade === 'inc') return 'Incomplete';
    if (lowerGrade === 'ud') return 'Unofficially Dropped';
    if (lowerGrade === 'od') return 'Officially Dropped';

    const numGrade = parseFloat(grade);

    if (isNaN(numGrade)) {
      return null; // Not a known text grade or a valid number
    }

    // 5-point grading scale: 1.00-3.00 is Passed, 3.25-5.00 is Failed
    if (numGrade >= 1.00 && numGrade <= 3.00) return "Passed";
    if (numGrade >= 3.25 && numGrade <= 5.00) return "Failed";
    return null; // Should not happen with valid input range
  };

  // Effect to fetch data when modal opens and student is selected
  useEffect(() => {
    const fetchAdvisingData = async () => {
      if (!student?.id || !activeAcademicYear?.id || !activeSemester?.id || !user?.id) {
        // Don't fetch if required data is missing
        setPreviousGrades([]);
        setEligibleCourses([]);
        setStudentSubmittedCourses([]);
        setFacultyApprovedCourses([]);
        setAdvisingCompleted(false);
        setIsLoadingAdvisingData(false);
        setAdvisingDataError(null);
        setEditableGrades({}); // Also clear when modal closes or student data is missing
        return;
      }

      setIsLoadingAdvisingData(true);
      setAdvisingDataError(null);
      setPreviousGrades([]);
      setEligibleCourses([]);
      setStudentSubmittedCourses([]);
      setFacultyApprovedCourses([]);
      setAdvisingCompleted(false);
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
           setAdvisingCompleted(data.data.advising_completed);

           if (data.data.advising_completed) {
               setFacultyApprovedCourses(data.data.faculty_approved_advised_courses || []);
               setPreviousGrades([]);
               setEligibleCourses([]);
               setStudentSubmittedCourses([]);
               setSelectedCourses(data.data.faculty_approved_advised_courses.map(course => course.course_id));
               setNextAcademicYearId(parseInt(data.data.next_year_level_id) || null); // Corrected to use next_year_level_id
               setNextSemesterId(parseInt(data.data.next_semester_id) || null); // Ensure it's an integer
               setEditableGrades({}); // Clear editable grades when advising is completed
               setAllCurriculumCoursesMap(data.data.all_curriculum_courses_map || {}); // Set all curriculum courses map
               setPrerequisitesMap(data.data.prerequisites_map || {}); // Set prerequisites map
           } else {
               const currentYearLevelId = data.data.current_year_level_id;
               const currentSemesterId = data.data.current_semester_id;

               const currentSemGrades = (data.data.full_grade_history || []).filter(grade =>
                   grade.year_level_id === currentYearLevelId &&
                   grade.semester_id === currentSemesterId
               );
               setPreviousGrades(currentSemGrades);

               // Initialize editableGrades from currentSemGrades
               const initialEditableGrades = currentSemGrades.reduce((acc, grade) => {
                   acc[grade.course_id] = grade.transmutation ? grade.transmutation.toString() : "";
                   return acc;
               }, {});
               setEditableGrades(initialEditableGrades);

               setEligibleCourses(data.data.eligible_courses || []);
               setStudentSubmittedCourses(data.data.student_submitted_advised_courses || []);

               // Pre-select student-submitted courses if advising is not completed yet
               if (data.data.student_submitted_advised_courses && data.data.student_submitted_advised_courses.length > 0) {
                   setSelectedCourses(data.data.student_submitted_advised_courses.map(course => course.course_id));
               } else {
                   setSelectedCourses([]);
               }
               setFacultyApprovedCourses([]);
               setNextAcademicYearId(parseInt(data.data.next_year_level_id) || null); // Corrected to use next_year_level_id
               setNextSemesterId(parseInt(data.data.next_semester_id) || null); // Ensure it's an integer
               setAllCurriculumCoursesMap(data.data.all_curriculum_courses_map || {}); // Set all curriculum courses map
               setPrerequisitesMap(data.data.prerequisites_map || {}); // Set prerequisites map
           }

           console.log("Advising data state set:", data.data);
           console.log("Frontend advisingCompleted:", data.data.advising_completed);
           console.log("Frontend nextAcademicYearId:", data.data.next_year_level_id); // Log the raw value from backend
           console.log("Frontend nextSemesterId:", data.data.next_semester_id); // Log the raw value from backend
           console.log("Frontend studentSubmittedCourses (initial):", data.data.student_submitted_advised_courses);
           console.log("Frontend selectedCourses (initial):", (data.data.student_submitted_advised_courses || []).map(course => course.course_id));
        } else {
           throw new Error(data.message || "API returned success:false or missing data field.");
        }
      } catch (error) {
        console.error("Fetching advising data failed:", error);
        setAdvisingDataError(error.message || "Failed to load advising data. Please try again later.");
        setPreviousGrades([]);
        setEligibleCourses([]);
        setStudentSubmittedCourses([]);
        setFacultyApprovedCourses([]);
        setAdvisingCompleted(false);
        setEditableGrades({}); // Also clear on error
      } finally {
        setIsLoadingAdvisingData(false);
      }
    };

    if (isOpen && student && user?.id) {
      fetchAdvisingData();
    } else {
        setPreviousGrades([]);
        setEligibleCourses([]);
        setStudentSubmittedCourses([]);
        setFacultyApprovedCourses([]);
        setAdvisingCompleted(false);
        setSelectedCourses([]);
        setIsLoadingAdvisingData(false);
        setAdvisingDataError(null);
        setEditableGrades({}); // Also clear when modal closes or student data is missing
    }

  }, [isOpen, student, activeAcademicYear, activeSemester, user]);

  useEffect(() => {
    if (isOpen && !advisingCompleted) {
      // Only reset selected courses if there are no student-submitted courses initially
      // This effect should run after studentSubmittedCourses has been updated from the fetch.
      // If studentSubmittedCourses are available, they should override the blank state.
      if (!studentSubmittedCourses || studentSubmittedCourses.length === 0) {
        setSelectedCourses([])
      }
      setSelectedTab("eligible")
    }
  }, [isOpen, student, advisingCompleted, studentSubmittedCourses]) // Added advisingCompleted and studentSubmittedCourses to dependencies

  // Return null if modal is not open or no student data is available yet
  if (!isOpen || !student) return null

  // Handler for grade input changes
  const handleGradeChange = (courseId, newGrade) => {
    // Always update the state to allow free typing
    setEditableGrades(prev => ({ ...prev, [courseId]: newGrade }));
  };

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

    // Validate editable grades before submission
    const gradesToSubmit = [];
    let hasInvalidGrades = false;
    for (const courseId in editableGrades) {
      const grade = editableGrades[courseId].trim();

      if (grade === "") {
        // Empty grades are allowed (not yet submitted)
        continue;
      }

      const lowerGrade = grade.toLowerCase();
      if (lowerGrade === "inc" || lowerGrade === "ud" || lowerGrade === "od") {
        gradesToSubmit.push({
          course_id: parseInt(courseId),
          grade: grade.toUpperCase(), // Store as uppercase
        });
        continue;
      }

      const parsedValue = parseFloat(grade);
      const decimalPart = grade.includes('.') ? grade.split('.')[1] : '';

      if (isNaN(parsedValue) || parsedValue < 1.00 || parsedValue > 5.00 || decimalPart.length > 2) {
        toast.error(`Invalid grade '${grade}' for course ID ${courseId}. Grades must be between 1.00 and 5.00 (max 2 decimal places), or 'INC', 'UD', 'OD'.`);
        hasInvalidGrades = true;
        break; // Stop validation on first error
      }

      gradesToSubmit.push({
        course_id: parseInt(courseId),
        grade: parsedValue.toFixed(2), // Format to 2 decimal places
      });
    }

    if (hasInvalidGrades) {
      setIsSubmitting(false);
      return;
    }

    const advisingData = {
        student_id: student.id,
        advisor_id: user.id, // Get advisor ID from the logged-in user
        academic_year_id: nextAcademicYearId, // Use next academic year ID
        semester_id: nextSemesterId, // Use next semester ID
        selected_course_ids: selectedCourses,
        grades: gradesToSubmit,
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
                // The totalSelectedUnits calculation might need to reflect the newly advised courses
                // For now, let's recalculate it based on the current selectedCourses which will be the approved ones
                const newlyAdvisedUnits = eligibleCourses
                    .filter((c) => selectedCourses.includes(c.id))
                    .reduce((acc, curr) => acc + curr.units, 0);
                onAdvisingComplete(student.id, newlyAdvisedUnits, true); // Pass true for advisingCompleted
            }
            // Send advising form PDF to student via email
            try {
                await fetch(`${API_BASE_URL}/email/send_advising_form_to_student.php`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    student_id: student.id,
                    academic_year: activeAcademicYear.year || activeAcademicYear.name,
                    semester: activeSemester.name,
                  }),
                });
                toast.success("Advising form sent to student via email.");
            } catch {
                toast.error("Could not email the advising form to the student.");
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

  // Calculate total units for faculty-approved advised courses
  const totalAdvisedUnits = facultyApprovedCourses.reduce((acc, curr) => acc + curr.units, 0);

  // Determine if all eligible courses that can be selected are currently selected
  const allSelectableEligibleCoursesIds = eligibleCourses.filter(course => course.can_select).map(course => course.id);
  const allEligibleSelected = allSelectableEligibleCoursesIds.length > 0 && allSelectableEligibleCoursesIds.every(id => selectedCourses.includes(id));


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
                                <Input
                                  type="text"
                                  value={editableGrades[grade.course_id] || ""}
                                  onChange={(e) => handleGradeChange(grade.course_id, e.target.value)}
                                  className="text-center h-8 w-20 p-1 border rounded"
                                  placeholder="Grade"
                                  maxLength={4} // e.g., "5.00", "INC"
                                  disabled={advisingCompleted} // Disable input if advising is completed
                                />
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
                       Faculty Approved Courses for Current Semester
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
                    "Courses approved by faculty for this advising period."
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
                 // Display Faculty Approved Courses if advising is completed
                 <div className="rounded-md border">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Code</TableHead>
                         <TableHead>Title</TableHead>
                         <TableHead className="text-center">Units</TableHead>
                         <TableHead className="text-center">Status</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {facultyApprovedCourses.length > 0 ? (
                         facultyApprovedCourses.map((course) => (
                           <TableRow key={course.course_id}>
                             <TableCell className="font-medium">{course.course_code}</TableCell>
                             <TableCell>{course.course_title}</TableCell>
                             <TableCell className="text-center">{course.units}</TableCell>
                             <TableCell className="text-center">
                               <Badge variant="default">{course.status}</Badge>
                             </TableCell>
                           </TableRow>
                         ))
                       ) : (
                         <TableRow>
                           <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                             No faculty-approved courses found for this period.
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
                      <div className="flex justify-end mb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (allEligibleSelected) {
                              // Deselect all eligible courses
                              setSelectedCourses(prev => prev.filter(id => !allSelectableEligibleCoursesIds.includes(id)));
                            } else {
                              // Select all eligible courses that can be selected
                              setSelectedCourses(prev => [
                                ...new Set([...prev, ...allSelectableEligibleCoursesIds])
                              ]);
                            }
                          }}
                          disabled={!eligibleCourses.length || (!allSelectableEligibleCoursesIds.length && !allEligibleSelected)}
                        >
                          {allEligibleSelected ? (
                            <X className="h-4 w-4 mr-1.5" />
                          ) : (
                            <Plus className="h-4 w-4 mr-1.5" />
                          )}
                          {allEligibleSelected ? "Deselect All" : "Select All"}
                        </Button>
                      </div>
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
                                           // A course is only disabled if it's already selected AND it wasn't originally student-submitted
                                           // This allows faculty to deselect student-submitted courses
                                           disabled={isSelected && !studentSubmittedCourses.some(ssc => ssc.course_id === course.id)}
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
                               // Find the full course details from the eligible list (or studentSubmittedCourses if it was pre-selected)
                               const course = eligibleCourses.find((c) => c.id === courseId) || studentSubmittedCourses.find((c) => c.course_id === courseId);
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

        {console.log("Render Check - advisingCompleted:", advisingCompleted)}
        {console.log("Render Check - selectedCourses:", selectedCourses)}
        {console.log("Render Check - nextAcademicYearId:", nextAcademicYearId)}
        {console.log("Render Check - nextSemesterId:", nextSemesterId)}
        {/* Dialog Footer */}
        <DialogFooter className="mt-6 pt-4 border-t">
          {/* Info section on the left */}
          <div className="flex items-center text-sm text-muted-foreground mr-auto">
            <Info className="h-4 w-4 mr-2 flex-shrink-0" />
            {advisingCompleted ? (
                <span>
                   Total approved: {facultyApprovedCourses.length} course{facultyApprovedCourses.length !== 1 ? 's' : ''} ({totalAdvisedUnits} units)
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
                disabled={selectedCourses.length === 0 || isSubmitting || isLoadingAdvisingData || advisingDataError || !nextAcademicYearId || !nextSemesterId}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <FileCheck className="h-4 w-4 mr-2" />
                    Approve Advising
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