import React, { useState, useEffect } from 'react';
import { Table, TableHead, TableRow, TableHeader, TableCell, TableBody, TableFooter } from "@/components/ui/table";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL } from '@/config/api';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/App-sidebar';
import Header from '@/components/layout/Header';
import { Skeleton } from "@/components/ui/skeleton"; // For loading state

// --- Helper function (copied from Curriculum.jsx) ---
const formatPrerequisites = (prerequisites = []) => {
  if (!Array.isArray(prerequisites) || prerequisites.length === 0) {
    return '';
  }

  const formattedCodes = [];
  const processedIds = new Set();

  for (let i = 0; i < prerequisites.length; i++) {
    const currentPrereq = prerequisites[i];
    // Ensure currentPrereq is an object and has course_code property
    if (typeof currentPrereq === 'object' && currentPrereq !== null && currentPrereq.course_code) {
      const currentCode = currentPrereq.course_code;
      let pairFound = false;

      if (currentCode.endsWith('L') && currentCode.length > 1) {
        const baseCode = currentCode.slice(0, -1);
        const pair = prerequisites.find(p =>
          typeof p === 'object' && p !== null && p.course_code === baseCode && !processedIds.has(p.id)
        );
        if (pair) {
          formattedCodes.push(`${baseCode}/L`);
          processedIds.add(currentPrereq.id);
          processedIds.add(pair.id);
          pairFound = true;
        }
      } else {
        const labCode = `${currentCode}L`;
        const pair = prerequisites.find(p =>
          typeof p === 'object' && p !== null && p.course_code === labCode && !processedIds.has(p.id)
        );
        if (pair) {
          formattedCodes.push(`${currentCode}/L`);
          processedIds.add(currentPrereq.id);
          processedIds.add(pair.id);
          pairFound = true;
        }
      }

      if (!pairFound) {
        formattedCodes.push(currentCode);
        processedIds.add(currentPrereq.id);
      }
    }
  }

  return formattedCodes.sort((a, b) => a.localeCompare(b)).join(', ');
};

