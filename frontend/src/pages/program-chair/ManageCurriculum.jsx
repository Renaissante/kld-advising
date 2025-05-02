import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogPortal } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Curriculum } from "@/components/curriculum/Curriculum";
import { useAuth } from "@/hooks/useAuth";
import { Trash2, SquarePlus, Edit } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import Tracks from "@/components/curriculum/Tracks";

const ProgramChairManageCurriculum = () => {
  const { user } = useAuth();
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [showCurriculumDialog, setShowCurriculumDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [curriculumToDelete, setCurriculumToDelete] = useState(null);
  

  // General Data
  const [academicYears, setAcademicYears] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [yearLevels, setYearLevels] = useState([]);

  // Curriculum Data
  const [curriculums, setCurriculums] = useState([]);

  // Add courses state
  const [curriculumCourses, setCurriculumCourses] = useState({});

  // Define sorting function 
  const sortByCurriculumName = (a, b) => {
    // Extract program acronym and year from curriculum name
    const getNameParts = (name) => {
      const parts = name.split(' ');
      return {
        program: parts[0],
        year: parseInt(parts[1]) || 0
      };
    };
    
    const partsA = getNameParts(a.name);
    const partsB = getNameParts(b.name);
    
    // First sort by program name
    if (partsA.program !== partsB.program) {
      return partsA.program.localeCompare(partsB.program);
    }
    
    // If programs are the same, sort by year in ascending order
    return partsA.year - partsB.year;
  };

  // Initialize track in the state
  const [newCurriculum, setNewCurriculum] = useState({ 
    name: "", 
    program: "", 
    academicYear: "", 
    semester: "", 
    yearLevel: "" 
  });

  // Reset curriculum form
  const resetCurriculumForm = () => {
    setNewCurriculum({ 
      name: "", 
      program: "", 
      academicYear: "", 
      semester: "", 
      yearLevel: "" 
    });
  };

  // Function to fetch courses for a specific curriculum
  const fetchCourses = async (curriculumId) => {
    try {
      
      console.log("Fetching courses for curriculum:", curriculumId);
      
      const response = await fetch(`http://localhost/kld-advising/backend/api/curriculum/get_courses.php?curriculum_id=${curriculumId}`);
      
      const responseText = await response.text();
      console.log("Raw response from get_courses:", responseText);
      
      // Parse the JSON response
      const data = JSON.parse(responseText);
      console.log("Parsed response from get_courses:", data);
      
      if (response.ok && data.success) {
        console.log("Fetched courses:", data.courses);
        setCurriculumCourses(prev => {
          const updatedCourses = {
            ...prev,
            [curriculumId]: data.courses || []
          };


          console.log("Updated curriculum courses in state:", updatedCourses);
          return updatedCourses;
        });
      } else {
        console.error("Failed to fetch courses:", data.message);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  // Function to handle adding OR updating a course in a curriculum
  const handleSaveCourseToCurriculum = async (courseData) => {
    // Validate the incoming data - ensure curriculum_id is present
    if (!courseData || !courseData.curriculum_id) {
      showError("Invalid course data provided (missing curriculum ID).");
      throw new Error("Invalid course data provided (missing curriculum ID).");
    }
    if (!courseData.course_code || !courseData.course_title) {
       showError("Course Code and Course Title are required.");
       throw new Error("Course Code and Course Title are required.");
    }


    const curriculumToUse = courseData.curriculum_id;
    const isUpdate = courseData.hasOwnProperty('id') && courseData.id != null; 
    const action = isUpdate ? 'Updating' : 'Adding';
    const apiUrl = isUpdate 
      ? 'http://localhost/kld-advising/backend/api/curriculum/update_course.php' 
      : 'http://localhost/kld-advising/backend/api/curriculum/add_course.php';

    // --- DUPLICATE CHECK ---
    const existingCourses = curriculumCourses[curriculumToUse] || [];
    const potentialDuplicates = existingCourses.filter(existingCourse => {
        // Check if it's a different course (important for updates!)
        // Convert IDs to strings for reliable comparison, as types might differ
        const isDifferentCourse = isUpdate ? String(existingCourse.id) !== String(courseData.id) : true; 
        
        // Check if code or title matches (case-insensitive)
        const codeMatches = existingCourse.course_code.toLowerCase() === courseData.course_code.toLowerCase();
        const titleMatches = existingCourse.course_title.toLowerCase() === courseData.course_title.toLowerCase();
        
        return isDifferentCourse && (codeMatches || titleMatches);
    });

    if (potentialDuplicates.length > 0) {
        const duplicate = potentialDuplicates[0]; // Get the first duplicate found
        let message = "";
        if (duplicate.course_code.toLowerCase() === courseData.course_code.toLowerCase()) {
             message = `Another course (${duplicate.course_code}) already has this code in the curriculum.`;
        } else {
             message = `Another course (${duplicate.course_code}) already has this title ("${courseData.course_title}") in the curriculum.`;
        }
        showError(message);
        throw new Error(message); // Prevent API call by throwing error
    }
    // --- END DUPLICATE CHECK ---


    // --- DEBUGGING LOGS ---
    console.log(`--- Saving Course ---`);
    console.log(`Action determined: ${action}`);
    console.log(`Is Update? ${isUpdate}`);
    console.log(`Course ID present: ${courseData.id}`);
    console.log(`API URL selected: ${apiUrl}`);
    console.log(`Data being sent:`, courseData);
    // --- END DEBUGGING ---

    try {
      console.log(`${action} course for curriculum:`, curriculumToUse, courseData);
      console.log(`Calling API: ${apiUrl}`);
      console.log("Course object being sent to API:", courseData);

      // Use the determined API URL
      const response = await fetch(apiUrl, { 
        method: 'POST', // Both add and update scripts use POST in this setup
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(courseData) 
      });

      const data = await response.json();
      console.log("API Response:", data);

      if (response.ok && data.success) {
        console.log(`Course ${action === 'Adding' ? 'added' : 'updated'} successfully.`);
        // Re-fetch the courses for this curriculum to update the UI
        fetchCourses(curriculumToUse);
      } else {
        const errorMessage = data.message || `Failed to ${action.toLowerCase()} course`;
        console.error(errorMessage);
        showError(errorMessage);
        throw new Error(errorMessage); 
      }
    } catch (error) {
      // Don't re-throw if it's the duplicate error we already handled
      if (!error.message.includes("already has this code") && !error.message.includes("already has this title")) {
          const errorMessage = error.message || "Error connecting to the server";
          console.error(`Error in API call during ${action.toLowerCase()}:`, error);
          showError(errorMessage); 
          throw error; // Re-throw other errors
      } else {
         console.warn("Duplicate check prevented API call:", error.message);
      }
    }
  };

  // Function to handle deleting a course from a curriculum
  const handleDeleteCourseFromCurriculum = async (curriculumId, courseId) => {
    try {
      const response = await fetch('http://localhost/kld-advising/backend/api/curriculum/delete_course.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          course_id: courseId
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Remove the course from the state
        
        fetchCourses(curriculumId);
      } else {
        showError(data.message || "Failed to delete course");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Function to handle deleting a curriculum
  const handleDeleteCurriculum = async () => {
    if (!curriculumToDelete) return;
    
    try {
      const response = await fetch('http://localhost/kld-advising/backend/api/curriculum/delete.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          curriculum_id: curriculumToDelete
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Remove the deleted curriculum from the state
        setCurriculums(prevCurriculums => 
          prevCurriculums.filter(c => c.id !== curriculumToDelete)
        );
        
        // If the deleted curriculum was selected, clear the selection
        if (selectedCurriculum === curriculumToDelete) {
          setSelectedCurriculum(null);
        }
        
        setShowDeleteDialog(false);
        setCurriculumToDelete(null);
      } else {
        showError(data.message || "Failed to delete curriculum");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Function to show the delete confirmation dialog
  const confirmDeleteCurriculum = (id, e) => {
    e.stopPropagation(); // Prevent selecting the curriculum when clicking the delete button
    setCurriculumToDelete(id);
    setShowDeleteDialog(true);
  };

  // Update showError to not close other dialogs
  const showError = (message) => {
    setValidationMessage(message);
    setShowValidationDialog(true);
  };
  
  // Update function to get program acronym
  const getProgramAcronym = (programName) => {
    const words = programName.split(' ');
    if (words[0] === 'Bachelor' && words[1] === 'of' && words[2] === 'Science') {
      // Get the first letter of each word after "Science in"
      const startIndex = words.indexOf('in') + 1;
      return `BS${words[startIndex][0]}${words[startIndex + 1] ? words[startIndex + 1][0] : ''}`;
    }
    return programName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  // Update handleAddCurriculum to use the API
  const handleAddCurriculum = async () => {
    if (!newCurriculum.program || !newCurriculum.academicYear) {
      showError("Please fill in all fields");
      return;
    }

    try {
      const selectedProgram = programs.find(p => p.name === newCurriculum.program);
      if (!selectedProgram) {
        showError("Selected program not found");
        return;
      }

      const selectedAcademicYear = academicYears.find(y => y.year === newCurriculum.academicYear);
      if (!selectedAcademicYear) {
        showError("Selected academic year not found");
        return;
      }

      const programAcronym = getProgramAcronym(newCurriculum.program);
      
      let academicYearStart = newCurriculum.academicYear;
      if (academicYearStart.includes('-')) {
        academicYearStart = academicYearStart.split('-')[0];
      }
      
      const generatedName = `${programAcronym} ${academicYearStart}`;

      if (curriculums.some(curriculum => 
        curriculum.name.toLowerCase() === generatedName.toLowerCase() &&
        curriculum.program_id === selectedProgram.id &&
        curriculum.academic_year_id === selectedAcademicYear.id
      )) {
        showError("This curriculum already exists");
        return;
      }

      const curriculumData = {
        name: generatedName,
        program_id: selectedProgram.id,
        academic_year_id: selectedAcademicYear.id
      };

      // Send request to API
      const response = await fetch('http://localhost/kld-advising/backend/api/curriculum/create.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(curriculumData)
      });

      const data = await response.json();

      if (response.ok && data.curriculum) {
        // Add the new curriculum to the state from the response
        setCurriculums(prevCurriculums => 
          [...prevCurriculums, data.curriculum].sort(sortByCurriculumName)
        );
        
        resetCurriculumForm();
        setShowCurriculumDialog(false);
      } else {
        showError(data.message || "Failed to create curriculum");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Fetch data - simplify to get all data without department filtering
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch academic years
        const academicYearResponse = await fetch('http://localhost/kld-advising/backend/api/academic_year/read.php');
        const academicYearData = await academicYearResponse.json();
        
        if (academicYearResponse.ok) {
          // Remove the filter for active status
          setAcademicYears(academicYearData);
          console.log("Academic years:", academicYearData);
        } else {
          console.error("Failed to fetch academic years:", academicYearData.message);
        }

        // Fetch semesters
        const semesterResponse = await fetch('http://localhost/kld-advising/backend/api/semester/read.php');
        const semesterData = await semesterResponse.json();
        
        if (semesterResponse.ok) {
          setSemesters(semesterData);
        } else {
          console.error("Failed to fetch semesters:", semesterData.message);
        }

        // Fetch year levels
        const yearLevelResponse = await fetch('http://localhost/kld-advising/backend/api/year_level/read.php');
        const yearLevelData = await yearLevelResponse.json();
        
        if (yearLevelResponse.ok) {
          // Handle different response structures
          if (yearLevelData.records && Array.isArray(yearLevelData.records)) {
            setYearLevels(yearLevelData.records);
          } else if (Array.isArray(yearLevelData)) {
            setYearLevels(yearLevelData);
          } else {
            console.error("Unexpected year levels data structure:", yearLevelData);
          }
        } else {
          console.error("Failed to fetch year levels:", yearLevelData.message);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCurriculum) {
      fetchCourses(selectedCurriculum);
    }
  }, [selectedCurriculum]); // This will only run when selectedCurriculum changes

  // Fetch program-chair specific data
  useEffect(() => {
    const fetchProgramChairData = async () => {
      if (!user || !user.id) return;
      
      try {
        // Fetch programs assigned to the current program chair
        const programResponse = await fetch(`http://localhost/kld-advising/backend/api/program/read_by_program_chair.php?id=${user.id}`);
        const programData = await programResponse.json();
        
        if (!programResponse.ok) {
          console.error("Failed to fetch programs:", programData.message);
          return;
        }
        
        setPrograms(programData);
        
        // Extract program IDs to filter curriculums
        const assignedProgramIds = programData.map(program => program.id);
        
        // Fetch curriculums after programs are loaded
        const curriculumResponse = await fetch('http://localhost/kld-advising/backend/api/curriculum/read.php');
        
        // DEBUG: Log the raw response
        console.log("Curriculum Response:", await curriculumResponse.clone().text());
        
        // Check if the response is OK before trying to parse JSON
        if (!curriculumResponse.ok) {
          const errorData = await curriculumResponse.json();
          console.error("Failed to fetch curriculums:", errorData.message);
          return;
        }
        
        const curriculumData = await curriculumResponse.json();
        console.log("Parsed curriculum data:", curriculumData);
        
        // Handle different response structures
        if (Array.isArray(curriculumData)) {
          // Filter curriculums to show only those for the program chair's assigned programs
          const filteredCurriculums = assignedProgramIds.length > 0 
            ? curriculumData.filter(curriculum => {
                // Filter by program_id directly since we now have it from the database
                return assignedProgramIds.includes(parseInt(curriculum.program_id));
              })
            : curriculumData;
            
          setCurriculums(filteredCurriculums.sort(sortByCurriculumName));
        } else {
          console.error("Unexpected curriculum data structure:", curriculumData);
        }
      } catch (error) {
        console.error("Error fetching program chair data:", error);
      }
    };

    fetchProgramChairData();
  }, [user]);

  // Add validation dialog component
  const ValidationDialog = ({ open, onOpenChange }) => (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setValidationMessage("");
      }
    }}>
      <DialogPortal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invalid Input</DialogTitle>
          </DialogHeader>
          <p>{validationMessage}</p>
          <DialogFooter>
            <Button variant="green" onClick={() => onOpenChange(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );

  // Add delete confirmation dialog
  const DeleteConfirmationDialog = ({ open, onOpenChange }) => {
    const curriculum = curriculums.find(c => c.id === curriculumToDelete);
    
    return (
      <Dialog open={open} onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setCurriculumToDelete(null);
        }
      }}>
        <DialogPortal>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Archive</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to archive this curriculum "{curriculum?.name}"?</p>
           
            <DialogFooter className="flex justify-between">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteCurriculum}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    );
  };

  // New states for curriculum status update
  const [showCurriculumStatusDialog, setShowCurriculumStatusDialog] = useState(false);
  const [curriculumToUpdateStatus, setCurriculumToUpdateStatus] = useState(null);

  // Function to handle toggling curriculum status
  const handleToggleCurriculumStatus = (curriculumId) => {
    setCurriculumToUpdateStatus(curriculumId);
    setShowCurriculumStatusDialog(true);
  };

  // Function to confirm status change
  const handleConfirmCurriculumStatusChange = async () => {
    try {
      const curriculumToUpdate = curriculums.find(c => c.id === curriculumToUpdateStatus);
      if (!curriculumToUpdate) {
        showError("Curriculum not found for status update.");
        return;
      }
      const newStatus = curriculumToUpdate.status === "Active" ? "Inactive" : "Active";

      const response = await fetch('http://localhost/kld-advising/backend/api/curriculum/update_status.php', { // Assuming update.php handles status update
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: curriculumToUpdate.id,
          status: newStatus // Send the new status to the API
        })
      });

      const data = await response.json();

      if (response.ok && data.curriculum) {
        // Update the curriculum in the state
        setCurriculums(prevCurriculums =>
          prevCurriculums.map(curriculum =>
            curriculum.id === curriculumToUpdate.id ? data.curriculum : curriculum
          )
        );
        setShowCurriculumStatusDialog(false);
        setCurriculumToUpdateStatus(null);
      } else {
        showError(data.message || "Failed to update curriculum status");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Add Curriculum Status Confirmation Dialog
  const CurriculumStatusDialog = ({ open, onOpenChange }) => {
    const curriculum = curriculums.find(c => c.id === curriculumToUpdateStatus);
    const nextStatus = curriculum?.status === "Active" ? "Inactive" : "Active";

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Status Change</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to change the status of curriculum "{curriculum?.name}" to "{nextStatus}"?</p>
            <DialogFooter className="flex justify-between">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="green" onClick={handleConfirmCurriculumStatusChange}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    );
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        <ValidationDialog open={showValidationDialog} onOpenChange={setShowValidationDialog} />
        <DeleteConfirmationDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
        <CurriculumStatusDialog open={showCurriculumStatusDialog} onOpenChange={setShowCurriculumStatusDialog} />

        <div className="flex mt-4">
          {/* Main content area */}
          <main className="w-[70%] py-4 pr-4 pl-2">
            {!selectedCurriculum && (
              <div className="flex justify-between items-start mb-4">
                <h1 className="text-xl font-semibold text-[#1b4b2a]">Manage Curriculum</h1>
              </div>
            )}
            
            {selectedCurriculum && (
              <div className="border rounded-md p-4 shadow-lg">
                <Curriculum 
                  curriculumName={curriculums.find(c => c.id === selectedCurriculum)}
                  selectedCurriculum={selectedCurriculum} 
                  courses={curriculumCourses[selectedCurriculum] || []}
                  currentCurriculumCourses={curriculumCourses[selectedCurriculum] || []}
                  yearLevels={yearLevels}
                  semesters={semesters}
                  onSaveCourse={handleSaveCourseToCurriculum}
                  onDeleteCourse={(courseId) => handleDeleteCourseFromCurriculum(selectedCurriculum, courseId)}
                 
                />
              </div>
            )}
            
            {!selectedCurriculum && (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Select a curriculum from the sidebar to manage its courses</p>
              </div>
            )}
          </main>

          {/* Right Sidebar */}
          <div className="w-[30%] px-2">
            <div className="sticky top-[7.5rem] space-y-6 mt-4">
              <Card className="h-[calc(100vh-30rem)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <h2 className="text-lg font-semibold text-[#1b4b2a]">Curriculums</h2>
                  <Dialog open={showCurriculumDialog} onOpenChange={setShowCurriculumDialog}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <SquarePlus className="h-4 w-4 text-[#1b4b2a]" />
                      </Button>
                    </DialogTrigger>
                    <DialogPortal>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Curriculum</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Program</Label>
                            <Select onValueChange={(value) => setNewCurriculum({ ...newCurriculum, program: value })}>
                              <SelectTrigger><SelectValue placeholder="Select Program" /></SelectTrigger>
                              <SelectContent>
                                {programs.map((program) => (
                                  <SelectItem key={program.id} value={program.name}>{program.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Academic Year</Label>
                            <Select onValueChange={(value) => setNewCurriculum({ ...newCurriculum, academicYear: value })}>
                              <SelectTrigger><SelectValue placeholder="Select Academic Year" /></SelectTrigger>
                              <SelectContent>
                                {academicYears.map((year) => (
                                  <SelectItem key={year.id} value={year.year}>{year.year}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="green" onClick={handleAddCurriculum}>Save</Button>
                        </DialogFooter>
                      </DialogContent>
                    </DialogPortal>
                  </Dialog>
                </CardHeader>
                <CardContent className="p-0">
                  <Separator className="mt-2"/>
                  <div className="h-[calc(100vh-37rem)]">
                    <ScrollArea className="h-full mt-4">
                      <div className="px-4">
                        {curriculums.length > 0 ? (
                          curriculums.map((curriculum) => (
                            <div
                              key={curriculum.id}
                              className={`px-4 py-2 cursor-pointer rounded-md transition-colors flex justify-between items-center ${
                                selectedCurriculum === curriculum.id
                                  ? "bg-accent text-accent-foreground font-medium"
                                  : "hover:bg-muted/50"
                              }`}
                              onClick={() => {
                                setSelectedCurriculum(curriculum.id);
                                console.log("Selected Curriculum ID set to:", curriculum.id);
                              }}
                            >
                              <span>{curriculum.name}</span>
                            <div className="flex gap-2"> 
                                <Button
                                  variant={curriculum.status === "Active" ? "green" : "destructive"} // Use green for Active, destructive for Inactive
                                  size="sm"
                                  className="w-16"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleCurriculumStatus(curriculum.id);
                                  }}
                                >
                                  {curriculum.status === "Active" ? "Active" : "Inactive"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"

                                  onClick={(e) => confirmDeleteCurriculum(curriculum.id, e)}
                                >
                                 Archive
                                </Button>
                            </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-muted-foreground text-sm text-center py-4">No curriculums available</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>

              <Tracks />
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default ProgramChairManageCurriculum; 