import React, { useState, useEffect } from "react"
import { Table, TableHead, TableRow, TableHeader, TableCell, TableBody, TableFooter } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/App-sidebar"
import Header from "@/components/layout/Header"
import { Toaster } from "@/components/ui/sonner"
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { Skeleton } from "@/components/ui/skeleton";
import { useParams } from 'react-router-dom'; // Import useParams
import { toast } from "sonner"; // Import toast for notifications
import { useActive } from "@/contexts/ActiveContext"; // Import useActive hook
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"

// --- Helper function for formatting prerequisites ---
const formatPrerequisites = (prerequisiteIds, allCourses) => {
  if (!Array.isArray(prerequisiteIds) || prerequisiteIds.length === 0) {
    return ""
  }

  const courseCodeMap = {}
  allCourses.forEach((course) => {
    courseCodeMap[course.id] = course.course_code
  })

  return prerequisiteIds
    .map((id) => courseCodeMap[id] || "")
    .filter((code) => code)
    .sort()
    .join(", ")
}

// --- Main Component ---
const CreditCourses = () => {
  const [curriculumData, setCurriculumData] = useState({ // Use an object to hold all curriculum data
    curriculumName: null,
    yearLevels: [],
    semesters: [],
    courses: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grades, setGrades] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const navigate = useNavigate();
  const { activeAcademicYear, activeSemester, loading: activeLoading } = useActive(); // Use useActive hook

  // --- Get student_id from localStorage (temporary for now) ---
  const studentId = useParams().studentId; // Get studentId from URL parameters

  // Combine local loading with active context loading
  const isOverallLoading = isLoading || activeLoading;

  // --- Fetch Data using fetch API ---
  useEffect(() => {
    const fetchCurriculumData = async () => {
      // Only proceed with fetching student data if necessary IDs are available and active context is NOT loading
      if (!studentId || !activeAcademicYear?.id || !activeSemester?.id || activeLoading) {
        // If activeLoading is true, we simply return. The component remains in a loading state
        // due to isOverallLoading (which includes activeLoading).
        // No need to set setIsLoading(false) here, as it would cause an unnecessary state update/re-render.
        if (!activeLoading) {
            // Only set error if not actively loading from context, to avoid premature error messages
            setError("Missing student ID or active academic period information.");
            setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/student/get_curriculum.php?student_id=${studentId}&active_academic_year_id=${activeAcademicYear.id}&active_semester_id=${activeSemester.id}`, {
             credentials: 'include'
        });

        if (!response.ok) {
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (jsonError) {
            errorMessage = response.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log("Full response data from backend:", data);
        setCurriculumData(data);
        // Initialize grades from fetched data
        const initialGrades = {};
        data.courses.forEach(course => {
            // Only initialize grade if it's verified
            if (course.grade && course.is_verified) {
                initialGrades[course.id] = course.grade;
            }
        });
        setGrades(initialGrades);

      } catch (err) {
        console.error("Error fetching curriculum data:", err);
        setError(err.message || 'Failed to fetch curriculum data. Please check your connection or contact support.');
        setCurriculumData({ curriculumName: null, yearLevels: [], semesters: [], courses: [] });
      } finally {
        setIsLoading(false);
      }
    };

    if (studentId && activeAcademicYear?.id && activeSemester?.id && !activeLoading) {
      fetchCurriculumData();
    } else if (!activeLoading) { // Only set error if not actively loading from context
      setError('Missing student ID or active academic period information.');
      setIsLoading(false);
    }
  }, [studentId, activeAcademicYear?.id, activeSemester?.id, activeLoading]);

  // --- Destructure fetched data ---
  const { curriculumName, yearLevels, semesters, courses } = curriculumData;

  // Handle grade input change
  const handleGradeChange = (courseId, value) => {
    setGrades((prev) => ({
      ...prev,
      [courseId]: value,
    }))
  }

  const executeSaveGrades = async () => {
    setIsSaving(true);
    setShowConfirmDialog(false); // Close dialog once action is confirmed and started
    try {
      // Prepare the data to be sent to the API
      const gradesToSave = Object.keys(grades).map(courseId => ({
          course_id: courseId,
          grade: grades[courseId]
      }));

      const response = await fetch(`${API_BASE_URL}/faculty/save_credited_courses.php`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              student_id: studentId,
              grades: gradesToSave,
          }),
          credentials: 'include'
      });

      if (!response.ok) {
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorMessage;
          } catch (jsonError) { /* Ignore */ }
          throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result.message) {
        toast.success(result.message); // Display success toast
      }

      // After successful save, refresh curriculum data to display updated grades
      const updatedCourses = courses.map((course) => ({
        ...course,
        grade: grades[course.id] || course.grade,
      }))
      setCurriculumData(prev => ({ ...prev, courses: updatedCourses }));

      console.log("[v0] Grades saved:", grades)
    } catch (err) {
        console.error("Error saving grades:", err);
        toast.error(`Failed to save grades: ${err.message}`); // Display error toast
    } finally {
      setIsSaving(false)
    }
  };

  const handleSaveGradesClick = () => {
    setShowConfirmDialog(true);
  };

  // Calculate totals - these will be replaced by semester-specific totals in the rendering logic
  const totalLecUnits = courses.reduce(
    (sum, course) => sum + (Number.parseFloat(String(course.unit_lec)) || 0),
    0,
  )
  const totalLabUnits = courses.reduce(
    (sum, course) => sum + (Number.parseFloat(String(course.unit_lab)) || 0),
    0,
  )
  const totalLecHours = courses.reduce(
    (sum, course) => sum + (Number.parseFloat(String(course.hour_lec)) || 0),
    0,
  )
  const totalLabHours = courses.reduce(
    (sum, course) => sum + (Number.parseFloat(String(course.hour_lab)) || 0),
    0,
  )
  const totalHours = totalLecHours + totalLabHours

  // Helper to get year/semester label
  const getYearSemesterLabel = (yearLevelId, semesterId) => {
    const yearLabel = yearLevels.find(yl => String(yl.id) === String(yearLevelId))?.name || "Year";
    const semesterLabel = semesters.find(s => String(s.id) === String(semesterId))?.name || "Semester";
    return `${yearLabel} - ${semesterLabel}`;
  }

  // Grouping by year and semester (using fetched data)
  const groupedCourses = courses.reduce(
    (acc, course) => {
      const key = `${course.year_level_id}-${course.semester_id}`
      if (!acc[key]) {
        acc[key] = {
          yearLevelId: course.year_level_id,
          semesterId: course.semester_id,
          courses: [],
        }
      }
      acc[key].courses.push(course)
      return acc
    },
    {},
  )

  const sortedGroups = Object.values(groupedCourses).sort((a, b) => {
    const yearDiff = Number.parseInt(a.yearLevelId) - Number.parseInt(b.yearLevelId)
    return yearDiff !== 0 ? yearDiff : Number.parseInt(a.semesterId) - Number.parseInt(b.semesterId)
  })

  // Calculate full year span (handle potential null curriculumName)
  const academicYear = curriculumName?.academicYear || "";
  const startYear = academicYear.split('-')[0];
  const endYear = startYear ? parseInt(startYear) + (yearLevels?.length > 0 ? yearLevels.length : 4) -1 : null;
  const fullYearSpan = startYear && endYear ? `${startYear}-${endYear}` : academicYear;

  // --- Render Loading State ---
  if (isOverallLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="w-full">
          <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
          <div className="p-4 max-w-5xl mx-auto">
             <div className="border rounded-md p-4 shadow-lg space-y-4">
                <Skeleton className="h-8 w-3/4 mb-1" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-64 w-full mb-4" />
                <Skeleton className="h-64 w-full" />
             </div>
          </div>
        </main>
      </SidebarProvider>
    );
  }

  // --- Render Error State ---
  if (error || (isOverallLoading && !studentId)) {
     return (
      <SidebarProvider>
        <AppSidebar />
        <main className="w-full">
          <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
          <div className="p-4 max-w-5xl mx-auto">
             
             <div className="border rounded-md p-4 shadow-lg text-center text-red-600">
                <p>Error loading curriculum:</p>
                <p>{error}</p>
             </div>
          </div>
        </main>
      </SidebarProvider>
    );
  }


  return (
    <SidebarProvider>
      <Toaster richColors position="bottom-right" />
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />

        <div className="container mx-auto p-4 md:p-6 mt-4">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="text-gray-600 hover:bg-gray-100 dark:text-emerald-300 dark:hover:bg-gray-800"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Credit Courses</h1>
              </div>
              <p className="text-muted-foreground">Assign course credits for students</p>
            </div>

            <div className="p-6">
              <div className="max-w-7xl mx-auto">
              <div className="pb-4">
                    <h2 className="text-lg font-semibold text-[#1b4b2a] dark:text-emerald-300">{curriculumName?.studentName || "Student Name"}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Student ID: {studentId}</p>
                   
                  </div>
                <div className="">
                  {/* Section Title */}
                 

                  <div className="overflow-x-auto">
                    {sortedGroups.map((group) => (
                      <div key={`${group.yearLevelId}-${group.semesterId}`} className="mb-6 border rounded-md shadow-lg overflow-hidden">
                        <div className="bg-[#e8f0e8] dark:bg-gray-800 border-y py-2 px-4">
                          <span className="font-semibold text-[#1b4b2a] dark:text-emerald-300 text-sm">
                            {getYearSemesterLabel(group.yearLevelId, group.semesterId)}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <Table className="border-collapse">
                            <TableHeader>
                              <TableRow>
                                <TableHead rowSpan={2} className="align-bottom border-r w-20 text-center text-xs font-semibold">
                                  Grade
                                </TableHead>
                                <TableHead rowSpan={2} className="align-bottom border-r text-xs font-semibold">Course Code</TableHead>
                                <TableHead rowSpan={2} className="align-bottom border-r text-xs font-semibold">Course Title</TableHead>
                                <TableHead colSpan={2} className="text-center border-b border-r text-xs font-semibold">
                                  Course Unit
                                </TableHead>
                                <TableHead colSpan={2} className="text-center border-b border-r text-xs font-semibold">
                                  Credit Hours
                                </TableHead>
                                <TableHead rowSpan={2} className="align-bottom border-r text-xs font-semibold">Prerequisite(s)</TableHead>
                              </TableRow>
                              <TableRow>
                                <TableHead className="text-center w-24 border-r text-xs">Lec</TableHead>
                                <TableHead className="text-center w-24 border-r text-xs">Lab</TableHead>
                                <TableHead className="text-center w-24 border-r text-xs">Lec</TableHead>
                                <TableHead className="text-center w-24 border-r text-xs">Lab</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {/* Course Rows */}
                              {group.courses.map((course) => (
                                <TableRow key={course.id}>
                                  <TableCell className="border-r text-center p-2">
                                    <Input
                                      type="text"
                                      value={grades[course.id] !== undefined ? grades[course.id] : (course.is_verified ? (course.grade || "") : "")}
                                      onChange={(e) => handleGradeChange(course.id, e.target.value)}
                                      placeholder="—"
                                      className="text-center text-sm h-8"
                                      maxLength={4}
                                    />
                                  </TableCell>
                                  <TableCell className="border-r">{course.course_code}</TableCell>
                                  <TableCell className="border-r">{course.course_title}</TableCell>
                                  <TableCell className="text-center border-r">{course.unit_lec}</TableCell>
                                  <TableCell className="text-center border-r">{course.unit_lab}</TableCell>
                                  <TableCell className="text-center border-r">{course.hour_lec}</TableCell>
                                  <TableCell className="text-center border-r">{course.hour_lab}</TableCell>
                                  <TableCell className="border-r">
                                    {formatPrerequisites(course.prerequisite_ids, courses)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                            <TableFooter>
                              {(() => {
                                const semesterLecUnits = group.courses.reduce(
                                  (sum, course) => sum + (Number.parseFloat(String(course.unit_lec)) || 0),
                                  0,
                                )
                                const semesterLabUnits = group.courses.reduce(
                                  (sum, course) => sum + (Number.parseFloat(String(course.unit_lab)) || 0),
                                  0,
                                )
                                const semesterLecHours = group.courses.reduce(
                                  (sum, course) => sum + (Number.parseFloat(String(course.hour_lec)) || 0),
                                  0,
                                )
                                const semesterLabHours = group.courses.reduce(
                                  (sum, course) => sum + (Number.parseFloat(String(course.hour_lab)) || 0),
                                  0,
                                )
                                const semesterTotalHours = semesterLecHours + semesterLabHours
                                return (
                                  <TableRow className="font-semibold border-t border-border bg-[#f0f5f0] dark:bg-gray-800">
                                    <TableCell className="border-r"></TableCell>
                                    <TableCell className="border-r text-center">TOTAL</TableCell>
                                    <TableCell className="border-r text-center">{semesterTotalHours.toFixed(1)}</TableCell>
                                    <TableCell className="text-center border-r">{semesterLecUnits.toFixed(1)}</TableCell>
                                    <TableCell className="text-center border-r">{semesterLabUnits.toFixed(1)}</TableCell>
                                    <TableCell className="text-center border-r">{semesterLecHours.toFixed(1)}</TableCell>
                                    <TableCell className="text-center border-r">{semesterLabHours.toFixed(1)}</TableCell>
                                    <TableCell className="border-r"></TableCell>
                                  </TableRow>
                                )
                              })()}
                            </TableFooter>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 mt-0 px-6 py-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setGrades({})
                      }}
                    >
                      Reset
                    </Button>
                    
                    <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                      <DialogTrigger asChild>
                        <Button
                          onClick={handleSaveGradesClick}
                          disabled={isSaving}
                          className="bg-[#1b4b2a] hover:bg-[#153d22] text-white"
                        >
                          {isSaving ? "Saving..." : "Save Grades"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Confirm Save</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to save these credited courses? This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                          </DialogClose>
                          <Button
                            onClick={executeSaveGrades}
                            disabled={isSaving}
                            className="bg-[#1b4b2a] hover:bg-[#153d22] text-white"
                          >
                            {isSaving ? "Saving..." : "Confirm Save"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}

export default CreditCourses