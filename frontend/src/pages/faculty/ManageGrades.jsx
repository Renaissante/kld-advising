import { useState, useEffect, useCallback } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { GradesInputTable } from "./GradesInputTable";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Search, Save, FileCheck, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActive } from "@/contexts/ActiveContext";

const ManageGrades = () => {
  const { user } = useAuth();
  const { activeAcademicYear, activeSemester } = useActive();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gradesChanged, setGradesChanged] = useState(false);

  const [activeTab, setActiveTab] = useState("current");
  const [selectedHistoricalAy, setSelectedHistoricalAy] = useState("");
  const [selectedHistoricalSem, setSelectedHistoricalSem] = useState("");

  const [allCourses, setAllCourses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add new state for course grade status
  const [courseGradeStatus, setCourseGradeStatus] = useState(null);

  // Fetch faculty courses
  const fetchCourses = useCallback(async () => {
    if (!user || user.role !== 'faculty') return;
    
    setCoursesLoading(true);
    setError(null);
    
    try {
      // Include faculty_id in URL for direct testing
      const response = await fetch(`http://localhost/kld-advising/backend/api/faculty/get_courses.php?faculty_id=${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setAllCourses(data.data);
        
        // Extract unique academic years and semesters for the filters
        const uniqueAcademicYears = [...new Set(data.data.map(course => course.ay))];
        const uniqueSemesters = [...new Set(data.data.map(course => course.sem))];
        
        // Create academic years array with id and year
        setAcademicYears(uniqueAcademicYears.map(year => ({
          id: year,
          year: year
        })));
        
        // Create semesters array with id and name
        setSemesters(uniqueSemesters.map(sem => ({
          id: sem,
          name: sem
        })));
      } else {
        setError(data.message || "Failed to fetch courses");
        toast.error(data.message || "Failed to fetch courses");
      }
    } catch (err) {
      console.error("Error fetching courses:", err);
      setError("Network error when fetching courses");
      toast.error("Network error when fetching courses");
    } finally {
      setCoursesLoading(false);
    }
  }, [user]);

  // Fetch courses on component mount
  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const getDisplayedCourses = () => {
    let coursesToDisplay = [];
    
    // Add debug logging
    console.log("Active AY:", activeAcademicYear?.year);
    console.log("Active Semester:", activeSemester?.name);
    console.log("Active Semester ID:", activeSemester?.id);
    console.log("All Courses:", allCourses);
    
    if (activeTab === "current") {
      // Filter for current semester courses using activeAcademicYear and activeSemester
      coursesToDisplay = allCourses.filter(course =>
        course.ay === activeAcademicYear?.year && course.sem === activeSemester?.name
      );
      console.log("Current semester courses:", coursesToDisplay);
    } else {
      // For the "all" tab (previous semesters)
      if (selectedHistoricalAy && selectedHistoricalSem) {
        // Filter based on selected historical values
        coursesToDisplay = allCourses.filter(course =>
          course.ay === selectedHistoricalAy && course.sem === selectedHistoricalSem
        );
        console.log("Selected historical courses:", coursesToDisplay);
      } else {
        // Show courses from previous semesters only
        // Convert values to ensure proper comparison
        const activeAY = activeAcademicYear?.year || "";
        const activeSemID = parseInt(activeSemester?.id) || 0;
        
        // First priority: courses from previous academic years
        const previousAYCourses = allCourses.filter(course => {
          // Compare as strings to handle academic year format like "2023-2024"
          return String(course.ay) < String(activeAY);
        });
        
        console.log("Previous AY courses:", previousAYCourses);
        
        // Second priority: courses from earlier semesters in the current academic year
        const currentAYPreviousSemCourses = allCourses.filter(course => {
          const courseSemID = parseInt(course.semester_id) || 0;
          return String(course.ay) === String(activeAY) && courseSemID < activeSemID;
        });
        
        console.log("Current AY previous semester courses:", currentAYPreviousSemCourses);
        
        // Combine both sets of courses
        coursesToDisplay = [...previousAYCourses, ...currentAYPreviousSemCourses];
        console.log("All previous courses:", coursesToDisplay);
      }
    }
    
    // Apply search filter
    const filteredCourses = coursesToDisplay.filter((course) =>
      course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    console.log("Filtered displayed courses:", filteredCourses);
    return filteredCourses;
  };

  const displayedCourses = getDisplayedCourses();

  // Fetch students for selected section
  const fetchStudents = async (courseId, sectionId) => {
    setLoading(true);
    setError(null);
    
    try {
      // Call API to get students for this course section
      const response = await fetch(`http://localhost/kld-advising/backend/api/faculty/get_students.php?course_id=${courseId}&section_id=${sectionId}${user?.id ? `&faculty_id=${user.id}` : ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setStudents(data.data || []);
      } else {
        throw new Error(data.message || "Failed to fetch students");
      }
    } catch (err) {
      console.error("Error fetching students:", err);
      setError("Failed to fetch students: " + err.message);
      toast.error("Failed to fetch students");
      setLoading(false);
    } finally {
      setLoading(false);
      setGradesChanged(false);
    }
  };

  useEffect(() => {
    if (selectedSection && selectedCourse) {
      fetchStudents(selectedCourse.id, selectedSection.id);
    } else {
      setStudents([]);
    }
  }, [selectedSection, selectedCourse]);

  const resetAndProceed = (action) => {
    if (gradesChanged) {
      if (window.confirm("You have unsaved changes. Do you want to discard them and proceed?")) {
        setGradesChanged(false);
        setSaving(false);
        setSubmitting(false);
        action();
      }
    } else {
      action();
    }
  };

  const handleTabChange = (value) => {
    resetAndProceed(() => {
      setActiveTab(value);
      setSelectedCourse(null);
      setSelectedSection(null);
      if (value !== 'all') {
        setSelectedHistoricalAy("");
        setSelectedHistoricalSem("");
      }
    });
  };

  const handleHistoricalAyChange = (year) => {
    resetAndProceed(() => {
      setSelectedHistoricalAy(year);
      setSelectedHistoricalSem("");
      setSelectedCourse(null);
      setSelectedSection(null);
    });
  };

  const handleHistoricalSemChange = (semesterName) => {
    // Prevent selecting current semester if the academic year is the same as current
    if (selectedHistoricalAy === activeAcademicYear?.year && semesterName === activeSemester?.name) {
      toast.error("Please select a different semester than the current one");
      return;
    }
    
    resetAndProceed(() => {
      setSelectedHistoricalSem(semesterName);
      setSelectedCourse(null);
      setSelectedSection(null);
    });
  };

  const handleCourseSelect = (course) => {
    resetAndProceed(() => {
      setSelectedCourse(course);
      setSelectedSection(null);
    });
  };

  const handleSectionSelect = (section) => {
    resetAndProceed(() => {
      setSelectedSection(section);
    });
  };

  const handleBackToCourses = () => {
    resetAndProceed(() => {
      setSelectedCourse(null);
      setSelectedSection(null);
    });
  };

  const handleGradeChange = (studentId, field, value) => {
    // For numeric fields (midterm and final), validate that input is a number
    if ((field === "midterm" || field === "final") && value !== "" && !/^\d*\.?\d*$/.test(value)) return;
    
    // For numeric fields, validate the range (0-100)
    if ((field === "midterm" || field === "final") && value !== "") {
      const numValue = parseFloat(value);
      if (numValue < 0 || numValue > 100) return;
    }

    setStudents((prevStudents) =>
      prevStudents.map((student) => {
        if (student.student_id === studentId) {
          const updatedStudent = { ...student, [field]: value };
          
          // Recalculate average if midterm or final changes
          if (field === "midterm" || field === "final") {
            const midtermStr = field === "midterm" ? value : student.midterm;
            const finalStr = field === "final" ? value : student.final;
            const midtermVal = parseFloat(midtermStr);
            const finalVal = parseFloat(finalStr);
            if (!isNaN(midtermVal) && !isNaN(finalVal) && midtermStr !== "" && finalStr !== "") {
               updatedStudent.average = ((midtermVal + finalVal) / 2).toFixed(2);
            } else {
              updatedStudent.average = "";
            }
          }
          return updatedStudent;
        }
        return student;
      })
    );
    setGradesChanged(true);
  };

  const handleSaveGrades = () => {
    setSaving(true);
    
    // Prepare data for API call
    const gradesData = {
      course_id: selectedCourse.id,
      section_id: selectedSection.id,
      academic_year_id: activeTab === 'current' ? activeAcademicYear?.id : selectedHistoricalAy,
      semester_id: activeTab === 'current' ? activeSemester?.id : selectedHistoricalSem,
      action: 'save',
      students: students
    };
    
    // Call save grades API
    fetch(`http://localhost/kld-advising/backend/api/faculty/save_grades.php${user?.id ? `?faculty_id=${user.id}` : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gradesData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        toast.success(data.message || "Grades saved successfully");
        setGradesChanged(false);
      } else {
        throw new Error(data.message || "Failed to save grades");
      }
    })
    .catch(error => {
      console.error("Error saving grades:", error);
      toast.error("Error: " + error.message);
    })
    .finally(() => {
      setSaving(false);
    });
  };

  const handleSubmitGrades = () => {
    // Check if all required fields are entered
    const allRequiredFieldsEntered = students.every(
      (student) => 
        student.midterm !== "" && 
        student.final !== "" && 
        !isNaN(parseFloat(student.midterm)) && 
        !isNaN(parseFloat(student.final)) &&
        student.remarks && student.remarks.trim() !== ""
    );
    
    if (!allRequiredFieldsEntered) {
      toast.error("Please enter valid Midterm, Final grades, and Remarks for all students before submitting.");
      return;
    }
    
    setSubmitting(true);
    
    // Prepare data for API call
    const gradesData = {
      course_id: selectedCourse.id,
      section_id: selectedSection.id,
      academic_year_id: activeTab === 'current' ? activeAcademicYear?.id : selectedHistoricalAy,
      semester_id: activeTab === 'current' ? activeSemester?.id : selectedHistoricalSem,
      action: 'submit',
      students: students
    };
    
    // Call submit grades API
    fetch(`http://localhost/kld-advising/backend/api/faculty/save_grades.php${user?.id ? `?faculty_id=${user.id}` : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gradesData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        toast.success(data.message || "Grades submitted successfully");
        setGradesChanged(false);
        
        // Refresh students data to get updated status
        fetchStudents(selectedCourse.id, selectedSection.id);
      } else {
        throw new Error(data.message || "Failed to submit grades");
      }
    })
    .catch(error => {
      console.error("Error submitting grades:", error);
      toast.error("Error: " + error.message);
    })
    .finally(() => {
      setSubmitting(false);
    });
  };

  // After the handleSectionChange function
  // Check if grades are already submitted for this section
  const checkGradeStatus = async (courseId, sectionId) => {
    try {
      const response = await fetch(`http://localhost/kld-advising/backend/api/faculty/get_grade_status.php?course_id=${courseId}&section_id=${sectionId}${user?.id ? `&faculty_id=${user.id}` : ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setCourseGradeStatus(data.status);
        return data.status;
      } else {
        setCourseGradeStatus(null);
        return null;
      }
    } catch (err) {
      console.error("Error checking grade status:", err);
      setCourseGradeStatus(null);
      return null;
    }
  };

  // Modify handleSectionChange to also check grade status
  const handleSectionChange = (e) => {
    const sectionId = e.target.value;
    setSelectedSection(sections.find((section) => section.id === sectionId));
    
    if (sectionId && selectedCourse) {
      fetchStudents(selectedCourse.id, sectionId);
      checkGradeStatus(selectedCourse.id, sectionId);
    }
  };

  return (
    <SidebarProvider>
      <Toaster />
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />

        <div className="container mx-auto p-4 md:p-6 mt-4">
          <div className="flex flex-col gap-6">
            {!selectedCourse && (
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Manage Grades</h1>
                <p className="text-muted-foreground">Select a course and section to view and manage student grades.</p>
              </div>
            )}

            {!selectedCourse && (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full md:w-auto">
                  <TabsList className="bg-muted/60 dark:bg-muted/30">
                    <TabsTrigger value="all">Previous Semesters</TabsTrigger>
                    <TabsTrigger value="current">Current Semester</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search courses..."
                    className="pl-8 w-full h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            )}

            {!selectedCourse ? (
              <Tabs value={activeTab} className="w-full">
                <TabsContent value="current" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle>Current Semester Courses</CardTitle>
                      <CardDescription>
                        Showing courses for A.Y. {activeAcademicYear?.year || 'N/A'} {activeSemester?.name || 'N/A'}. Select a course.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {coursesLoading ? (
                        <p className="text-center text-muted-foreground py-4">Loading courses...</p>
                      ) : displayedCourses.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {displayedCourses.map((course, index) => {
                            // Use index modulo 5 to cycle through 5 colors
                            const colorIndex = index % 5; 
                            let bgColorClass;
                            
                            // Apply different colors based on index
                            switch(colorIndex) {
                              case 0:
                                bgColorClass = "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600";
                                break;
                              case 1:
                                bgColorClass = "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600";
                                break;
                              case 2:
                                bgColorClass = "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600";
                                break;
                              case 3:
                                bgColorClass = "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600";
                                break;
                              case 4:
                                bgColorClass = "bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800 hover:border-pink-400 dark:hover:border-pink-600";
                                break;
                              default:
                                bgColorClass = "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600";
                            }
                            
                            return (
                              <div
                                key={course.id}
                                className={`p-4 rounded-lg border-2 h-full flex flex-col cursor-pointer transition-colors ${bgColorClass}`}
                                onClick={() => handleCourseSelect(course)}
                              >
                                <div className="font-semibold text-lg text-gray-800 dark:text-gray-100">{course.code}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{course.title}</div>
                                <div className="mt-auto text-xs text-gray-500 dark:text-gray-500">
                                  {course.sections?.length || 0} section{course.sections?.length !== 1 ? "s" : ""}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-4">No courses found for the current semester{searchQuery && ' matching your search'}.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="all" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle>Previous Semester Courses</CardTitle>
                      <CardDescription>Select an Academic Year and Semester to view past courses.</CardDescription>
                      <div className="flex flex-col sm:flex-row gap-4 mt-4">
                        <Select value={selectedHistoricalAy} onValueChange={handleHistoricalAyChange}>
                          <SelectTrigger className="w-full sm:w-[200px] h-9">
                            <SelectValue placeholder="Select Academic Year" />
                          </SelectTrigger>
                          <SelectContent>
                            {academicYears
                              // Only include academic years that have courses NOT in the current semester
                              .filter(ay => {
                                // For current AY, only show if it has courses in previous semesters
                                if (ay.year === activeAcademicYear?.year) {
                                  return allCourses.some(course => 
                                    course.ay === ay.year && 
                                    parseInt(course.semester_id) < parseInt(activeSemester?.id || 0)
                                  );
                                }
                                // For previous AYs, check if they have any courses
                                return allCourses.some(course => course.ay === ay.year);
                              })
                              .map(ay => (
                                <SelectItem key={ay.id} value={ay.year}>{ay.year}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Select value={selectedHistoricalSem} onValueChange={handleHistoricalSemChange} disabled={!selectedHistoricalAy}>
                          <SelectTrigger className="w-full sm:w-[200px] h-9">
                            <SelectValue placeholder={!selectedHistoricalAy ? "Select AY first" : "Select Semester"} />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedHistoricalAy === activeAcademicYear?.year 
                              ? semesters
                                  .filter(sem => sem.name !== activeSemester?.name)
                                  .map(sem => (
                                    <SelectItem key={sem.id} value={sem.name}>{sem.name}</SelectItem>
                                  ))
                              : semesters.map(sem => (
                                  <SelectItem key={sem.id} value={sem.name}>{sem.name}</SelectItem>
                                ))
                            }
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {(selectedHistoricalAy && selectedHistoricalSem) ? (
                        coursesLoading ? (
                          <p className="text-center text-muted-foreground py-4">Loading courses...</p>
                        ) : displayedCourses.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {displayedCourses.map((course, index) => {
                              // Use index modulo 5 to cycle through 5 colors
                              const colorIndex = index % 5; 
                              let bgColorClass;
                              
                              // Apply different colors based on index
                              switch(colorIndex) {
                                case 0:
                                  bgColorClass = "bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800 hover:border-sky-400 dark:hover:border-sky-600";
                                  break;
                                case 1:
                                  bgColorClass = "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600";
                                  break;
                                case 2:
                                  bgColorClass = "bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800 hover:border-teal-400 dark:hover:border-teal-600";
                                  break;
                                case 3:
                                  bgColorClass = "bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600";
                                  break;
                                case 4:
                                  bgColorClass = "bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 hover:border-rose-400 dark:hover:border-rose-600";
                                  break;
                                default:
                                  bgColorClass = "bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800 hover:border-sky-400 dark:hover:border-sky-600";
                              }
                              
                              return (
                                <div
                                  key={course.id}
                                  className={`p-4 rounded-lg border-2 h-full flex flex-col cursor-pointer transition-colors ${bgColorClass}`}
                                  onClick={() => handleCourseSelect(course)}
                                >
                                  <div className="font-semibold text-lg text-gray-800 dark:text-gray-100">{course.code}</div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{course.title}</div>
                                  <div className="mt-auto text-xs text-gray-500 dark:text-gray-500">
                                    {course.sections?.length || 0} section{course.sections?.length !== 1 ? "s" : ""}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-4">No courses found for {selectedHistoricalAy} {selectedHistoricalSem}{searchQuery && ' matching your search'}.</p>
                        )
                      ) : (
                        <p className="text-center text-muted-foreground py-4">Please select an Academic Year and Semester to view previous semester courses.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="grid gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="mb-2">
                          {selectedCourse.code}: {selectedCourse.title}
                        </CardTitle>
                        <CardDescription>
                          {activeTab === 'current'
                            ? `Sections for Current Semester (A.Y. ${activeAcademicYear?.year || 'N/A'} ${activeSemester?.name || 'N/A'}). Select a section.`
                            : `Sections for A.Y. ${selectedCourse.ay || 'N/A'} ${selectedCourse.sem || 'N/A'}. Select a section.`
                          }
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleBackToCourses}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Courses
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedCourse.sections?.map((section) => (
                        <Badge
                          key={section.id}
                          variant={selectedSection?.id === section.id ? "default" : "outline"}
                          className={`cursor-pointer text-sm py-1 px-2.5 ${selectedSection?.id === section.id ? 'bg-[#1b4b2a] hover:bg-[#1b4b2a]/90 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white' : ''}`}
                          onClick={() => handleSectionSelect(section)}
                        >
                          {section.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {selectedSection && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <CardTitle className="mb-2">Grades for: {selectedSection.name}</CardTitle>
                          <CardDescription>Enter Midterm and Final grades (0-100).</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={handleSaveGrades} disabled={saving || !gradesChanged || submitting}>
                            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save</>}
                          </Button>
                          <Button variant="green" onClick={handleSubmitGrades} disabled={submitting || !gradesChanged || saving}>
                            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : <><FileCheck className="h-4 w-4 mr-2" />Submit Grades</>}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {error ? (
                        <div className="text-center text-red-500 py-4">{error}</div>
                      ) : (
                        <GradesInputTable
                          students={students}
                          loading={loading}
                          onGradeChange={handleGradeChange}
                        />
                      )}
                    </CardContent>
                  </Card>
                )}

                {selectedSection && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md">
                    <h3 className="text-sm font-medium text-gray-700">Grade Status:</h3>
                    <div className="mt-1">
                      {courseGradeStatus === 'submitted' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Submitted
                        </span>
                      ) : courseGradeStatus === 'saved' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Saved (Not Submitted)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Not Started
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {courseGradeStatus === 'submitted' && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-md">
                    <p className="text-sm text-yellow-700">
                      These grades have been submitted. Contact the registrar if you need to make changes.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default ManageGrades;