// --- Component ---
const StudentCurriculum = () => {
  // --- State Variables ---
  const [curriculumData, setCurriculumData] = useState({ // Use an object to hold all curriculum data
    curriculumName: null,
    yearLevels: [],
    semesters: [],
    courses: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Get student_id from localStorage ---
  const studentId = localStorage.getItem('studentId');

  // --- Fetch Data using fetch API ---
  useEffect(() => {
    const fetchCurriculumData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Use fetch API with student_id as query parameter
        const response = await fetch(`${API_BASE_URL}/student/get_curriculum.php?student_id=${studentId}`, {
             credentials: 'include' // Send cookies for session-based auth
        });

        // Check if the request was successful (status code 200-299)
        if (!response.ok) {
          // Try to parse error message from response body, otherwise use status text
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (jsonError) {
            // If response is not JSON or empty, use the status text
            errorMessage = response.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        // Parse the JSON response body
        const data = await response.json();
        console.log("Full response data from backend:", data); // Log the entire response

        // Assuming the backend now returns curriculumName, yearLevels, semesters, and courses
        setCurriculumData(data);
        console.log("Curriculum Data state after update:", curriculumData); // Log state after update

      } catch (err) {
        console.error("Error fetching curriculum data:", err);
        // Use the error message caught
        setError(err.message || 'Failed to fetch curriculum data. Please check your connection or contact support.');
        setCurriculumData({ curriculumName: null, yearLevels: [], semesters: [], courses: [] }); // Reset data on error
      } finally {
        setIsLoading(false);
      }
    };

    if (studentId) {
      fetchCurriculumData();
    } else {
      setError('Student ID not found. Please log in.');
      setIsLoading(false);
    }
  }, [studentId]); // Dependency array includes studentId

  // --- Destructure fetched data ---
  const { curriculumName, yearLevels, semesters, courses } = curriculumData;
  console.log("Curriculum Name object:", curriculumName); // Log curriculumName object
  console.log("Courses array:", courses); // Log courses array

  // Calculate full year span (handle potential null curriculumName)
  const academicYear = curriculumName?.academicYear || "";
  const startYear = academicYear.split('-')[0];
  // Adjust year span calculation if needed based on your program length logic
  const endYear = startYear ? parseInt(startYear) + (yearLevels?.length > 0 ? yearLevels.length : 4) -1 : null;
  const fullYearSpan = startYear && endYear ? `${startYear}-${endYear}` : academicYear;


  // Filter courses for a specific semester (using fetched data)
  const getCoursesForSemester = (yearLevelId, semesterId) => {
    return courses?.filter(
      course => String(course.year_level_id) === String(yearLevelId) && String(course.semester_id) === String(semesterId)
    );
  };

  const getPrerequisiteCourses = (prerequisiteIds) => {
    return courses?.filter(course => prerequisiteIds.includes(String(course.id)));
  };


  // --- Render Loading State ---
  if (isLoading) {
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
  if (error) {
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
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />

        <div className="p-4">
          <div className="max-w-7xl mx-auto">
            <div className="border rounded-md p-4 shadow-lg">
              {/* Curriculum Title Section - Use fetched data */}
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-[#1b4b2a]">{curriculumName?.name || 'Curriculum'}</h2>
                <p className="text-sm text-gray-600">{curriculumName?.program || 'Program'} | {fullYearSpan || 'Academic Year'}</p>
              </div>

              {/* Semester Cards Section - Use fetched data */}
              <div>
                {yearLevels?.length === 0 && semesters?.length === 0 && courses?.length === 0 && !isLoading && !error && (
                   <Card className="p-4 text-center text-muted-foreground border">
                    No curriculum data available for this student.
                  </Card>
                )}
                {yearLevels?.map((yearLevel) => (
                  <div key={yearLevel.id}>
                    {semesters?.map((semester) => {
                      const semesterCourses = getCoursesForSemester(yearLevel.id, semester.id);
                      if (!semesterCourses || semesterCourses.length === 0) return null;

                      // Calculate totals (logic remains the same, uses filtered semesterCourses)
                      const totalLecUnits = semesterCourses.reduce((sum, course) => sum + (parseFloat(course.unit_lec) || 0), 0);
                      const totalLabUnits = semesterCourses.reduce((sum, course) => sum + (parseFloat(course.unit_lab) || 0), 0);
                      const totalLecHours = semesterCourses.reduce((sum, course) => sum + (parseFloat(course.hour_lec) || 0), 0);
                      const totalLabHours = semesterCourses.reduce((sum, course) => sum + (parseFloat(course.hour_lab) || 0), 0);
                      const totalHours = totalLecHours + totalLabHours;

                      return (
                        <Card key={`${yearLevel.id}-${semester.id}`} className="mb-4">
                          <CardHeader className="bg-[#1b4b2a] text-white py-2 px-4 rounded-t-lg">
                            <h2 className="text-base font-semibold">{yearLevel.name} - {semester.name}</h2>
                          </CardHeader>
                          <div className="p-4">
                            <Table className="border">
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead rowSpan={2} className="align-bottom border-r w-20 text-center">Grade</TableHead>
                                  <TableHead rowSpan={2} className="align-bottom border-r">Course Code</TableHead>
                                  <TableHead rowSpan={2} className="align-bottom border-r">Course Title</TableHead>
                                  <TableHead colSpan={2} className="text-center border-b border-r">Course Unit</TableHead>
                                  <TableHead colSpan={2} className="text-center border-b border-r">Credit Hours</TableHead>
                                  <TableHead rowSpan={2} className="align-bottom border-r">Prerequisite(s)</TableHead>
                                </TableRow>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="text-center w-24 border-r">Lec</TableHead>
                                  <TableHead className="text-center w-24 border-r">Lab</TableHead>
                                  <TableHead className="text-center w-24 border-r">Lec</TableHead>
                                  <TableHead className="text-center w-24 border-r">Lab</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {semesterCourses.map((course) => {
                                  const prerequisiteCourses = getPrerequisiteCourses(course.prerequisite_ids);

                                  console.log(`Course: ${course.course_code}`);
                                  console.log("Prerequisite IDs:", course.prerequisite_ids);
                                  console.log("Prerequisite Courses:", prerequisiteCourses);

                                  return (
                                    <TableRow key={`${course.id}-${course.course_code}`}>
                                      {/* Display fetched grade or '-' */}
                                      <TableCell className="border-r text-center font-medium">{course.grade ?? ''}</TableCell>
                                      <TableCell className="border-r">{course.course_code}</TableCell>
                                      <TableCell className="border-r">{course.course_title}</TableCell>
                                      <TableCell className="text-center border-r">{course.unit_lec}</TableCell>
                                      <TableCell className="text-center border-r">{course.unit_lab}</TableCell>
                                      <TableCell className="text-center border-r">{course.hour_lec}</TableCell>
                                      <TableCell className="text-center border-r">{course.hour_lab}</TableCell>
                                      {/* Use fetched prerequisites */}
                                      <TableCell className="border-r">{formatPrerequisites(prerequisiteCourses)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                              <TableFooter>
                                <TableRow className="font-semibold border-t border-border bg-[#f0f5f0]">
                                  <TableCell className="border-r"></TableCell>
                                  <TableCell className="border-r">TOTAL CREDIT HOURS</TableCell>
                                  <TableCell className="border-r text-center">{totalHours.toFixed(1)}</TableCell>
                                  <TableCell className="text-center border-r">{totalLecUnits.toFixed(1)}</TableCell>
                                  <TableCell className="text-center border-r">{totalLabUnits.toFixed(1)}</TableCell>
                                  <TableCell className="text-center border-r">{totalLecHours.toFixed(1)}</TableCell>
                                  <TableCell className="text-center border-r">{totalLabHours.toFixed(1)}</TableCell>
                                  <TableCell className="border-r"></TableCell>
                                </TableRow>
                              </TableFooter>
                            </Table>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default StudentCurriculum;