import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/App-sidebar"
import Header from "@/components/layout/Header"
import { useState, useEffect, useRef } from "react"
import { Search, Trash2, BookOpen, Users, Calendar, MoreHorizontal, Loader2, ChevronsUpDown, Check, X, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { API_BASE_URL } from '@/config/api'; 
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogPortal,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useNavigate } from "react-router-dom"
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PaginationComponent } from "@/components/shared/PaginationComponent";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useActive } from "@/contexts/ActiveContext"
import { useAuth } from "@/hooks/useAuth"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"

export default function ManageFaculty() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFaculty, setSelectedFaculty] = useState(null)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isAssignAdviseeDialogOpen, setIsAssignAdviseeDialogOpen] = useState(false)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [validationMessage, setValidationMessage] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [facultyToDelete, setFacultyToDelete] = useState(null)
  const { activeAcademicYear, activeSemester } = useActive()

  // State for faculty list, loading, and error
  const [facultyList, setFacultyList] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)

  // New assignment state (keep for dialogs)
  const [newAssignment, setNewAssignment] = useState({
    courseId: "",
    sectionId: [], // Changed to array for multi-select
  })
  const [sectionSearchTerm, setSectionSearchTerm] = useState("");


  // New advisee assignment state (keep for dialogs)
  const [newAdviseeAssignment, setNewAdviseeAssignment] = useState({
    sectionId: "",
  })

  // State for sections data
  const [sectionsData, setSectionsData] = useState([]);
  const [coursesData, setCoursesData] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [assignedProgramIds, setAssignedProgramIds] = useState([]);

  // State for curriculum data
  const [curriculumData, setCurriculumData] = useState([]);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);

  // Debug logging for active academic year and semester
  useEffect(() => {
    console.log("Active Academic Year:", activeAcademicYear);
    console.log("Active Semester:", activeSemester);
  }, [activeAcademicYear, activeSemester]);

  // Fetch program-chair specific data - programs assigned to them
  useEffect(() => {
    const fetchProgramChairData = async () => {
      if (!user || !user.id) return;
      
      try {
        // Fetch programs assigned to the current program chair
        const programResponse = await fetch(`${API_BASE_URL}/program/read_by_program_chair.php?id=${user.id}`);
        const programData = await programResponse.json();
        
        if (!programResponse.ok) {
          console.error("Failed to fetch programs:", programData.message);
          return;
        }
        
        setPrograms(programData);
        
        // Extract program IDs to filter sections
        const programIds = programData.map(program => program.id);
        setAssignedProgramIds(programIds);
        
        console.log("Program Chair's Assigned Programs:", programData);
        console.log("Program IDs for filtering:", programIds);
      } catch (error) {
        console.error("Error fetching program chair data:", error);
      }
    };

    fetchProgramChairData();
  }, [user]);

  // Fetch data on component mount
  useEffect(() => {
    const fetchFaculty = async () => {
      setIsLoading(true)
      setError(null)
      try {
        // Adjust the URL to your actual backend endpoint
        const response = await fetch(`${API_BASE_URL}/program_chair/read_assignment.php`)
        if (!response.ok) {
          // Try to get error message from response body
          let errorMsg = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
          } catch (e) {
            // Ignore if response is not JSON
          }
          throw new Error(errorMsg);
        }
        const data = await response.json()
        // Deduplicate faculty list based on faculty_id (client-side safeguard)
        const uniqueFacultyData = Array.from(new Map(data.map(faculty => [faculty.faculty_id, faculty])).values());
        setFacultyList(uniqueFacultyData)
      } catch (error) {
        console.error("Fetching faculty failed:", error)
        setError(error.message || "Failed to fetch faculty data. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchFaculty()
  }, []) // Empty dependency array ensures this runs only once on mount

  // Filter faculty based on search query (now uses facultyList state)
  const filteredFaculty = facultyList.filter(
    (faculty) => {
      const lowerCaseSearchQuery = searchQuery.toLowerCase();
      const facultyRoles = faculty.roles ? faculty.roles.toLowerCase() : '';

      return (
        faculty.faculty_name.toLowerCase().includes(lowerCaseSearchQuery) ||
        faculty.email.toLowerCase().includes(lowerCaseSearchQuery) ||
        facultyRoles.includes(lowerCaseSearchQuery) ||
        faculty.department_name.toLowerCase().includes(lowerCaseSearchQuery)
      );
    }
  )

  // Calculate pagination (now uses filteredFaculty derived from state)
  const totalPages = Math.ceil(filteredFaculty.length / itemsPerPage)
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredFaculty.slice(indexOfFirstItem, indexOfLastItem)

  // Handle page changes
  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber)
    }
  }

  // Reset dialogs when component unmounts or when dependencies change
  useEffect(() => {
    return () => {
      setIsAssignDialogOpen(false)
      setIsAssignAdviseeDialogOpen(false)
      setShowValidationDialog(false)
      setShowDeleteDialog(false)
    }
  }, [])

  // Reset current page when search query changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const handleDeleteFaculty = (faculty) => {
    // TODO: Implement actual delete functionality (API call)
    console.log("Attempting to delete:", faculty) // Placeholder
    setFacultyToDelete(faculty)
    setShowDeleteDialog(true)
  }

  const confirmDeleteFaculty = () => {
    // TODO: Add API call here to delete the faculty
    console.log("Confirmed delete for:", facultyToDelete) // Placeholder
    // After successful API call, update facultyList state:
    // setFacultyList(facultyList.filter(f => f.faculty_id !== facultyToDelete.faculty_id));
    setShowDeleteDialog(false)
    setFacultyToDelete(null)
  }

  const handleSaveAssignment = async (assignmentData) => {
    try {
      // Show loading toast and store its ID
      const toastId = toast.loading("Assigning course...", {
        description: "Processing your request."
      });
      
      // Add faculty_id to the assignment data
      const completeAssignmentData = {
        faculty_id: selectedFaculty.faculty_id,
        section_id: assignmentData.sectionId,
        course_id: assignmentData.courseId
      };
      
      console.log("Saving course assignment:", completeAssignmentData);
      
      // Call the API to assign the course
      const response = await fetch(`${API_BASE_URL}/program_chair/assign_course.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(completeAssignmentData)
      });
      
      const data = await response.json();
      
      // Dismiss the loading toast first, regardless of result
      toast.dismiss(toastId);
      
      if (response.ok) {
        // Success - show success toast
        toast.success("Course assigned successfully", {
          id: `assign-course-success-${selectedFaculty.faculty_id}-${assignmentData.sectionId}-${assignmentData.courseId}-${Date.now()}`,
          description: `${data.course_code} assigned to ${data.section_name}`
        });
        
        // Update the faculty list to show the new assignment count
        const updatedFacultyList = facultyList.map(faculty => {
          if (faculty.faculty_id === selectedFaculty.faculty_id) {
            return {
              ...faculty,
              sectionsAssigned: faculty.sectionsAssigned ? parseInt(faculty.sectionsAssigned) + 1 : 1
            };
          }
          return faculty;
        });
        
        setFacultyList(updatedFacultyList);
        
        // Close the dialog
        setIsAssignDialogOpen(false);
      } else {
        // Error handling with specific message
        console.error("Error assigning course:", data.message);
        toast.error("Failed to assign course", {
          id: `assign-course-error-${selectedFaculty.faculty_id}-${assignmentData.sectionId}-${assignmentData.courseId}-${Date.now()}`,
          description: data.message || "Error assigning the course. Please try again."
        });
      }
    } catch (error) {
      // Dismiss any pending loading toasts in case of errors
      toast.dismiss();
      console.error("Error in API call:", error);
      toast.error("Network error", {
        id: `assign-course-network-error-${selectedFaculty.faculty_id}-${Date.now()}`,
        description: "Connection problem. Please check your network and try again."
      });
    }
  }

  const handleSaveAdviseeAssignment = async (assignmentData) => {
    try {
      // Show loading toast and store its ID
      const toastId = toast.loading("Assigning section advisor...", {
        description: "Processing your request."
      });
      
      // Add faculty_id to the assignment data
      const completeAssignmentData = {
        faculty_id: selectedFaculty.faculty_id,
        section_id: assignmentData.sectionId
      };
      
      console.log("Saving advisor assignment:", completeAssignmentData);
      
      // Call the API to assign the advisor
      const response = await fetch(`${API_BASE_URL}/program_chair/assign_advisor.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(completeAssignmentData)
      });
      
      const data = await response.json();
      
      // Dismiss the loading toast first
      toast.dismiss(toastId);
      
      if (response.ok) {
        // Check if this was a replacement or new assignment
        if (data.replaced) {
          toast.success("Advisor assignment updated", {
            id: `assign-advisee-update-${selectedFaculty.faculty_id}-${assignmentData.sectionId}-${Date.now()}`,
            description: `${data.section_name} advisor changed to ${data.new_advisor || "Unknown"}`
          });
        } else {
          toast.success("Advisor assigned successfully", {
            id: `assign-advisee-success-${selectedFaculty.faculty_id}-${assignmentData.sectionId}-${Date.now()}`,
            description: `${data.section_name} assigned to ${data.advisor_name || "Unknown"}`
          });
        }
        
        // Update the faculty list to show the new advisee count
        const updatedFacultyList = facultyList.map(faculty => {
          if (faculty.faculty_id === selectedFaculty.faculty_id) {
            return {
              ...faculty,
              advisedSectionsCount: faculty.advisedSectionsCount ? parseInt(faculty.advisedSectionsCount) + 1 : 1
            };
          }
          return faculty;
        });
        
        setFacultyList(updatedFacultyList);
        
        // Close the dialog
        setIsAssignAdviseeDialogOpen(false);
      } else {
        // Error handling with specific message
        console.error("Error assigning advisor:", data.message);
        toast.error("Failed to assign advisor", {
          id: `assign-advisee-error-${selectedFaculty.faculty_id}-${assignmentData.sectionId}-${Date.now()}`,
          description: data.message || "Error assigning the advisor. Please try again."
        });
      }
    } catch (error) {
      // Dismiss any pending loading toasts in case of errors
      toast.dismiss();
      console.error("Error in API call:", error);
      toast.error("Network error", {
        id: `assign-advisee-network-error-${selectedFaculty.faculty_id}-${Date.now()}`,
        description: "Connection problem. Please check your network and try again."
      });
    }
  }

  const showError = (message) => {
    setValidationMessage(message)
    setShowValidationDialog(true)
  }

  // Add fetch for sections based on active academic year and semester
  useEffect(() => {
    const fetchSections = async () => {
      if (!activeAcademicYear?.id || !activeSemester?.id || !user?.id || assignedProgramIds.length === 0) {
        console.log("Missing required values for fetching sections:");
        console.log("- Academic Year ID:", activeAcademicYear?.id);
        console.log("- Semester ID:", activeSemester?.id);
        console.log("- User ID:", user?.id);
        console.log("- Assigned Program IDs:", assignedProgramIds);
        return;
      }
      
      console.log("Fetching sections with:");
      console.log("- Academic Year ID:", activeAcademicYear.id);
      console.log("- Semester ID:", activeSemester.id);
      console.log("- Program Chair ID:", user.id);
      console.log("- Assigned Program IDs:", assignedProgramIds);
      
      setLoadingSections(true);
      try {
        // URL for all sections - used when assigning courses
        let url = `${API_BASE_URL}/program_chair/read_sections.php?academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}`;
        
        console.log("API URL:", url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("All sections data received:", data);
        
        // Log the structure of the first section to examine available fields
        if (data.length > 0) {
          console.log("Example section data structure:", data[0]);
        }
        
        // Get program names from assigned programs for filtering
        const assignedProgramNames = programs.map(program => program.name);
        console.log("Assigned program names:", assignedProgramNames);
        
        // Filter sections using program_name since program_id might not be available
        const filteredSections = data.filter(section => {
          // Check if program_name exists and is in assigned programs
          if (section.program_name) {
            return assignedProgramNames.some(programName => 
              section.program_name.includes(programName)
            );
          }
          // Fallback to program_id if available
          if (section.program_id) {
            return assignedProgramIds.includes(parseInt(section.program_id));
          }
          return false;
        });
        
        // Filter out duplicates based on id (client-side safeguard)
        const uniqueFilteredSections = Array.from(new Map(filteredSections.map(section => [section.id, section])).values());
        
        console.log("Filtered sections for program chair's programs:", uniqueFilteredSections);
        setSectionsData(uniqueFilteredSections);
      } catch (error) {
        console.error("Error fetching sections:", error);
      } finally {
        setLoadingSections(false);
      }
    };

    fetchSections();
  }, [activeAcademicYear, activeSemester, user, assignedProgramIds, programs]);

  // Add fetch for courses
  useEffect(() => {
    const fetchCourses = async () => {
      setLoadingCourses(true);
      try {
        const response = await fetch(`${API_BASE_URL}/course/read.php`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setCoursesData(data);
      } catch (error) {
        console.error("Error fetching courses:", error);
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, []);

  // Add fetch for curriculum data
  useEffect(() => {
    const fetchCurriculum = async () => {
      setLoadingCurriculum(true);
      try {
        const response = await fetch(`${API_BASE_URL}/curriculum/read.php`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setCurriculumData(data);
      } catch (error) {
        console.error("Error fetching curriculum data:", error);
      } finally {
        setLoadingCurriculum(false);
      }
    };

    fetchCurriculum();
  }, []);

  // --- Dialog Components (Keep as they are for now) ---
  const AssignCourseDialog = ({ open, onOpenChange, faculty, onSave }) => {
    const [assignment, setAssignment] = useState({
      courseId: "",
      sectionId: "", // Changed from array to string/number for single selection
    });
    const [dialogValidationError, setDialogValidationError] = useState("");
    const sectionPopoverTriggerRef = useRef(null);
    const coursePopoverTriggerRef = useRef(null);
    const [courseSearchTerm, setCourseSearchTerm] = useState("");
    const { activeAcademicYear, activeSemester } = useActive();
    const [filteredCourses, setFilteredCourses] = useState([]);
    const [relevantCurriculumIds, setRelevantCurriculumIds] = useState([]);
    const [loadingCoursesForSection, setLoadingCoursesForSection] = useState(false);

    // Update filtered courses when section selection changes
    useEffect(() => {
      // Skip if dialog is not open
      if (!open) return;

      // If no section selected, reset courses
      if (!assignment.sectionId) {
        setFilteredCourses([]);
        return;
      }

      const fetchCoursesForSection = async () => {
        try {
          setLoadingCoursesForSection(true);
          
          // Construct URL with all necessary parameters
          const url = new URL(`${API_BASE_URL}/program_chair/get_courses_for_section.php`);
          
          // Add query parameters
          url.searchParams.append('section_id', assignment.sectionId);
          
          if (activeAcademicYear?.id) {
            url.searchParams.append('academic_year_id', activeAcademicYear.id);
          }
          
          if (activeSemester?.id) {
            url.searchParams.append('semester_id', activeSemester.id);
          }
          
          console.log("Fetching courses for section with URL:", url.toString());
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log("Courses received from backend:", data);
          
          // Deduplicate courses based on id (client-side safeguard)
          const uniqueCoursesData = Array.from(new Map(data.map(course => [course.id, course])).values());
          setFilteredCourses(uniqueCoursesData);
        } catch (error) {
          console.error("Error fetching courses for section:", error);
          setFilteredCourses([]);
        } finally {
          setLoadingCoursesForSection(false);
        }
      };
      
      fetchCoursesForSection();
    }, [assignment.sectionId, activeAcademicYear, activeSemester, open]);

    const handleSave = () => {
      if (!assignment.courseId || !assignment.sectionId) {
        setDialogValidationError("Please select a course and section");
        return;
      }
      setDialogValidationError("");
      onSave(assignment);
      setAssignment({ courseId: "", sectionId: "" });
      onOpenChange(false);
    };

    const handleClose = () => {
      setAssignment({ courseId: "", sectionId: "" });
      setDialogValidationError("");
      setFilteredCourses([]);
      onOpenChange(false);
      setSectionSearchTerm("");
      setCourseSearchTerm("");
    };

    // Reset state when dialog opens/closes
    useEffect(() => {
      if (!open) {
        setAssignment({ courseId: "", sectionId: "" });
        setDialogValidationError("");
        setSectionSearchTerm("");
        setCourseSearchTerm("");
        setFilteredCourses([]);
        setLoadingCoursesForSection(false);
      }
    }, [open]);

    useEffect(() => {
      if (open) {
        console.log("AssignCourseDialog: Active Academic Year:", activeAcademicYear);
        console.log("AssignCourseDialog: Active Semester:", activeSemester);
        console.log("AssignCourseDialog: Available sections:", sectionsData);
      }
    }, [open, activeAcademicYear, activeSemester, sectionsData]);

    // Handle section selection without triggering a modal rerender
    const handleSectionSelect = (sectionId) => {
      const numericId = Number(sectionId);
      setAssignment(prev => ({ ...prev, sectionId: numericId, courseId: "" })); // Reset course when section changes
      setSectionSearchTerm("");
      sectionPopoverTriggerRef.current?.click(); // <-- Add this line
    };

    // Add handleCourseSelect or modify the inline onSelect
    const handleCourseSelect = (courseId) => {
        setAssignment(prev => ({ ...prev, courseId: courseId }));
        setCourseSearchTerm("");
        coursePopoverTriggerRef.current?.click(); // <-- Add this line
    }


    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogPortal>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Assign Course</DialogTitle>
              <DialogDescription>
                {faculty && `Assign a course to ${faculty.faculty_name} for ${activeAcademicYear?.year || 'N/A'} ${activeSemester?.name || 'N/A'}`}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div className="space-y-4 py-4">
                {dialogValidationError && (
                  <p className="text-sm text-destructive">{dialogValidationError}</p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="section">Section<span className="text-destructive">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild ref={sectionPopoverTriggerRef}>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between font-normal h-auto min-h-10"
                      >
                        <div className="flex items-center w-full">
                          <span className="text-left flex-1 truncate">
                            {assignment.sectionId ? (
                              sectionsData.find(section => Number(section.id) === Number(assignment.sectionId))?.name
                            ) : (
                              <span className="text-muted-foreground">Select a section</span>
                            )}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search section..."
                          value={sectionSearchTerm}
                          onValueChange={setSectionSearchTerm}
                        />
                        <CommandList>
                          {loadingSections ? (
                            <div className="flex items-center justify-center p-4">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span>Loading sections...</span>
                            </div>
                          ) : (
                          <ScrollArea className="h-[200px]">
                            <CommandEmpty>No section found.</CommandEmpty>
                              {sectionsData && sectionsData.length > 0 ? (
                                sectionsData
                              .filter(option => option.name.toLowerCase().includes(sectionSearchTerm.toLowerCase()))
                              .map((section) => (
                                  <CommandItem
                                    key={`section-${section.id}-${section.name}`}
                                    value={section.name}
                                    onSelect={() => handleSectionSelect(section.id)} // Use the handler
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        Number(assignment.sectionId) === Number(section.id) ? "opacity-100" : "opacity-0",
                                      )}
                                    />
                                    {section.name}
                                  </CommandItem>
                                ))
                              ) : (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  No sections available for the current academic year and semester.
                        </div>
                              )}
                          </ScrollArea>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label id="course-label">Course<span className="text-destructive">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild ref={coursePopoverTriggerRef}>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between font-normal h-auto min-h-10"
                      >
                        <div className="flex items-center w-full">
                          {assignment.courseId ? (
                            <div className="flex-1 min-w-0 flex flex-col text-left">
                              <div className="text-sm font-medium">
                                {filteredCourses.find((course) => course.id === assignment.courseId)?.course_code}
                              </div>
                              <div className="text-xs text-muted-foreground truncate pr-2">
                                {filteredCourses.find((course) => course.id === assignment.courseId)?.course_title}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground flex-1 text-left">Select a course</span>
                          )}
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search course..."
                          value={courseSearchTerm}
                          onValueChange={setCourseSearchTerm}
                        />
                        <CommandList>
                          {!assignment.sectionId ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              Please select a section first to see relevant courses
                            </div>
                          ) : loadingCoursesForSection ? (
                            <div className="flex items-center justify-center p-4">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span>Loading courses for this section...</span>
                            </div>
                          ) : filteredCourses.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              No unassigned courses for this section for {activeAcademicYear?.year || 'current academic year'} {activeSemester?.name || 'current semester'}
                            </div>
                          ) : (
                            <ScrollArea className="h-[200px]">
                              <CommandEmpty>No course found.</CommandEmpty>
                              {filteredCourses
                                .filter(course => 
                                  course.course_code?.toLowerCase().includes(courseSearchTerm.toLowerCase()) ||
                                  course.course_title?.toLowerCase().includes(courseSearchTerm.toLowerCase())
                                )
                                .map((course) => (
                                  <CommandItem
                                    key={`course-${course.id}-${course.course_code}`}
                                    value={course.course_code}
                                    onSelect={() => handleCourseSelect(course.id)} // Use the handler
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        assignment.courseId === course.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {course.course_code}
                                    <span className="ml-2 text-muted-foreground text-xs">{course.course_title}</span>
                                  </CommandItem>
                                ))}
                            </ScrollArea>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="green">
                  Assign Course
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    );
  };

  const AssignAdviseeDialog = ({ open, onOpenChange, faculty, onSave }) => {
    const [assignment, setAssignment] = useState({
      sectionId: "",
    });
    const [dialogValidationError, setDialogValidationError] = useState("");
    const { activeAcademicYear, activeSemester } = useActive();
    const [sectionSearchTerm, setSectionSearchTerm] = useState("");
    const sectionPopoverTriggerRef = useRef(null);
    const [sectionsWithoutAdvisors, setSectionsWithoutAdvisors] = useState([]);
    const [loadingUnassignedSections, setLoadingUnassignedSections] = useState(false);

    // Fetch sections without advisors when dialog opens
    useEffect(() => {
      const fetchSectionsWithoutAdvisors = async () => {
        if (!open || !activeAcademicYear?.id || !activeSemester?.id) return;
        
        setLoadingUnassignedSections(true);
        try {
          // URL for sections without advisors
          const url = `${API_BASE_URL}/program_chair/read_sections.php?academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}&filter_type=no_advisor`;
          
          console.log("Fetching sections without advisors:", url);
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          
          // Get program names from assigned programs for filtering
          const assignedProgramNames = programs.map(program => program.name);
          
          // Filter sections by program
          const filteredSections = data.filter(section => {
            if (section.program_name) {
              return assignedProgramNames.some(programName => 
                section.program_name.includes(programName)
              );
            }
            if (section.program_id) {
              return assignedProgramIds.includes(parseInt(section.program_id));
            }
            return false;
          });
          
          // Filter out duplicates based on id (client-side safeguard)
          const uniqueFilteredSections = Array.from(new Map(filteredSections.map(section => [section.id, section])).values());
          
          console.log("Sections without advisors:", uniqueFilteredSections);
          setSectionsWithoutAdvisors(uniqueFilteredSections);
        } catch (error) {
          console.error("Error fetching sections without advisors:", error);
        } finally {
          setLoadingUnassignedSections(false);
        }
      };

      fetchSectionsWithoutAdvisors();
    }, [open, activeAcademicYear, activeSemester, programs, assignedProgramIds]);

    const handleSave = () => {
      if (!assignment.sectionId) {
        setDialogValidationError("Please select a section");
        return;
      }
      setDialogValidationError("");
      onSave(assignment);
      setAssignment({ sectionId: "" });
      onOpenChange(false);
    };

    const handleClose = () => {
      setAssignment({ sectionId: "" });
      setDialogValidationError("");
      onOpenChange(false);
      setSectionSearchTerm("");
    };

    // Reset state when faculty changes or dialog opens/closes
    useEffect(() => {
      if (!open) {
        setAssignment({ sectionId: "" });
        setDialogValidationError("");
        setSectionSearchTerm("");
      }
    }, [open]);

    useEffect(() => {
      if (open) {
        console.log("AssignAdviseeDialog: Active Academic Year:", activeAcademicYear);
        console.log("AssignAdviseeDialog: Active Semester:", activeSemester);
      }
    }, [open, activeAcademicYear, activeSemester]);

    // Add handleSectionSelect or modify the inline onSelect
    const handleAdviseeSectionSelect = (sectionId) => {
        setAssignment({ ...assignment, sectionId: Number(sectionId) });
        setSectionSearchTerm("");
        sectionPopoverTriggerRef.current?.click(); // <-- Add this line
    }

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogPortal>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Assign Advisees</DialogTitle>
              <DialogDescription>
                {faculty && `Assign advisees section to ${faculty.faculty_name} for ${activeAcademicYear?.year || 'N/A'} ${activeSemester?.name || 'N/A'}`}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div className="space-y-4 py-4">
                {dialogValidationError && (
                  <p className="text-sm text-destructive">{dialogValidationError}</p>
                )}

                <div className="space-y-2">
                  <Label id="advisee-section-label">Section<span className="text-destructive">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild ref={sectionPopoverTriggerRef}>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between font-normal h-auto min-h-10"
                      >
                        <div className="flex items-center w-full">
                          <span className="text-left flex-1 truncate">
                            {assignment.sectionId ? (
                              sectionsWithoutAdvisors.find((section) => Number(section.id) === Number(assignment.sectionId))?.name
                            ) : (
                              <span className="text-muted-foreground">Select a section</span>
                            )}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search section..."
                          value={sectionSearchTerm}
                          onValueChange={setSectionSearchTerm}
                        />
                        <CommandList>
                          {loadingUnassignedSections ? (
                            <div className="flex items-center justify-center p-4">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span>Loading sections...</span>
                            </div>
                          ) : (
                            <ScrollArea className="h-[200px]">
                              <CommandEmpty>No section found.</CommandEmpty>
                              {sectionsWithoutAdvisors && sectionsWithoutAdvisors.length > 0 ? (
                                sectionsWithoutAdvisors
                                  .filter(section => section.name.toLowerCase().includes(sectionSearchTerm.toLowerCase()))
                                  .map((section) => (
                                    <CommandItem
                                      key={`advisee-section-${section.id}-${section.name}`}
                                      value={section.name}
                                      onSelect={() => handleAdviseeSectionSelect(section.id)} // Use the handler
                                      className="cursor-pointer"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          Number(assignment.sectionId) === Number(section.id) ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {section.name}
                                    </CommandItem>
                                  ))
                              ) : (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  No unassigned sections available for the current academic year and semester.
                                </div>
                              )}
                            </ScrollArea>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="green">
                  Assign Advisees
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    );
  };

  const ValidationDialog = ({ open, onOpenChange }) => (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setValidationMessage("");
        }
      }}
    >
      <DialogPortal>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-destructive">Invalid Input</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">{validationMessage}</p>
          </div>
          <DialogFooter>
            <Button variant="green" onClick={() => onOpenChange(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );

  const DeleteConfirmationDialog = ({ open, onOpenChange }) => (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        // Removed focus logic as it might interfere
        // if (!isOpen) {
        //   document.body.focus(); // Return focus to the body
        // }
      }}
    >
      <DialogPortal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this faculty member?</p>
          <p className="text-sm text-muted-foreground">
            {/* Use faculty_name from the state */}
            {facultyToDelete && `${facultyToDelete.faculty_name} (${facultyToDelete.email})`}
          </p>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteFaculty}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )

  return (
    <SidebarProvider>
      <Toaster />
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        <ValidationDialog open={showValidationDialog} onOpenChange={setShowValidationDialog} />
        <DeleteConfirmationDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />

        <div className="flex mt-4">
          {/* Main content area */}
          <main className="w-full py-4 p-4 md:p-6">
            <div className="w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-semibold text-[#1b4b2a]">Manage Faculty</h1>
                  <p className="text-muted-foreground">
                    Manage Faculty for A.Y. {activeAcademicYear?.year || 'N/A'} {activeSemester?.name || 'N/A'}
                </p>
                </div>
              </div>

              <div className="flex items-center py-2">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search faculty..."
                    className="pl-8 h-10 rounded-md"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isLoading} // Disable search while loading
                  />
                </div>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2">Loading faculty...</span>
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Table Display (only when not loading and no error) */}
              {!isLoading && !error && (
                <>
              <div className="rounded-md border mt-2">
                <Table>
                  <TableHeader className="bg-[#f0f5f0]">
                    <TableRow>
                          {/* Use dynamic data keys */}
                          <TableHead className="px-3 py-2 font-medium w-[250px]">Name</TableHead>
                          <TableHead className="px-3 py-2 font-medium w-[150px]">Role</TableHead>
                          <TableHead className="px-3 py-2 font-medium w-[120px]">Department</TableHead>
                          <TableHead className="px-3 py-2 font-medium w-[130px]">Sections Assigned</TableHead>
                          <TableHead className="px-3 py-2 font-medium w-[130px]">Advised Sections</TableHead>
                          <TableHead className="px-3 py-2 font-medium w-[100px]">Advisees</TableHead>
                          <TableHead className="text-right px-3 py-2 font-medium w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                        {/* Map over currentItems (paginated filtered list) */}
                        {currentItems.length > 0
                          ? currentItems.map((faculty) => (
                            // Ensure the TableRow is the direct return value without extra whitespace/newlines around it
                            <TableRow key={faculty.faculty_id}>
                        <TableCell className="px-3 py-2">
                          <div>
                                  <div className="font-semibold">{faculty.faculty_name}</div>
                            <div className="text-sm text-muted-foreground">{faculty.email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2">{faculty.role}</TableCell>
                              <TableCell className="px-3 py-2">{faculty.department_name}</TableCell>
                        <TableCell className="px-3 py-2">{faculty.sectionsAssigned}</TableCell>
                              <TableCell className="px-3 py-2">{faculty.advisedSectionsCount}</TableCell>
                        <TableCell className="px-3 py-2">{faculty.adviseesAssigned}</TableCell>
                        <TableCell className="text-right px-3 py-2">
                          <div className="flex justify-end items-center space-x-2">
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Open menu">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent 
                                align="end"
                                onInteractOutside={(e) => e.preventDefault()}
                              >
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedFaculty(faculty);
                                    setIsAssignDialogOpen(true);
                                  }}
                                >
                                  <BookOpen className="mr-2 h-4 w-4" />
                                  Assign Course
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedFaculty(faculty);
                                    setIsAssignAdviseeDialogOpen(true);
                                  }}
                                >
                                  <Users className="mr-2 h-4 w-4" />
                                  Assign Advisees
                                </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => navigate(`/program-chair/faculty-assignment/${faculty.faculty_id}`)}>
                                        <Calendar className="mr-2 h-4 w-4" />
                                        View Assignments
                                      </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button 
                              variant="ghost" 
                              className="h-8 w-8 p-0" 
                              onClick={() => handleDeleteFaculty(faculty)}
                              aria-label="Delete faculty"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                          ))
                          : // Show message when filtered list is empty
                          (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                                {searchQuery ? "No matching faculty found." : "No faculty members available."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

                  {/* Pagination (only show if there are items) */}
              {filteredFaculty.length > 0 && (
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-5">
                  <div className="flex flex-row items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                      Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{" "}
                      <span className="font-medium">{Math.min(indexOfLastItem, filteredFaculty.length)}</span> of{" "}
                      <span className="font-medium">{filteredFaculty.length}</span> entries
                    </div>
                    <div className="flex items-center mt-0 sm:mt-0">
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(value) => {
                          setItemsPerPage(Number(value))
                              setCurrentPage(1) // Reset to first page on changing items per page
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={itemsPerPage} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="ml-2 text-sm text-muted-foreground">per page</span>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-0">
                    <PaginationComponent
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={paginate}
                    />
                  </div>
                </div>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </main>
      {/* Dialog components using selectedFaculty state */}
      <AssignCourseDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        faculty={selectedFaculty}
        onSave={handleSaveAssignment} // Pass the handler
      />

      <AssignAdviseeDialog
        open={isAssignAdviseeDialogOpen}
        onOpenChange={setIsAssignAdviseeDialogOpen}
        faculty={selectedFaculty}
        onSave={handleSaveAdviseeAssignment} // Pass the handler
      />
    </SidebarProvider>
  )
}
