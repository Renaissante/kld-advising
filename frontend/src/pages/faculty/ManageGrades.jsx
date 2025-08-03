import { useState, useEffect, useCallback, useRef } from "react";
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
import * as XLSX from "xlsx";
import { API_BASE_URL } from '@/config/api'; 
const ManageGrades = () => {
  const { user } = useAuth();
  const { activeAcademicYear, activeSemester } = useActive();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [gradesChanged, setGradesChanged] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [activeTab, setActiveTab] = useState("current");
  const [selectedHistoricalAy, setSelectedHistoricalAy] = useState("");
  const [selectedHistoricalSem, setSelectedHistoricalSem] = useState("");

  const [allCourses, setAllCourses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [error, setError] = useState(null);


  // Reference for the hidden file input
  const fileInputRef = useRef(null);


  // Fetch faculty courses
  const fetchCourses = useCallback(async () => {
    if (!user || user.role !== 'faculty') return;

    setCoursesLoading(true);
    setError(null);

    try {
      // Include faculty_id in URL for direct testing
      const response = await fetch(`${API_BASE_URL}/faculty/get_courses.php?faculty_id=${user.id}`, {
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
          id: year, // Assuming AY is unique enough for ID here
          year: year
        })));

        // Create semesters array with id and name
        setSemesters(uniqueSemesters.map(sem => ({
          id: sem, // Assuming semester name is unique enough for ID here
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

  
    // console.log("Active AY:", activeAcademicYear?.year);
    // console.log("Active Semester:", activeSemester?.name);
    // console.log("Active Semester ID:", activeSemester?.id);
    // console.log("All Courses:", allCourses);

    if (activeTab === "current") {
      // Filter for current semester courses using activeAcademicYear and activeSemester
      coursesToDisplay = allCourses.filter(course =>
        course.ay === activeAcademicYear?.year && course.sem === activeSemester?.name
      );
      // console.log("Current semester courses:", coursesToDisplay);
    } else {
      // For the "all" tab (previous semesters)
      if (selectedHistoricalAy && selectedHistoricalSem) {
        // Filter based on selected historical values
        coursesToDisplay = allCourses.filter(course =>
          course.ay === selectedHistoricalAy && course.sem === selectedHistoricalSem
        );
        // console.log("Selected historical courses:", coursesToDisplay);
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

        // console.log("Previous AY courses:", previousAYCourses);

        // Second priority: courses from earlier semesters in the current academic year
        const currentAYPreviousSemCourses = allCourses.filter(course => {
          const courseSemID = parseInt(course.semester_id) || 0;
          return String(course.ay) === String(activeAY) && courseSemID < activeSemID;
        });

        // console.log("Current AY previous semester courses:", currentAYPreviousSemCourses);

        // Combine both sets of courses
        coursesToDisplay = [...previousAYCourses, ...currentAYPreviousSemCourses];
        // console.log("All previous courses:", coursesToDisplay);
      }
    }

    // Apply search filter
    const filteredCourses = coursesToDisplay.filter((course) =>
      course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // console.log("Filtered displayed courses:", filteredCourses);
    return filteredCourses;
  };

  const displayedCourses = getDisplayedCourses();

  // Fetch students for selected section
  const fetchStudents = async (courseId, sectionId) => {
    setLoading(true);
    setError(null);

    try {
      // Call API to get students for this course section
      const response = await fetch(`${API_BASE_URL}/faculty/get_students.php?course_id=${courseId}&section_id=${sectionId}${user?.id ? `&faculty_id=${user.id}` : ''}`, {
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
        // Initialize students with fetched data, ensuring new fields exist
        setStudents(data.data.map(student => ({
            ...student,
            midterm: student.midterm === '' ? null : parseFloat(student.midterm), // Ensure numeric is float or null
            final: student.final === '' ? null : parseFloat(student.final), // Ensure numeric is float or null
            midterm_status: student.midterm_status === '' ? null : student.midterm_status, // Ensure status is string or null
            final_status: student.final_status === '' ? null : student.final_status, // Ensure status is string or null
            // average, transmutation, remarks will be calculated in GradesInputTable
        })) || []);
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
  }, [selectedSection, selectedCourse, user?.id]); // Added user.id dependency

  const resetAndProceed = (action) => {
    if (gradesChanged) {
      if (window.confirm("You have unsaved changes. Do you want to discard them and proceed?")) {
        setGradesChanged(false);
        setSaving(false);
        setIsUploading(false);
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
    setStudents((prevStudents) =>
      prevStudents.map((student) => {
        if (student.student_id === studentId) {
          let updatedStudent = { ...student };
          const trimmedValue = value ? String(value).trim() : "";
          const lowerValue = trimmedValue.toLowerCase();
          const allowedText = ["ud", "od"];

          if (field === "midterm") {
            // Allow any input to update the state temporarily
            // Validation will happen on save
            updatedStudent.midterm = trimmedValue; // Store raw string input
            updatedStudent.midterm_status = null; // Clear status on input change

            // If the input is exactly UD or OD (case-insensitive),
            // auto-set the final status as well for immediate feedback,
            // but the main validation is on save.
            if (allowedText.includes(lowerValue)) {
                 updatedStudent.midterm_status = lowerValue.toUpperCase();
                 updatedStudent.midterm = null; // Clear numeric if it's UD/OD text
                 updatedStudent.final_status = lowerValue.toUpperCase();
                 updatedStudent.final = null; // Clear final numeric if midterm is UD/OD text
            } else {
                // If not UD/OD text, try parsing as number for immediate feedback
                const numValue = parseFloat(trimmedValue);
                if (trimmedValue === "" || (!isNaN(numValue) && numValue >= 0 && numValue <= 100)) {
                    updatedStudent.midterm = trimmedValue === "" ? null : numValue;
                    updatedStudent.midterm_status = null;
                } else {
                    // If it's other text or invalid number, store the raw string
                    updatedStudent.midterm = trimmedValue;
                    updatedStudent.midterm_status = null;
                }
                 // Ensure final status is cleared if midterm is not UD/OD text
                 if (allowedText.includes(String(student.midterm_status || "").toLowerCase())) {
                     updatedStudent.final_status = null;
                     // Do NOT clear final numeric value here, let the user input it
                 }
            }


          } else if (field === "final") {
             // Allow any input to update the state temporarily
             // Validation will happen on save
             updatedStudent.final = trimmedValue; // Store raw string input
             updatedStudent.final_status = null; // Clear status on input change

             // If the input is exactly UD or OD (case-insensitive),
             // set the final status for immediate feedback,
             // but the main validation is on save.
             if (allowedText.includes(lowerValue)) {
                updatedStudent.final_status = lowerValue.toUpperCase();
                updatedStudent.final = null; // Clear numeric if it's UD/OD text
             } else {
                 // If not UD/OD text, try parsing as number for immediate feedback
                 const numValue = parseFloat(trimmedValue);
                 if (trimmedValue === "" || (!isNaN(numValue) && numValue >= 0 && numValue <= 100)) {
                    updatedStudent.final = trimmedValue === "" ? null : numValue;
                    updatedStudent.final_status = null;
                 } else {
                    // If it's other text or invalid number, store the raw string
                    updatedStudent.final = trimmedValue;
                    updatedStudent.final_status = null;
                 }
             }
          }

          // Average, Transmutation, Remarks are calculated in GradesInputTable based on midterm/final/status
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
      action: 'save', // Or 'submit' if you add a submit button
      students: students.map(student => ({
          student_id: student.student_id,
          midterm: student.midterm, // Send numeric value (can be null)
          final: student.final,     // Send numeric value (can be null)
          midterm_status: student.midterm_status, // Send status (can be null, 'UD', 'OD')
          final_status: student.final_status,   // Send status (can be null, 'UD', 'OD')
          // average, transmutation, remarks are calculated backend
      }))
    };

    // Call save grades API
    fetch(`${API_BASE_URL}/faculty/save_grades.php${user?.id ? `?faculty_id=${user.id}` : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gradesData)
    })
    .then(response => {
      if (!response.ok) {
        // Attempt to read error message from body
        return response.json().then(err => { throw new Error(err.message || `HTTP error! status: ${response.status}`); });
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        toast.success(data.message || "Grades saved successfully");
        setGradesChanged(false);
        // Re-fetch students to get the backend-calculated average, transmutation, remarks
        fetchStudents(selectedCourse.id, selectedSection.id);
      } else {
        // Handle backend validation errors
        if (data.errors && data.errors.length > 0) {
             toast.error("Failed to save grades. See console for details.");
             console.error("Backend validation errors:", data.errors);
        } else {
             toast.error(data.message || "Failed to save grades");
        }
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

  // New function to handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);

          let updatedStudentsCount = 0;
          const allowedText = ["ud", "od"];

          setStudents(prevStudents => {
            const newStudents = prevStudents.map(student => {
              const matchingRow = json.find(row =>
                String(row["Student ID"]).trim() === String(student.student_id).trim()
              );

              if (matchingRow) {
                let updated = { ...student };
                let gradeUpdated = false;

                // Process Midterm
                if (matchingRow["Midterm"] !== undefined) {
                  const midtermValue = String(matchingRow["Midterm"]).trim();
                  const midtermLower = midtermValue.toLowerCase();

                  if (allowedText.includes(midtermLower)) {
                     updated.midterm_status = midtermLower.toUpperCase();
                     updated.midterm = null;
                     // Auto-set final status if midterm is UD/OD from file
                     updated.final_status = midtermLower.toUpperCase();
                     updated.final = null;
                     gradeUpdated = true;
                  } else {
                    const numMidterm = parseFloat(midtermValue);
                    if (midtermValue === "" || (!isNaN(numMidterm) && numMidterm >= 0 && numMidterm <= 100)) {
                      updated.midterm = midtermValue === "" ? null : numMidterm;
                      updated.midterm_status = null;
                      gradeUpdated = true;
                    } else {
                       console.warn(`Skipping invalid Midterm value for student ${student.student_id}: ${midtermValue}`);
                    }
                  }
                }

                // Process Final (only if midterm wasn't set to text, as that auto-sets final)
                // Also ensure we don't overwrite if midterm was UD/OD and already set final
                if (matchingRow["Final"] !== undefined && !allowedText.includes(String(updated.midterm_status || "").toLowerCase())) {
                   const finalValue = String(matchingRow["Final"]).trim();
                   const finalLower = finalValue.toLowerCase();

                   if (allowedText.includes(finalLower)) {
                      updated.final_status = finalLower.toUpperCase();
                      updated.final = null;
                      gradeUpdated = true;
                   } else {
                      const numFinal = parseFloat(finalValue);
                      if (finalValue === "" || (!isNaN(numFinal) && numFinal >= 0 && numFinal <= 100)) {
                        updated.final = finalValue === "" ? null : numFinal;
                        updated.final_status = null;
                        gradeUpdated = true;
                      } else {
                         console.warn(`Skipping invalid Final value for student ${student.student_id}: ${finalValue}`);
                      }
                   }
                }

                // Average, Transmutation, Remarks are calculated in GradesInputTable based on midterm/final/status
                if (gradeUpdated) {
                    updatedStudentsCount++;
                }
                return updated;
              }
              return student;
            });
            if (updatedStudentsCount > 0) {
              setGradesChanged(true);
              toast.success(`${updatedStudentsCount} students' grades updated from file.`);
            } else {
              toast.info("No matching students or valid grades found in the file.");
            }
            return newStudents;
          });

        } catch (error) {
          console.error("Error reading Excel file:", error);
          toast.error("Failed to read Excel file. Please ensure it's a valid format.");
        } finally {
          setIsUploading(false);
          // Clear the file input value to allow re-uploading the same file
          event.target.value = null;
        }
      };
      reader.readAsArrayBuffer(file);
    }

  };

  // Function to trigger the hidden file input
  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Modify handleSectionChange to remove the call to check grade status
  const handleSectionChange = (section) => {
    resetAndProceed(() => {
      setSelectedSection(section);
      if (section && selectedCourse) {
        fetchStudents(selectedCourse.id, section.id);
      }
    });
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
                          onClick={() => handleSectionChange(section)}
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
                          <CardDescription>Enter Midterm and Final grades (0-100, UD, or OD).</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {/* Hidden file input */}
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".xls,.xlsx"
                            style={{ display: 'none' }}
                          />
                          <Button variant="outline" onClick={triggerFileUpload} disabled={isUploading || loading}>
                            {isUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : "Upload From Excel"}
                          </Button>
                          <Button variant="green" onClick={handleSaveGrades} disabled={saving || !gradesChanged}>
                            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Grades</>}
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


              </div>
            )}
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default ManageGrades;