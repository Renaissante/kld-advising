import React, { useState, useEffect, useMemo, useCallback } from "react"
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { Toaster } from "@/components/ui/sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { CheckCircle2, AlertCircle, Info, Plus, FileCheck, X, Loader2, AlertTriangle } from "lucide-react"
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input"; // Import Input component
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { API_BASE_URL } from '@/config/api'; // Import API_BASE_URL
import { useActive } from "@/contexts/ActiveContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"; // Import Dialog components

export default function SubmitForAdvising() {
  const { user } = useAuth()
  const { activeAcademicYear, activeSemester, loading: activeLoading } = useActive(); // Use useActive hook
  const [selectedTab, setSelectedTab] = useState("eligible")
  const [selectedCourses, setSelectedCourses] = useState([])

  const [curriculumId, setCurriculumId] = useState(null);
  const [studentCourses, setStudentCourses] = useState([]); // All courses from curriculum fetched from API
  const [previousGrades, setPreviousGrades] = useState([]); // Grades for current semester (user editable)
  const [isLoading, setIsLoading] = useState(true); // Local loading state for this component's data fetch
  const [error, setError] = useState(null);
  const [isAdvisingRequestSubmitted, setIsAdvisingRequestSubmitted] = useState(false);
  const [isAdvisingRequestApproved, setIsAdvisingRequestApproved] = useState(false); // New state for approved status
  const [requestedCourses, setRequestedCourses] = useState([]);
  const [nextAcademicYearId, setNextAcademicYearId] = useState(null);
  const [nextSemesterId, setNextSemesterId] = useState(null);
  const [studentActualYearLevelId, setStudentActualYearLevelId] = useState(null); // New state
  const [studentProfile, setStudentProfile] = useState(null); // New state for student profile
  const [showConfirmDialog, setShowConfirmDialog] = useState(false); // State for confirmation dialog
  const [currentSemesterAdvisedCourses, setCurrentSemesterAdvisedCourses] = useState([]); // New state

  // Combine local loading with active context loading
  const isOverallLoading = isLoading || activeLoading;

  // Memoize fetchStudentData to prevent unnecessary re-creations
  const fetchStudentData = useCallback(async () => {
    // Only proceed with fetching student data if user is available and active context is NOT loading
    if (!user?.id || activeLoading) {
      // If activeLoading is true, we simply return. The component remains in a loading state
      // due to isOverallLoading (which includes activeLoading).
      // No need to set setIsLoading(false) here, as it would cause an unnecessary state update/re-render.
      return;
    }

    setIsLoading(true); // Start local loading for this component's data
    setError(null);

    try {
      // Fetch student's curriculum and all courses within it, including grades
      const curriculumResponse = await fetch(`${API_BASE_URL}/student/get_curriculum.php?student_id=${user.id}&active_academic_year_id=${activeAcademicYear.id}&active_semester_id=${activeSemester.id}`);
      if (!curriculumResponse.ok) {
        throw new Error(`HTTP error! status: ${curriculumResponse.status}`);
      }
      const curriculumData = await curriculumResponse.json();

      if (curriculumData.message) {
        setError(curriculumData.message);
        setIsLoading(false);
        return;
      }

      const fetchedCourses = curriculumData.courses || [];
      setStudentCourses(fetchedCourses); // Store all fetched courses

      // Fetch student advising profile
      const profileResponse = await fetch(`${API_BASE_URL}/student/read_student_advising_profile.php?student_id=${user.student_id}&academic_year=${activeAcademicYear.year}&semester=${activeSemester.name}`);
      if (!profileResponse.ok) {
        throw new Error(`HTTP error! status: ${profileResponse.status}`);
      }
      const profileData = await profileResponse.json();
      setStudentProfile(profileData); // Set the student profile

      // Determine student's current curriculum year level based on active academic year
      // Prioritize studentYearLevelId from API if available
      let currentYearLevelId = 1; // Initialize with default
      if (curriculumData.curriculumName?.studentYearLevelId) {
        // Directly use the studentYearLevelId from the API
        currentYearLevelId = parseInt(curriculumData.curriculumName.studentYearLevelId);
        setStudentActualYearLevelId(currentYearLevelId); // Set the state immediately
      } else {
        // Fallback to existing calculation if API doesn't provide it, or set a default
        const curriculumStartYearString = curriculumData.curriculumName?.academicYear;
        if (curriculumStartYearString && activeAcademicYear?.year) {
          const curriculumStartYear = parseInt(curriculumStartYearString.split('-')[0]);
          const activeYear = parseInt(activeAcademicYear.year.split('-')[0]);
          if (!isNaN(curriculumStartYear) && !isNaN(activeYear)) {
            currentYearLevelId = (activeYear - curriculumStartYear) + 1;
          }
        }
        setStudentActualYearLevelId(currentYearLevelId); // Set the state immediately
      }

      let coursesForGradeInput = [];

      // Check if the student is a 1st year, 1st semester student
      const isFirstYearFirstSem = currentYearLevelId === 1 && activeSemester?.id === 1;

      if (isFirstYearFirstSem) {
        // For 1st year, 1st sem students: use courses directly from curriculum for the current active semester
        coursesForGradeInput = fetchedCourses.filter(course => 
          course.year_level_id === currentYearLevelId && 
          course.semester_id === activeSemester?.id && 
          !course.is_credited
        );
      } else {
        // For succeeding semesters: fetch approved advised courses for the current semester
        const advisedCoursesResponse = await fetch(`${API_BASE_URL}/student/get_current_semester_advised_courses.php?student_id=${user.id}&academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}`);
        if (!advisedCoursesResponse.ok) {
          throw new Error(`HTTP error! status: ${advisedCoursesResponse.status}`);
        }
        const advisedCoursesData = await advisedCoursesResponse.json();
        const approvedAdvisedCourseIds = new Set(advisedCoursesData.advised_courses.map(course => course.id));
        setCurrentSemesterAdvisedCourses(advisedCoursesData.advised_courses); // Store advised courses

        coursesForGradeInput = fetchedCourses.filter(course => 
          approvedAdvisedCourseIds.has(course.id) &&
          course.year_level_id === currentYearLevelId && 
          course.semester_id === activeSemester?.id && 
          !course.is_credited
        );
      }

      const initialGrades = coursesForGradeInput.map(course => {
        const units = (course.unit_lec || 0) + (course.unit_lab || 0);
        return {
          course_id: course.id,
          course_code: course.course_code,
          course_title: course.course_title,
          units: units,
          gradeInput: course.grade !== null && course.grade !== undefined && course.grade !== '' ? course.grade.toString() : '',
          isCredited: course.is_credited || false,
          isSubmitted: course.is_submitted || false, // Include is_submitted status
        };
      });

      // Only update previousGrades if the fetched initial grades are different to avoid unnecessary re-renders
      // This is a shallow comparison, but often sufficient for initial load.
      if (JSON.stringify(initialGrades) !== JSON.stringify(previousGrades)) {
        setPreviousGrades(initialGrades);
      }

      // Only reset selected courses if they are not already empty
      if (selectedCourses.length > 0) {
        setSelectedCourses([]); // Reset selected courses on new data load
      }
      // Only reset selected tab if it's not already 'eligible'
      if (selectedTab !== "eligible") {
        setSelectedTab("eligible");
      }
      
      // Set curriculum ID if available
      if (curriculumData.curriculumName?.curriculum_id) {
        // Only update curriculumId if it's different
        if (curriculumId !== curriculumData.curriculumName.curriculum_id) {
          setCurriculumId(curriculumData.curriculumName.curriculum_id);
        }
      } else if (fetchedCourses.length > 0 && fetchedCourses[0].curriculum_id) {
        // Only update curriculumId if it's different
        if (curriculumId !== fetchedCourses[0].curriculum_id) {
          setCurriculumId(fetchedCourses[0].curriculum_id);
        }
      }

      // Set advising request status and requested courses
      setIsAdvisingRequestSubmitted(curriculumData.has_pending_advising_request || false);
      setIsAdvisingRequestApproved(curriculumData.has_approved_advising_request || false); // Set new state
      setRequestedCourses(curriculumData.requested_courses || []);
      setNextAcademicYearId(curriculumData.next_academic_year_id || null);
      setNextSemesterId(curriculumData.next_semester_id || null);

    } catch (err) {
      console.error("Error fetching student data:", err);
      setError(err.message || "Failed to load student data.");
      toast.error(`Error loading data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, activeLoading, activeAcademicYear?.id, activeSemester?.id]); // Corrected dependencies

  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]); // This effect now depends on the memoized fetchStudentData

  // Memoize eligibleCourses calculation
  const eligibleCourses = useMemo(() => {
    // Use studentActualYearLevelId directly if available, otherwise fallback to 1
    const currentYearLevelId = studentActualYearLevelId || 1;

    if (!studentCourses.length || !activeAcademicYear?.id || !activeSemester?.id || !currentYearLevelId) return []; // Updated dependency

    let nextSemesterId = activeSemester?.id === 1 ? 2 : 1;
    let nextYearLevelId = activeSemester?.id === 1 ? currentYearLevelId : currentYearLevelId + 1;

    const passedCourseIdsFromDB = new Set(studentCourses
      .filter(c => c.grade && parseFloat(c.grade) <= 3.0)
      .map(c => c.id)
    );

    const passedCourseIdsFromLocalInput = new Set(previousGrades
      .filter(grade => grade.gradeInput && parseFloat(grade.gradeInput) <= 3.0)
      .map(grade => grade.course_id)
    );

    const combinedPassedCourseIds = new Set([...passedCourseIdsFromDB, ...passedCourseIdsFromLocalInput]);

    const eligible = [];
    if (!isAdvisingRequestSubmitted && !isAdvisingRequestApproved) { // Only calculate eligible courses if no request is submitted yet
      studentCourses.forEach(course => {
        const units = (course.unit_lec || 0) + (course.unit_lab || 0);

        if (course.year_level_id === nextYearLevelId && course.semester_id === nextSemesterId && !(course.grade !== null && course.grade !== undefined && course.grade !== '')) {
          const hasPrerequisites = course.prerequisite_ids && course.prerequisite_ids.length > 0;
          let canSelect = true;
          let prerequisite_reason = null;

          if (hasPrerequisites) {
            const unmetPrerequisites = course.prerequisite_ids.filter(prereqId => !combinedPassedCourseIds.has(parseInt(prereqId)));
            if (unmetPrerequisites.length > 0) {
              canSelect = false;
              const unmetCodes = unmetPrerequisites.map(prereqId => {
                const pCourse = studentCourses.find(fc => fc.id === parseInt(prereqId));
                return pCourse ? pCourse.course_code : `ID ${prereqId}`;
              }).join(', ');
              prerequisite_reason = `Requires: ${unmetCodes}`;
            }
          }
          
          eligible.push({
            id: course.id,
            course_code: course.course_code,
            course_title: course.course_title,
            units: units,
            can_select: canSelect,
            prerequisite_reason: prerequisite_reason,
          });
        }
      });
    }
    return eligible;
  }, [studentCourses, previousGrades, activeAcademicYear?.id, activeAcademicYear?.year, activeSemester?.id, isAdvisingRequestSubmitted, isAdvisingRequestApproved, studentActualYearLevelId]);

  if (!user) return null // Only check for user now

  // Use the combined loading state here
  if (isOverallLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="w-full">
          <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
          <div className="container mx-auto p-4 md:p-6 mt-4">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-center h-48 border rounded-lg bg-muted/50">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-lg text-muted-foreground">Loading student data...</span>
              </div>
            </div>
          </div>
        </main>
      </SidebarProvider>
    );
  }

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="w-full">
          <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
          <div className="container mx-auto p-4 md:p-6 mt-4">
            <div className="flex flex-col gap-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </main>
      </SidebarProvider>
    );
  }

  const handleSelectCourse = (courseId) => {
    setSelectedCourses((prev) => {
      if (prev.includes(courseId)) {
        return prev.filter((id) => id !== courseId)
      } else {
        return [...prev, courseId]
      }
    })
  }

  // This function will now open the confirmation dialog
  const handleSubmitAdvising = () => {
    if (selectedCourses.length === 0) {
      toast.error("Please select at least one course to enroll.")
      return
    }

    if (!user?.id || !activeAcademicYear?.id || !activeSemester?.id || !curriculumId || !nextAcademicYearId || !nextSemesterId) {
      toast.error("Missing student, academic year, semester, curriculum, or next period information.");
      return;
    }
    setShowConfirmDialog(true); // Open the confirmation dialog
  }

  // This function will contain the actual submission logic
  const confirmSubmitAdvising = async () => {
    setShowConfirmDialog(false); // Close the dialog immediately
    setIsLoading(true); // Set loading state during submission
    try {
      // Prepare data for submission
      const advisingData = {
        student_id: user.id,
        academic_year_id: nextAcademicYearId, // Use next academic year for advised_courses
        semester_id: nextSemesterId, // Use next semester for advised_courses
        curriculum_id: curriculumId, // Pass curriculum ID as well
        grades: previousGrades.filter(grade => grade.gradeInput !== "").map(grade => ({
          course_id: grade.course_id,
          grade: grade.gradeInput,
        })),
        selected_courses: selectedCourses, // Include selected courses for next semester
      };

      const response = await fetch(`${API_BASE_URL}/student/submit_advising_request.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(advisingData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to submit advising request.");
      }

      toast.success(result.message || "Advising request submitted successfully!");
      // After successful submission, refresh data to reflect the changes (is_submitted, requested courses)
      fetchStudentData(); 
      // Note: setSelectedCourses will be reset by fetchStudentData which re-initializes previousGrades and eligibleCourses
      // and also updates isAdvisingRequestSubmitted and requestedCourses.
    } catch (err) {
      console.error("Error submitting advising:", err);
      setError(err.message || "Failed to submit advising request.");
      toast.error(`Error submitting advising: ${err.message}`);
    } finally {
      setIsLoading(false); // End loading state
    }
  }

  const totalSelectedUnits = eligibleCourses
    .filter((c) => selectedCourses.includes(c.id))
    .reduce((acc, curr) => acc + curr.units, 0)

  const allSelectableEligibleCoursesIds = eligibleCourses.filter(course => course.can_select).map(course => course.id);
  const allEligibleSelected = allSelectableEligibleCoursesIds.length > 0 && allSelectableEligibleCoursesIds.every(id => selectedCourses.includes(id));

  return (
    <SidebarProvider>
      <Toaster richColors position="bottom-right" />
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        <div className="container mx-auto p-4 md:p-6 mt-4">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Submit for Advising</h1>
              <p className="text-muted-foreground">
                Submit your current semester grades and select courses for the upcoming semester.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="space-y-6">
                  <div>
                    <CardTitle className="text-base flex items-center">
                      <Info className="h-4 w-4 mr-2 text-muted-foreground" />
                      Current Semester Grades ({activeAcademicYear?.year} {activeSemester?.name})
                    </CardTitle>
                    <CardDescription>Academic performance this semester</CardDescription>
                  </div>
                  <div>
                    <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Important Note:</AlertTitle>
                      <AlertDescription>
                      Please ensure that the grades you input are accurate, as they will still be reviewed and approved by your advisor.
                      </AlertDescription>
                    </Alert>
                  </div>
                  
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="py-2">Code</TableHead>
                          <TableHead className="py-2">Title</TableHead>
                          <TableHead className="text-center py-2">Grade</TableHead>
                          <TableHead className="text-center py-2">Units</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previousGrades.length > 0 ? (
                          previousGrades.map((grade) => (
                            <TableRow key={grade.course_id}>
                              <TableCell className="font-medium py-2">{grade.course_code}</TableCell>
                              <TableCell className="py-2">{grade.course_title}</TableCell>
                              <TableCell className="text-center w-[120px] py-2">
                                <Input
                                  type="text"
                                  value={grade.gradeInput}
                                  onChange={(e) => {
                                    const newValue = e.target.value;
                                    setPreviousGrades(prevGrades => {
                                      const newGrades = prevGrades.map(prevGrade => {
                                        if (prevGrade.course_id === grade.course_id) {
                                          // Only update if the new value is different
                                          if (prevGrade.gradeInput !== newValue) {
                                            // Allow empty string or a valid number between 1.00 and 5.00
                                            if (newValue === "") {
                                              return { ...prevGrade, gradeInput: newValue };
                                            } else {
                                              const parsedValue = parseFloat(newValue);
                                              if (!isNaN(parsedValue) && parsedValue >= 1.00 && parsedValue <= 5.00) {
                                                return { ...prevGrade, gradeInput: newValue };
                                              }
                                            }
                                          }
                                        }
                                        return prevGrade;
                                      });
                                      // To prevent re-renders if no actual change occurred in gradeInput for any course,
                                      // we should check if newGrades is referentially different.
                                      // However, map always returns a new array, so we must be careful.
                                      // A more robust check for deep equality would be ideal, but for now,
                                      // the conditional update within map for gradeInput itself reduces unnecessary object re-creations.
                                      return newGrades; // Return the new array
                                    });
                                  }}
                                  className="text-center h-8"
                                  placeholder="e.g. 1.75"
                                  maxLength={4} // Limit input to 4 characters (e.g., "5.00")
                                  readOnly={grade.isCredited || grade.isSubmitted} // Make read-only if credited or submitted
                                />
                              </TableCell>
                              <TableCell className="text-center py-2">{grade.units}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground py-2">
                              No previous grades found for the current semester.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                  <CardTitle className="text-base flex items-center">
                    <CheckCircle2 className="h-4 w-4 mr-2 text-muted-foreground" />
                    Eligible Courses for Next Semester ({studentProfile?.next_enrollment_period || "Loading..."})
                  </CardTitle>
                  <CardDescription>
                    Select courses you plan to enroll in for the next semester
                  </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {isAdvisingRequestSubmitted ? (
                    <div className="space-y-6">
                      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Advising Request Submitted</AlertTitle>
                        <AlertDescription>
                          Your course selections for the next semester have been submitted and are awaiting review by your advisor.
                        </AlertDescription>
                      </Alert>
                      {requestedCourses.length > 0 ? (
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="py-2">Code</TableHead>
                                <TableHead className="py-2">Title</TableHead>
                                <TableHead className="text-center py-2">Units</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {requestedCourses.map((course) => (
                                <TableRow key={course.id}>
                                  <TableCell className="font-medium py-2">{course.course_code}</TableCell>
                                  <TableCell className="py-2">{course.course_title}</TableCell>
                                  <TableCell className="text-center py-2">{course.units}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <Alert variant="info">
                          <Info className="h-4 w-4" />
                          <AlertTitle>No Courses Requested</AlertTitle>
                          <AlertDescription>
                            You did not select any courses for the next semester in your last request.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ) : isAdvisingRequestApproved ? (
                    <div className="space-y-6">
                      <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200">
                        <FileCheck className="h-4 w-4" />
                        <AlertTitle>Advising Request Approved</AlertTitle>
                        <AlertDescription>
                          Your course selections for the next semester have been approved by your advisor.
                          You may view your approved advising record in the "Advising Records" page.
                        </AlertDescription>
                      </Alert>
                      {requestedCourses.length > 0 ? (
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="py-2">Code</TableHead>
                                <TableHead className="py-2">Title</TableHead>
                                <TableHead className="text-center py-2">Units</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {requestedCourses.map((course) => (
                                <TableRow key={course.id}>
                                  <TableCell className="font-medium py-2">{course.course_code}</TableCell>
                                  <TableCell className="py-2">{course.course_title}</TableCell>
                                  <TableCell className="text-center py-2">{course.units}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <Alert variant="info">
                          <Info className="h-4 w-4" />
                          <AlertTitle>No Courses Requested</AlertTitle>
                          <AlertDescription>
                            You did not select any courses for the next semester in your last request.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ) : (
                    <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="eligible">Available Courses</TabsTrigger>
                        <TabsTrigger value="selected">Selected ({selectedCourses.length})</TabsTrigger>
                      </TabsList>

                      <TabsContent value="eligible">
                        <div className="flex justify-end mb-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (allEligibleSelected) {
                                setSelectedCourses(prev => prev.filter(id => !allSelectableEligibleCoursesIds.includes(id)));
                              } else {
                                setSelectedCourses(prev => [
                                  ...new Set([...prev, ...allSelectableEligibleCoursesIds])
                                ]);
                              }
                            }}
                            disabled={!eligibleCourses.length || (!allSelectableEligibleCoursesIds.length && !allEligibleSelected) || !activeAcademicYear?.id || !activeSemester?.id || !curriculumId || isOverallLoading || isAdvisingRequestSubmitted || isAdvisingRequestApproved}
                            className="h-8 px-4"
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
                                <TableHead className="py-2">Code</TableHead>
                                <TableHead className="py-2">Title</TableHead>
                                <TableHead className="text-center py-2">Units</TableHead>
                                <TableHead className="text-center py-2">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {eligibleCourses.length > 0 ? (
                                eligibleCourses.map((course) => {
                                  const canSelect = course.can_select;
                                  const prerequisiteReason = course.prerequisite_reason;
                                  const isSelected = selectedCourses.includes(course.id);

                                  return (
                                    <TableRow key={course.id}>
                                      <TableCell className="font-medium py-2">{course.course_code}</TableCell>
                                      <TableCell className="py-2">{course.course_title}</TableCell>
                                      <TableCell className="text-center py-2">{course.units}</TableCell>
                                      <TableCell className="text-center py-2">
                                        {canSelect ? (
                                          <Button
                                            variant={isSelected ? "secondary" : "outline"}
                                            size="sm"
                                            onClick={() => handleSelectCourse(course.id)}
                                            disabled={isSelected || isOverallLoading || isAdvisingRequestSubmitted || isAdvisingRequestApproved} // Disable if already selected or loading
                                            className="h-8"
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
                                                className="cursor-not-allowed h-8"
                                                disabled={isOverallLoading || isAdvisingRequestSubmitted || isAdvisingRequestApproved} // Disable if loading
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
                                  );
                                })
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground py-2">
                                    No eligible courses found for the next semester in the curriculum.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>

                      <TabsContent value="selected">
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="py-2">Code</TableHead>
                                <TableHead className="py-2">Title</TableHead>
                                <TableHead className="text-center py-2">Units</TableHead>
                                <TableHead className="text-center py-2">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedCourses.length > 0 ? (
                                selectedCourses.map((courseId) => {
                                  const course = eligibleCourses.find((c) => c.id === courseId)
                                  if (!course) return null
                                  return (
                                    <TableRow key={course.id}>
                                      <TableCell className="font-medium py-2">{course.course_code}</TableCell>
                                      <TableCell className="py-2">{course.course_title}</TableCell>
                                      <TableCell className="text-center py-2">{course.units}</TableCell>
                                      <TableCell className="text-center py-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleSelectCourse(course.id)}
                                          className="text-destructive hover:text-destructive h-8"
                                          disabled={isOverallLoading || isAdvisingRequestSubmitted || isAdvisingRequestApproved} // Disable if loading
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
                                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground py-2">
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
            </div>

            <div className="pt-4 border-t flex items-center justify-between">
              <div className="flex items-center text-sm text-muted-foreground">
                <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>
                  Total selected: {selectedCourses.length} course{selectedCourses.length !== 1 ? 's' : ''} ({totalSelectedUnits} units)
                </span>
              </div>
              <Button
                variant="green"
                onClick={handleSubmitAdvising}
                disabled={selectedCourses.length === 0 || !activeAcademicYear?.id || !activeSemester?.id || !curriculumId || isOverallLoading || isAdvisingRequestSubmitted || isAdvisingRequestApproved}
              >
                <FileCheck className="h-4 w-4 mr-2" />
                Submit for Advising
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Advising Submission</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit your grades and selected courses? Once submitted, 
              you will not be able to change your input for this advising period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button variant="green" onClick={confirmSubmitAdvising}>
              Confirm Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
