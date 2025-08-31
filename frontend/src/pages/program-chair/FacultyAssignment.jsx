import { useState, useEffect, useRef } from "react"
import { API_BASE_URL } from '@/config/api';
import { Search, Edit, Trash2, ArrowLeft, PlusCircle, Loader2, AlertTriangle, ChevronsUpDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogPortal,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useNavigate, useParams } from "react-router-dom"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/App-sidebar"
import Header from "@/components/layout/Header"
import { PaginationComponent } from "@/components/shared/PaginationComponent"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useActive } from "@/contexts/ActiveContext"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"

// Sample data for subjects
const subjectsData = [
  { id: "s1", code: "GEC4000", title: "Purposive Communications" },
  { id: "s2", code: "GEC8000", title: "Science, Technology, and Society" },
  { id: "s3", code: "GEE1000", title: "Living in the IT Era" },
  { id: "s4", code: "NSTP1101", title: "National Service Training Program" },
  { id: "s5", code: "PE1101", title: "PATHFIT 1" },
  { id: "s6", code: "CCIS1101", title: "Introduction to Computing Lec" },
]

// Sample data for sections
const sectionsData = [
  { id: "sec1", name: "BSIS 2022-A", year: "1st Year", semester: "1st Semester" },
  { id: "sec2", name: "BSIS 2022-B", year: "1st Year", semester: "1st Semester" },
  { id: "sec3", name: "BSIS 2023-A", year: "1st Year", semester: "1st Semester" },
  { id: "sec4", name: "BSIS 2023-B", year: "1st Year", semester: "1st Semester" },
]

// Sample data for semesters
const semesterData = [
  { id: "sem1", name: "1st Semester" },
  { id: "sem2", name: "2nd Semester" },
  { id: "sem3", name: "Summer" },
]

export default function FacultyAssignment() {
  const navigate = useNavigate()
  const { facultyId } = useParams()
  const { activeAcademicYear, activeSemester } = useActive()
  const { user } = useAuth()

  // State for fetched data
  const [facultyInfo, setFacultyInfo] = useState(null)
  const [assignedCourses, setAssignedCourses] = useState([])
  const [advisees, setAdvisees] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Existing state
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("teaching load")
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isEditAssignmentDialogOpen, setIsEditAssignmentDialogOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [validationMessage, setValidationMessage] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [assignmentToDelete, setAssignmentToDelete] = useState(null)
  const [courseFilter, setCourseFilter] = useState("")
  const [sectionFilter, setSectionFilter] = useState("")
  const [isAssignAdviseeDialogOpen, setIsAssignAdviseeDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)

  // State for Edit Dialog (keep if edit functionality is separate)
  const [newAssignment, setNewAssignment] = useState({
    courseId: "",
    sectionId: "",
    semesterId: "",
  })

  // State for dynamic data fetching (Sections for Dialogs)
  const [sectionsData, setSectionsDataState] = useState([]);
  const [coursesData, setCoursesData] = useState([]); // General courses list if needed for Edit Dialog
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false); // General course loading if needed

  // --- State for Program Chair's Programs (copied from ManageFaculty) ---
  const [programs, setPrograms] = useState([]);
  const [assignedProgramIds, setAssignedProgramIds] = useState([]);
  const [loadingProgramData, setLoadingProgramData] = useState(true);

  // --- Fetch Program Chair's Assigned Programs (copied from ManageFaculty) ---
  useEffect(() => {
    const fetchProgramChairData = async () => {
      if (!user || !user.id) {
        console.log("User data not available yet for fetching programs.");
        setLoadingProgramData(false);
        return;
      }
      setLoadingProgramData(true);
      console.log("Fetching programs for Program Chair ID:", user.id);
      try {
        const programResponse = await fetch(`${API_BASE_URL}/program/read_by_program_chair.php?id=${user.id}`);
        const programData = await programResponse.json();
        if (!programResponse.ok) {
          console.error("Failed to fetch programs:", programData.message);
          setError(prev => prev || `Failed to load assigned programs: ${programData.message}`);
          setPrograms([]);
          setAssignedProgramIds([]);
          return;
        }
        setPrograms(programData);
        const programIds = programData.map(program => program.id);
        setAssignedProgramIds(programIds);
        console.log("Program Chair's Assigned Programs:", programData);
        console.log("Program IDs for filtering:", programIds);
      } catch (error) {
        console.error("Error fetching program chair data:", error);
        setError(prev => prev || "Error loading assigned programs.");
        setPrograms([]);
        setAssignedProgramIds([]);
      } finally {
        setLoadingProgramData(false);
      }
    };
    fetchProgramChairData();
  }, [user]);

  // Fetch primary faculty data
  useEffect(() => {
    if (!facultyId) {
      setError("Faculty ID not found in URL.")
      setIsLoading(false)
      return
    }
    const fetchFacultyData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `${API_BASE_URL}/program_chair/read_single_faculty_assignment.php?faculty_id=${facultyId}`,
        )
        if (!response.ok) {
          let errorMsg = `HTTP error! status: ${response.status}`
          try { const errorData = await response.json(); errorMsg = errorData.message || errorData.error_details_debug || errorMsg } catch (e) { /* ignore */ }
          throw new Error(errorMsg)
        }
        const data = await response.json()
        if (!data.facultyInfo) { throw new Error("Faculty not found."); }
        setFacultyInfo(data.facultyInfo)
        setAssignedCourses(data.assignedCourses || [])
        const fetchedAdvisees = data.advisees || []; // Store fetched advisees
        setAdvisees(fetchedAdvisees);
      } catch (error) {
        console.error("Fetching faculty assignment data failed:", error)
        setError(error.message || "Failed to fetch data. Please try again later.")
        setFacultyInfo(null)
        setAssignedCourses([])
        setAdvisees([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchFacultyData()
  }, [facultyId])

  // --- Fetch Sections (Updated with Program Filtering) ---
  useEffect(() => {
    const fetchSections = async () => {
      if (!activeAcademicYear?.id || !activeSemester?.id || loadingProgramData) {
        console.log("Waiting for AY/Sem or Program Chair data to fetch sections.");
        if (loadingProgramData) console.log("Program data is still loading.");
        else if (!activeAcademicYear?.id || !activeSemester?.id) console.log("Active AY/Sem not set.");
        setSectionsDataState([]); // Use renamed state setter
        return;
      }
      if (!loadingProgramData && assignedProgramIds.length === 0) {
          console.log("Program Chair has no assigned programs. Cannot fetch sections.");
          setSectionsDataState([]); // Use renamed state setter
          setLoadingSections(false);
          return;
      }
      console.log("Fetching sections for AY:", activeAcademicYear.id, "Sem:", activeSemester.id, "Programs:", assignedProgramIds);
      setLoadingSections(true);
      try {
        const url = `${API_BASE_URL}/program_chair/read_sections.php?academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}&status=active`;
        const response = await fetch(url);
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
        const data = await response.json();
        console.log("All sections data received:", data);
        const assignedProgramNames = programs.map(program => program.name);
        console.log("Filtering sections based on assigned program names:", assignedProgramNames);
        const filteredSections = data.filter(section => {
          if (section.program_name) { return assignedProgramNames.some(programName => section.program_name.includes(programName)); }
          if (section.program_id) { return assignedProgramIds.includes(parseInt(section.program_id)); }
          console.warn(`Section ${section.name} (ID: ${section.id}) has neither program_name nor program_id. Excluding.`);
          return false;
        });
        console.log("Filtered sections for program chair's programs:", filteredSections);
        setSectionsDataState(filteredSections); // Use renamed state setter
      } catch (error) {
        console.error("Error fetching sections:", error);
        setSectionsDataState([]); // Use renamed state setter
        setError(prev => prev || "Error loading sections.");
      } finally {
        setLoadingSections(false);
      }
    };
    fetchSections();
  }, [activeAcademicYear, activeSemester, loadingProgramData, assignedProgramIds, programs]);

  // Reset dialogs when component unmounts
  useEffect(() => {
    return () => {
      setIsAssignDialogOpen(false)
      setIsEditAssignmentDialogOpen(false)
      setShowValidationDialog(false)
      setShowDeleteDialog(false)
      setIsAssignAdviseeDialogOpen(false);
    }
  }, [])

  const handleEditAssignment = (assignment) => {
    const semesterId = semesterData.find(s => s.name === assignment.semester)?.id || "";
    // Use the fetched sectionsData state variable here
    const sectionId = sectionsData.find(s => s.name === assignment.section_name)?.id || "";
    setSelectedAssignment(assignment)
    setNewAssignment({
      courseId: assignment.course_id.toString(),
      sectionId: sectionId ? sectionId.toString() : "", // Ensure string for Select
      semesterId: semesterId,
    })
    setIsEditAssignmentDialogOpen(true)
  }

  const handleDeleteAssignment = (assignment) => {
    console.log("Attempting to delete assignment:", assignment)
    setAssignmentToDelete(assignment)
    setShowDeleteDialog(true)
  }

  const confirmDeleteAssignment = async () => {
    if (!assignmentToDelete) return;
    const toastId = toast.loading("Deleting assignment...");
    try {
      // --- API Call for Deletion ---
      const response = await fetch(`${API_BASE_URL}/program_chair/delete_assignment.php`, { // Replace with your actual delete endpoint
        method: 'DELETE', // Or POST if using body for ID
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentToDelete.assignment_id })
      });
      const data = await response.json();
      toast.dismiss(toastId);
      if (response.ok) {
        toast.success("Assignment deleted successfully");
        // --- Direct State Update ---
        setAssignedCourses(prevCourses => prevCourses.filter(a => a.assignment_id !== assignmentToDelete.assignment_id));
        // Optionally update facultyInfo counts
        setFacultyInfo(prevInfo => ({
          ...prevInfo,
          sectionsAssigned: Math.max(0, (prevInfo.sectionsAssigned || 0) - 1) // Decrement count
        }));
        // --- End Direct State Update ---
        setShowDeleteDialog(false);
        setAssignmentToDelete(null);
      } else {
        console.error("Error deleting assignment:", data.message);
        toast.error("Failed to delete assignment", { description: data.message || "Please try again." });
      }
    } catch (error) {
      toast.dismiss(toastId);
      console.error("Error in delete API call:", error);
      toast.error("Network error", { description: "Could not delete assignment." });
    }
  }

  // --- handleSaveAssignment (Updated to match ManageFaculty pattern) ---
  const handleSaveAssignment = async (assignmentData) => {
    if (!facultyInfo || !facultyInfo.faculty_id) {
        toast.error("Faculty information is missing.");
        return;
    }
    let toastId;
    try {
      toastId = toast.loading("Assigning course...", { description: "Processing your request." });
      const completeAssignmentData = {
        faculty_id: facultyInfo.faculty_id,
        section_id: assignmentData.sectionId,
        course_id: assignmentData.courseId
      };
      console.log("Saving course assignment:", completeAssignmentData);
      const response = await fetch(`${API_BASE_URL}/program_chair/assign_course.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeAssignmentData)
      });
      const data = await response.json(); // Get response data

      if (response.ok) {
        toast.dismiss(toastId);
        toast.success("Course assigned successfully", {
          description: `${data.course_code || 'Course'} assigned to ${data.section_name || 'section'}`
        });

        // --- Direct State Update ---
        // Ensure 'data' from API contains all necessary fields for the table row
        const newAssignmentEntry = {
          assignment_id: data.assignment_id, // CRITICAL: API must return the new ID
          course_id: data.course_id,
          course_code: data.course_code,
          course_title: data.course_title,
          section_id: data.section_id,
          section_name: data.section_name,
          year_level: data.year_level, // Ensure API returns these
          semester: data.semester,     // Ensure API returns these
        };

        // Add the new assignment to the local state
        setAssignedCourses(prevCourses => [...prevCourses, newAssignmentEntry]);

        // Optionally update facultyInfo counts displayed in the card
        setFacultyInfo(prevInfo => ({
          ...prevInfo,
          sectionsAssigned: (prevInfo.sectionsAssigned || 0) + 1 // Increment count
        }));
        // --- End Direct State Update ---

        setIsAssignDialogOpen(false); // Close the dialog

      } else {
        toast.dismiss(toastId);
        console.error("Error assigning course:", data.message);
        toast.error("Failed to assign course", {
          description: data.message || "Error assigning the course. Please try again."
        });
      }
    } catch (error) {
      if (toastId) toast.dismiss(toastId);
      console.error("Error in API call:", error);
      toast.error("Network error", {
        description: "Connection problem. Please check your network and try again."
      });
    }
  }

  // --- handleSaveEditAssignment (Keep separate logic for the Edit Dialog if needed) ---
  const handleSaveEditAssignment = async () => {
    if (!newAssignment.courseId || !newAssignment.sectionId || !newAssignment.semesterId || !selectedAssignment) {
      showError("Please select a course, section, and semester")
      return
    }
    const toastId = toast.loading("Updating assignment...");
    try {
      // --- API Call for Update ---
      const updateData = {
          assignment_id: selectedAssignment.assignment_id,
          course_id: newAssignment.courseId,
          section_id: newAssignment.sectionId,
          // Include semester_id if your backend needs it for update validation/logic
          // semester_id: newAssignment.semesterId
      };
      console.log("Updating assignment:", updateData);
      const response = await fetch(`${API_BASE_URL}/program_chair/update_assignment.php`, { // Replace with your actual update endpoint
        method: 'PUT', // Or POST
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      const data = await response.json();
      toast.dismiss(toastId);
      if (response.ok) {
        toast.success("Assignment updated successfully");
        // --- Direct State Update ---
        // Fetch updated details from response (assuming API returns the updated object)
        const updatedAssignmentEntry = {
          assignment_id: data.assignment_id,
          course_id: data.course_id,
          course_code: data.course_code,
          course_title: data.course_title,
          section_id: data.section_id,
          section_name: data.section_name,
          year_level: data.year_level,
          semester: data.semester,
        };
        setAssignedCourses(prevCourses => prevCourses.map(a =>
            a.assignment_id === updatedAssignmentEntry.assignment_id ? updatedAssignmentEntry : a
        ));
        // --- End Direct State Update ---
        setIsEditAssignmentDialogOpen(false);
        setSelectedAssignment(null);
        setNewAssignment({ courseId: "", sectionId: "", semesterId: "" });
      } else {
        console.error("Error updating assignment:", data.message);
        toast.error("Failed to update assignment", { description: data.message || "Please try again." });
      }
    } catch (error) {
      toast.dismiss(toastId);
      console.error("Error in update API call:", error);
      toast.error("Network error", { description: "Could not update assignment." });
    }
  }

  const handleDeleteAdvisee = async (advisee) => {
      if (!advisee || !facultyInfo) return;
      const toastId = toast.loading("Unassigning advisee...");
      try {
          // --- API Call for Unassigning Advisee ---
          // This likely involves removing the faculty_id from the section's advisor field
          // Or deleting a record from a section_advisors table
          const response = await fetch(`${API_BASE_URL}/program_chair/unassign_advisor.php`, { // Replace with your actual endpoint
              method: 'POST', // Or DELETE/PUT
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  faculty_id: facultyInfo.faculty_id,
                  section_id: advisee.section_id // Assuming advisee object has section_id
              })
          });
          const data = await response.json();
          toast.dismiss(toastId);
          if (response.ok) {
              toast.success("Advisee section unassigned successfully");
              // --- Direct State Update ---
              setAdvisees(prevAdvisees => prevAdvisees.filter(a => a.student_db_id !== advisee.student_db_id));
              // Update facultyInfo counts
              setFacultyInfo(prevInfo => ({
                  ...prevInfo,
                  advisedSectionsCount: Math.max(0, (prevInfo.advisedSectionsCount || 0) - 1),
                  // You might need to refetch adviseesAssigned count or recalculate
                  // adviseesAssigned: calculateNewAdviseeCount(advisees.filter(...))
              }));
              // --- End Direct State Update ---
          } else {
              console.error("Error unassigning advisee:", data.message);
              toast.error("Failed to unassign advisee", { description: data.message || "Please try again." });
          }
      } catch (error) {
          toast.dismiss(toastId);
          console.error("Error in unassign advisee API call:", error);
          toast.error("Network error", { description: "Could not unassign advisee." });
      }
  }

  const showError = (message) => {
    setValidationMessage(message)
    setShowValidationDialog(true)
  }

  // Filter assignments based on search query and course filter
  const filteredAssignments = assignedCourses.filter(
    (assignment) =>
      (assignment.course_code?.toLowerCase().includes(searchQuery.toLowerCase()) || // Add null checks
        assignment.course_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.section_name?.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (!courseFilter || courseFilter === "all" || assignment.course_id?.toString() === courseFilter),
  )

  // Filter advisees based on search query and section filter
  const filteredAdvisees = advisees.filter(
    (advisee) => {
      const searchMatch = (
        advisee.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        advisee.student_user_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        advisee.section_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      const sectionMatch = (!sectionFilter || sectionFilter === "all" || advisee.section_id?.toString() === sectionFilter);

      return searchMatch && sectionMatch;
    }
  )

  // Calculate pagination for courses
  const totalCoursesPages = Math.ceil(filteredAssignments.length / itemsPerPage)
  const indexOfLastCourseItem = currentPage * itemsPerPage
  const indexOfFirstCourseItem = indexOfLastCourseItem - itemsPerPage
  const currentCoursesItems = filteredAssignments.slice(indexOfFirstCourseItem, indexOfLastCourseItem)

  // Calculate pagination for advisees
  const totalAdviseesPages = Math.ceil(filteredAdvisees.length / itemsPerPage)
  const indexOfLastAdviseeItem = currentPage * itemsPerPage
  const indexOfFirstAdviseeItem = indexOfLastAdviseeItem - itemsPerPage
  const currentAdviseesItems = filteredAdvisees.slice(indexOfFirstAdviseeItem, indexOfLastAdviseeItem)

  // Handle page changes (reset page when tab changes or filters change)
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery, courseFilter, sectionFilter])

  const paginateCourses = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalCoursesPages) {
      setCurrentPage(pageNumber)
    }
  }
  const paginateAdvisees = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalAdviseesPages) {
      setCurrentPage(pageNumber)
    }
  }

  // Get unique courses for the filter dropdown from the currently assigned courses
  const uniqueCoursesForFilter = Array.from(new Map(assignedCourses.map(a => [a.course_id, a])).values())
    .sort((a, b) => a.course_code.localeCompare(b.course_code));

  // Get unique sections for the advisee filter dropdown (Use sectionsData instead of advisees)
  const uniqueAdviseeSectionsForFilter = Array.from(
    new Map(
      sectionsData // Use sectionsData fetched for the program chair
        .filter(s => s.id != null && s.name != null) // Ensure section has id and name
        .map(s => [s.id, { section_id: s.id, section_name: s.name }])
    ).values()
  ).sort((a, b) => (a.section_name || '').localeCompare(b.section_name || '')); // Sort safely

  // --- Dialog Components ---
  const ValidationDialog = ({ open, onOpenChange }) => (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) setValidationMessage(""); }}>
      <DialogPortal><DialogContent><DialogHeader><DialogTitle>Invalid Input</DialogTitle></DialogHeader><p>{validationMessage}</p><DialogFooter><Button variant="green" onClick={() => onOpenChange(false)}>OK</Button></DialogFooter></DialogContent></DialogPortal>
    </Dialog>
  )

  const DeleteConfirmationDialog = ({ open, onOpenChange }) => (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) setAssignmentToDelete(null); }}>
      <DialogPortal><DialogContent><DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader><p>Are you sure you want to remove this course assignment?</p><p className="text-sm text-muted-foreground">{assignmentToDelete && `${assignmentToDelete.course_code} - ${assignmentToDelete.course_title} (${assignmentToDelete.section_name})`}</p><DialogFooter className="flex justify-between"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="destructive" onClick={confirmDeleteAssignment}>Delete</Button></DialogFooter></DialogContent></DialogPortal>
    </Dialog>
  )

  // --- AssignCourseDialog (Copied from ManageFaculty, uses sectionsData) ---
  const AssignCourseDialog = ({ open, onOpenChange, faculty, onSave }) => {
    const [assignment, setAssignment] = useState({ courseId: "", sectionId: "" });
    const [dialogValidationError, setDialogValidationError] = useState("");
    const sectionPopoverTriggerRef = useRef(null);
    const coursePopoverTriggerRef = useRef(null);
    const [sectionSearchTerm, setSectionSearchTerm] = useState("");
    const [courseSearchTerm, setCourseSearchTerm] = useState("");
    const { activeAcademicYear, activeSemester } = useActive();
    const [filteredCourses, setFilteredCourses] = useState([]);
    const [loadingCoursesForSection, setLoadingCoursesForSection] = useState(false);

    useEffect(() => {
      if (!open || !assignment.sectionId) { setFilteredCourses([]); return; }
      const fetchCoursesForSection = async () => {
        setLoadingCoursesForSection(true);
        try {
          const url = new URL(`${API_BASE_URL}/program_chair/get_courses_for_section.php`);
          url.searchParams.append('section_id', assignment.sectionId);
          if (activeAcademicYear?.id) url.searchParams.append('academic_year_id', activeAcademicYear.id);
          if (activeSemester?.id) url.searchParams.append('semester_id', activeSemester.id);
          console.log("Fetching courses for section with URL:", url.toString());
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          console.log("Courses received from backend:", data);
          setFilteredCourses(data);
        } catch (error) {
          console.error("Error fetching courses for section:", error);
          setFilteredCourses([]);
          toast.error("Failed to load courses", { description: "Could not fetch courses for the selected section." });
        } finally { setLoadingCoursesForSection(false); }
      };
      fetchCoursesForSection();
    }, [assignment.sectionId, activeAcademicYear, activeSemester, open]);

    const handleSaveClick = () => {
      if (!assignment.courseId || !assignment.sectionId) { setDialogValidationError("Please select a course and section"); return; }
      setDialogValidationError("");
      onSave(assignment); // Calls the parent's handleSaveAssignment
    };
    const handleClose = () => { onOpenChange(false); };
    useEffect(() => {
      if (!open) {
        setAssignment({ courseId: "", sectionId: "" });
        setDialogValidationError("");
        setSectionSearchTerm("");
        setCourseSearchTerm("");
        setFilteredCourses([]);
        setLoadingCoursesForSection(false);
      } else {
         console.log("AssignCourseDialog opened for faculty:", faculty?.faculty_name);
         console.log("AY/Sem:", activeAcademicYear?.year, activeSemester?.name);
      }
    }, [open, faculty]);
    const handleSectionSelect = (sectionId) => {
      const numericId = Number(sectionId);
      setAssignment(prev => ({ ...prev, sectionId: numericId, courseId: "" }));
      setSectionSearchTerm("");
      sectionPopoverTriggerRef.current?.click();
    };
    const handleCourseSelect = (courseId) => {
        setAssignment(prev => ({ ...prev, courseId: courseId }));
        setCourseSearchTerm("");
        coursePopoverTriggerRef.current?.click();
    }

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogPortal>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Assign Teaching Load</DialogTitle>
              <DialogDescription>{faculty && `Assign a course to ${faculty.faculty_name} for ${activeAcademicYear?.year || 'N/A'} ${activeSemester?.name || 'N/A'}`}</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveClick(); }}>
              <div className="space-y-4 py-4">
                {dialogValidationError && (<p className="text-sm text-destructive">{dialogValidationError}</p>)}
                <div className="space-y-2">
                  <Label htmlFor="section">Section<span className="text-destructive">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild ref={sectionPopoverTriggerRef}>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-10">
                        <div className="flex items-center w-full">
                          {/* Use sectionsData here */}
                          <span className="text-left flex-1 truncate">{assignment.sectionId ? (sectionsData.find(section => Number(section.id) === Number(assignment.sectionId))?.name) : (<span className="text-muted-foreground">Select a section</span>)}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Search section..." value={sectionSearchTerm} onValueChange={setSectionSearchTerm} />
                        <CommandList>
                          {loadingSections ? ( <div className="flex items-center justify-center p-4"><Loader2 className="h-4 w-4 animate-spin mr-2" /><span>Loading sections...</span></div> ) : (
                            <ScrollArea className="h-[200px]">
                              <CommandEmpty>No section found.</CommandEmpty>
                              {/* Use sectionsData here */}
                              {sectionsData && sectionsData.length > 0 ? (
                                sectionsData
                                  .filter(option => option.name.toLowerCase().includes(sectionSearchTerm.toLowerCase()))
                                  .map((section) => ( <CommandItem key={section.id} value={section.name} onSelect={() => handleSectionSelect(section.id)} className="cursor-pointer"> <Check className={cn("mr-2 h-4 w-4", Number(assignment.sectionId) === Number(section.id) ? "opacity-100" : "opacity-0")} /> {section.name} </CommandItem> ))
                              ) : (<div className="p-4 text-center text-sm text-muted-foreground">No sections available for your programs in {activeAcademicYear?.year || 'AY'} {activeSemester?.name || 'Sem'}.</div>)}
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
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-10" disabled={!assignment.sectionId || loadingCoursesForSection}>
                        <div className="flex items-center w-full">
                          {assignment.courseId ? ( <div className="flex-1 min-w-0 flex flex-col text-left"> <div className="text-sm font-medium">{filteredCourses.find((course) => course.id === assignment.courseId)?.course_code}</div> <div className="text-xs text-muted-foreground truncate pr-2">{filteredCourses.find((course) => course.id === assignment.courseId)?.course_title}</div> </div> ) : (<span className="text-muted-foreground flex-1 text-left">{!assignment.sectionId ? "Select section first" : loadingCoursesForSection ? "Loading courses..." : "Select a course"}</span>)}
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Search course..." value={courseSearchTerm} onValueChange={setCourseSearchTerm} />
                        <CommandList>
                          {loadingCoursesForSection ? ( <div className="flex items-center justify-center p-4"><Loader2 className="h-4 w-4 animate-spin mr-2" /><span>Loading courses...</span></div> ) : filteredCourses.length === 0 ? ( <div className="p-4 text-center text-sm text-muted-foreground">No unassigned courses found for this section.</div> ) : (
                            <ScrollArea className="h-[200px]">
                              <CommandEmpty>No course found.</CommandEmpty>
                              {filteredCourses
                                .filter(course => course.course_code?.toLowerCase().includes(courseSearchTerm.toLowerCase()) || course.course_title?.toLowerCase().includes(courseSearchTerm.toLowerCase()))
                                .map((course) => ( <CommandItem key={course.id} value={course.course_code} onSelect={() => handleCourseSelect(course.id)} className="cursor-pointer"> <Check className={cn("mr-2 h-4 w-4", assignment.courseId === course.id ? "opacity-100" : "opacity-0")} /> {course.course_code} <span className="ml-2 text-muted-foreground text-xs truncate">{course.course_title}</span> </CommandItem> ))}
                            </ScrollArea>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
                <Button type="submit" variant="green" disabled={loadingCoursesForSection}>Assign Course</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    );
  };

  // --- AssignAdviseeDialog (Updated to show only unassigned sections) ---
  const AssignAdviseeDialog = ({ open, onOpenChange, faculty, onSave }) => {
    const [selectedSectionId, setSelectedSectionId] = useState("");
    const [dialogValidationError, setDialogValidationError] = useState("");
    const sectionPopoverTriggerRef = useRef(null);
    const [sectionSearchTerm, setSectionSearchTerm] = useState("");
    const { activeAcademicYear, activeSemester } = useActive();
    // Add state for sections without advisors, specific to this dialog
    const [sectionsWithoutAdvisors, setSectionsWithoutAdvisors] = useState([]);
    const [loadingUnassignedSections, setLoadingUnassignedSections] = useState(false);
    // Access programs and assignedProgramIds from the parent component's scope
    // (No need to pass as props since AssignAdviseeDialog is defined within FacultyAssignment)

    // Fetch sections without advisors when dialog opens or dependencies change
    useEffect(() => {
      const fetchSectionsWithoutAdvisors = async () => {
        // Ensure all required data is available
        if (!open || !activeAcademicYear?.id || !activeSemester?.id || assignedProgramIds.length === 0) {
          setSectionsWithoutAdvisors([]); // Clear if conditions aren't met
          return;
        }

        setLoadingUnassignedSections(true);
        try {
          // URL for sections without advisors, filtered by AY and Sem
          const url = `${API_BASE_URL}/program_chair/read_sections.php?academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}&filter_type=no_advisor&status=active`;

          console.log("Fetching sections without advisors for dialog:", url);

          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          // Get program names from the parent scope's 'programs' state
          const assignedProgramNames = programs.map(program => program.name);

          // Filter the fetched unassigned sections by the program chair's assigned programs
          const filteredSections = data.filter(section => {
            if (section.program_name) {
              return assignedProgramNames.some(programName =>
                section.program_name.includes(programName)
              );
            }
            if (section.program_id) {
              return assignedProgramIds.includes(parseInt(section.program_id));
            }
            console.warn(`Unassigned Section ${section.name} (ID: ${section.id}) has neither program_name nor program_id. Excluding.`);
            return false;
          });

          console.log("Filtered sections without advisors for dialog:", filteredSections);
          setSectionsWithoutAdvisors(filteredSections);
        } catch (error) {
          console.error("Error fetching sections without advisors:", error);
          setSectionsWithoutAdvisors([]); // Clear on error
          toast.error("Failed to load sections", { description: "Could not fetch unassigned sections." });
        } finally {
          setLoadingUnassignedSections(false);
        }
      };

      fetchSectionsWithoutAdvisors();
      // Dependencies: dialog open state, AY, Sem, and the program chair's program data
    }, [open, activeAcademicYear, activeSemester, programs, assignedProgramIds]);


    const handleSaveClick = () => {
      if (!selectedSectionId) {
        setDialogValidationError("Please select a section to advise.");
        return;
      }
      setDialogValidationError("");
      onSave({ sectionId: selectedSectionId }); // Calls the parent's handleSaveAdviseeAssignment
    };

    const handleClose = () => {
      onOpenChange(false);
      // Reset dialog-specific state on close
      setSelectedSectionId("");
      setDialogValidationError("");
      setSectionSearchTerm("");
      setSectionsWithoutAdvisors([]);
      setLoadingUnassignedSections(false);
    };

    // No need for this useEffect anymore, handleClose resets state
    // useEffect(() => {
    //   if (!open) {
    //     setSelectedSectionId("");
    //     setDialogValidationError("");
    //     setSectionSearchTerm("");
    //   } else {
    //     console.log("AssignAdviseeDialog opened for faculty:", faculty?.faculty_name);
    //     console.log("AY/Sem:", activeAcademicYear?.year, activeSemester?.name);
    //   }
    // }, [open, faculty, activeAcademicYear, activeSemester]);

    const handleSectionSelect = (sectionId) => {
      setSelectedSectionId(sectionId);
      setSectionSearchTerm("");
      sectionPopoverTriggerRef.current?.click(); // Close popover on select
    };

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogPortal>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Assign Advisee Section</DialogTitle>
              <DialogDescription>{faculty && `Assign a section for ${faculty.faculty_name} to advise in ${activeAcademicYear?.year || 'N/A'} ${activeSemester?.name || 'N/A'}`}</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveClick(); }}>
              <div className="space-y-4 py-4">
                {dialogValidationError && (<p className="text-sm text-destructive">{dialogValidationError}</p>)}
                <div className="space-y-2">
                  <Label htmlFor="advisee-section">Section<span className="text-destructive">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild ref={sectionPopoverTriggerRef}>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-10">
                        <div className="flex items-center w-full">
                          <span className="text-left flex-1 truncate">
                            {selectedSectionId
                              // Find the selected section name in the fetched unassigned sections list
                              ? (sectionsWithoutAdvisors.find(section => Number(section.id) === Number(selectedSectionId))?.name)
                              : (<span className="text-muted-foreground">Select a section</span>)
                            }
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Search section..." value={sectionSearchTerm} onValueChange={setSectionSearchTerm} />
                        <CommandList>
                          {/* Use the dialog-specific loading state */}
                          {loadingUnassignedSections ? (
                            <div className="flex items-center justify-center p-4"><Loader2 className="h-4 w-4 animate-spin mr-2" /><span>Loading sections...</span></div>
                          ) : (
                            <ScrollArea className="h-[200px]">
                              <CommandEmpty>No section found.</CommandEmpty>
                              {/* Use the dialog-specific sectionsWithoutAdvisors state */}
                              {sectionsWithoutAdvisors && sectionsWithoutAdvisors.length > 0 ? (
                                sectionsWithoutAdvisors
                                  .filter(option => option.name.toLowerCase().includes(sectionSearchTerm.toLowerCase()))
                                  .map((section) => (
                                    <CommandItem key={section.id} value={section.name} onSelect={() => handleSectionSelect(section.id)} className="cursor-pointer">
                                      <Check className={cn("mr-2 h-4 w-4", Number(selectedSectionId) === Number(section.id) ? "opacity-100" : "opacity-0")} />
                                      {section.name}
                                      {/* Advisor name won't be present here as we fetched unassigned ones */}
                                    </CommandItem>
                                  ))
                              ) : (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  {/* Updated message */}
                                  {`No unassigned sections found for your programs in ${activeAcademicYear?.year || 'AY'} ${activeSemester?.name || 'Sem'}.`}
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
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
                {/* Disable button while loading sections */}
                <Button type="submit" variant="green" disabled={loadingUnassignedSections}>Assign Section</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    );
  };

  // --- Refetch function (extracted for reuse) ---
  const fetchFacultyData = async () => {
    if (!facultyId) {
      setError("Faculty ID not found.")
      setIsLoading(false)
      return
    }
    // Optionally set loading state if you want visual feedback during refetch
    // setIsLoading(true);
    setError(null)
    try {
      const response = await fetch(
        `${API_BASE_URL}/program_chair/read_single_faculty_assignment.php?faculty_id=${facultyId}`,
      )
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`
        try { const errorData = await response.json(); errorMsg = errorData.message || errorData.error_details_debug || errorMsg } catch (e) { /* ignore */ }
        throw new Error(errorMsg)
      }
      const data = await response.json()
      if (!data.facultyInfo) { throw new Error("Faculty not found after update."); }
      setFacultyInfo(data.facultyInfo)
      setAssignedCourses(data.assignedCourses || [])
      setAdvisees(data.advisees || [])
    } catch (error) {
      console.error("Refetching faculty assignment data failed:", error)
      toast.error("Failed to refresh data", { description: error.message || "Could not update faculty details." });
      // Keep existing data or clear it? Decide based on desired UX
      // setFacultyInfo(null); setAssignedCourses([]); setAdvisees([]);
    } finally {
      // setIsLoading(false); // Turn off loading indicator if set
    }
  }

  // --- handleSaveAdviseeAssignment (Updated to refetch data) ---
  const handleSaveAdviseeAssignment = async (assignmentData) => {
    if (!facultyInfo || !facultyInfo.faculty_id || !assignmentData.sectionId) {
      toast.error("Faculty or Section information is missing.");
      return;
    }
    let toastId;
    try {
      toastId = toast.loading("Assigning advisor...", { description: "Processing your request." });
      const payload = {
        faculty_id: facultyInfo.faculty_id,
        section_id: assignmentData.sectionId
      };
      console.log("Assigning advisor:", payload);
      // Endpoint should handle assigning faculty_id to section's advisor field,
      // potentially overwriting an existing one.
      const response = await fetch(`${API_BASE_URL}/program_chair/assign_advisor.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.ok) {
        toast.dismiss(toastId);
        // Assuming the API returns the section name for the description
        toast.success("Advisor assigned successfully", {
          description: `${facultyInfo.faculty_name} assigned to advise ${data.section_name || 'section'}`
        });

        // --- Refetch Data ---
        // Refetch all data for this faculty to ensure advisee list and counts are updated correctly.
        await fetchFacultyData();
        // --- End Refetch Data ---

        setIsAssignAdviseeDialogOpen(false); // Close the dialog

      } else {
        toast.dismiss(toastId);
        console.error("Error assigning advisor:", data.message);
        toast.error("Failed to assign advisor", {
          description: data.message || "Error assigning the advisor. Please try again."
        });
      }
    } catch (error) {
      if (toastId) toast.dismiss(toastId);
      console.error("Error in assign advisor API call:", error);
      toast.error("Network error", {
        description: "Connection problem. Please check your network and try again."
      });
    }
  };

  // --- Render Logic ---
  if (isLoading || loadingProgramData) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="w-full">
          <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
          <div className="flex justify-center items-center h-[calc(100vh-theme(space.16))]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2">Loading data...</span>
          </div>
        </main>
      </SidebarProvider>
    )
  }

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="w-full">
          <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
          <div className="p-4 md:p-6">
             <Button variant="ghost" className="mb-4" onClick={() => navigate("/program-chair/manage-faculty")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Manage Faculty
              </Button>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        </main>
      </SidebarProvider>
    )
  }

   if (!facultyInfo) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="w-full">
          <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
          <div className="p-4 md:p-6">
             <Button variant="ghost" className="mb-4" onClick={() => navigate("/program-chair/manage-faculty")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Manage Faculty
              </Button>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>Faculty data could not be loaded. The faculty ID might be invalid or an error occurred.</AlertDescription>
            </Alert>
          </div>
        </main>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <Toaster />
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        <div className="w-full">
          <ValidationDialog open={showValidationDialog} onOpenChange={setShowValidationDialog} />
          <DeleteConfirmationDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />

          <AssignCourseDialog
            open={isAssignDialogOpen}
            onOpenChange={setIsAssignDialogOpen}
            faculty={facultyInfo}
            onSave={handleSaveAssignment}
          />

          <AssignAdviseeDialog
            open={isAssignAdviseeDialogOpen}
            onOpenChange={setIsAssignAdviseeDialogOpen}
            faculty={facultyInfo}
            onSave={handleSaveAdviseeAssignment}
          />

          <Dialog open={isEditAssignmentDialogOpen} onOpenChange={setIsEditAssignmentDialogOpen}>
             <DialogPortal>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold">Edit Teaching Load Assignment</DialogTitle>
                  <DialogDescription>{selectedAssignment && `Editing ${selectedAssignment.course_code} - ${selectedAssignment.section_name}`}</DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); handleSaveEditAssignment(); }}>
                   <div className="space-y-4 py-4">
                     <div className="space-y-2">
                       <Label id="edit-semester-label">Semester<span className="text-destructive">*</span></Label>
                       <Select aria-labelledby="edit-semester-label" value={newAssignment.semesterId} onValueChange={(value) => setNewAssignment({ ...newAssignment, semesterId: value, sectionId: '' })}>
                         <SelectTrigger><SelectValue placeholder="Select a semester" /></SelectTrigger>
                         <SelectContent>{semesterData.map((semester) => ( <SelectItem key={semester.id} value={semester.id}>{semester.name}</SelectItem> ))}</SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-2">
                       <Label id="edit-section-label">Section<span className="text-destructive">*</span></Label>
                       <Select aria-labelledby="edit-section-label" value={newAssignment.sectionId} onValueChange={(value) => setNewAssignment({ ...newAssignment, sectionId: value })} disabled={!newAssignment.semesterId || loadingSections}>
                         <SelectTrigger><SelectValue placeholder={!newAssignment.semesterId ? "Select semester first" : loadingSections ? "Loading..." : "Select a section"} /></SelectTrigger>
                         <SelectContent>
                           {loadingSections ? ( <div className="flex items-center justify-center p-4"><Loader2 className="h-4 w-4 animate-spin mr-2" /><span>Loading...</span></div> ) : (
                               // Use sectionsData here
                               sectionsData
                               // Optional: Filter sectionsData based on newAssignment.semesterId if needed
                               .map((section) => ( <SelectItem key={section.id} value={section.id.toString()}>{section.name}</SelectItem> ))
                           )}
                           {!loadingSections && sectionsData.length === 0 && <div className="p-2 text-sm text-muted-foreground">No sections found for your programs.</div>}
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-2">
                       <Label id="edit-course-label">Course<span className="text-destructive">*</span></Label>
                       <Select aria-labelledby="edit-course-label" value={newAssignment.courseId} onValueChange={(value) => setNewAssignment({ ...newAssignment, courseId: value })}>
                         <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                         <SelectContent>
                           {/* TODO: Populate with relevant courses. Fetch dynamically based on section/semester? */}
                           {coursesData.map((course) => ( <SelectItem key={course.id} value={course.id.toString()}>{course.course_code} - {course.course_title}</SelectItem> ))}
                            {coursesData.length === 0 && <div className="p-2 text-sm text-muted-foreground">No courses found.</div>}
                         </SelectContent>
                       </Select>
                     </div>
                   </div>
                   <DialogFooter className="mt-6">
                     <Button type="button" variant="outline" onClick={() => setIsEditAssignmentDialogOpen(false)}>Cancel</Button>
                     <Button type="submit" variant="green">Update Assignment</Button>
                   </DialogFooter>
                </form>
              </DialogContent>
            </DialogPortal>
          </Dialog>

          <div className="p-4 md:p-6">
            <div className="flex items-center mb-6">
              <Button variant="ghost" className="mr-2" onClick={() => navigate("/program-chair/manage-faculty")}> <ArrowLeft className="h-4 w-4 mr-2" /> Back </Button>
              <div>
                <h1 className="text-2xl font-semibold text-[#1b4b2a]">{facultyInfo.faculty_name}</h1>
                <p className="text-muted-foreground">{facultyInfo.role} • {facultyInfo.department_name} • A.Y. {activeAcademicYear?.year || 'N/A'} {activeSemester?.name || 'N/A'}</p>
              </div>
            </div>

            <Card className="mb-6 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-80">
              <CardHeader className="pb-3"><CardTitle>Faculty Information</CardTitle><CardDescription>Details and current assignments</CardDescription></CardHeader>
              <CardContent><div className="flex flex-wrap items-baseline gap-x-6 gap-y-3"><div><p className="text-sm font-medium text-muted-foreground">Email</p><p className="text-base">{facultyInfo.email}</p></div><div className="md:pl-6 md:border-l border-gray-300"><p className="text-sm font-medium text-muted-foreground">Sections Assigned</p><p className="text-base">{facultyInfo.sectionsAssigned}</p></div><div className="md:pl-6 md:border-l border-gray-300"><p className="text-sm font-medium text-muted-foreground">Advised Sections</p><p className="text-base">{facultyInfo.advisedSectionsCount}</p></div><div className="md:pl-6 md:border-l border-gray-300"><p className="text-sm font-medium text-muted-foreground">Number of Advisees</p><p className="text-base">{facultyInfo.adviseesAssigned}</p></div></div></CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-emerald-50 dark:bg-emerald-900/30 border-[1px] border-emerald-200 dark:border-emerald-80">
                  <TabsTrigger value="teaching load">Teaching Load</TabsTrigger>
                  <TabsTrigger value="advisees">Advisees</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <div className="relative w-full md:w-auto flex-grow sm:flex-grow-0 sm:w-60">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={`Search ${activeTab}...`}
                      className="pl-8 h-9 rounded-md"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {activeTab === "teaching load" && (
                    <>
                      <Select value={courseFilter} onValueChange={setCourseFilter}>
                        <SelectTrigger className="w-auto sm:w-[200px] h-9">
                          <SelectValue placeholder="Filter by course" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Courses</SelectItem>
                          {uniqueCoursesForFilter.map((course) => (
                            <SelectItem key={course.course_id} value={course.course_id.toString()}>
                              {course.course_code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="green" onClick={() => setIsAssignDialogOpen(true)}>
                        <PlusCircle className="h-4 w-4 mr-1" /> Assign Teaching Load
                      </Button>
                    </>
                  )}
                  {activeTab === "advisees" && (
                    <>
                      <Select value={sectionFilter} onValueChange={setSectionFilter}>
                        <SelectTrigger className="w-auto sm:w-[200px] h-9">
                          <SelectValue placeholder="Filter by section" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sections</SelectItem>
                          {uniqueAdviseeSectionsForFilter.map((section) => (
                            <SelectItem key={section.section_id} value={section.section_id.toString()}>
                              {section.section_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="green" onClick={() => setIsAssignAdviseeDialogOpen(true)}>
                        <PlusCircle className="h-4 w-4 mr-1" /> Assign Advisee Section
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <TabsContent value="teaching load" className="mt-0">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/80">
                      <TableRow>
                        <TableHead className="px-3 py-2 font-medium">Course Code</TableHead>
                        <TableHead className="px-3 py-2 font-medium">Course Title</TableHead>
                        <TableHead className="px-3 py-2 font-medium">Section</TableHead>
                        <TableHead className="px-3 py-2 font-medium">Year Level</TableHead>
                        <TableHead className="px-3 py-2 font-medium">Semester</TableHead>
                        <TableHead className="text-right px-3 py-2 font-medium">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentCoursesItems.length > 0 ? (
                        currentCoursesItems.map((assignment) => (
                          <TableRow key={assignment.assignment_id}>
                            <TableCell className="px-3 py-2 font-medium">{assignment.course_code}</TableCell>
                            <TableCell className="px-3 py-2">{assignment.course_title}</TableCell>
                            <TableCell className="px-3 py-2">{assignment.section_name}</TableCell>
                            <TableCell className="px-3 py-2">{assignment.year_level}</TableCell>
                            <TableCell className="px-3 py-2"><Badge variant="outline">{assignment.semester}</Badge></TableCell>
                            <TableCell className="text-right px-3 py-2">
                              <div className="flex justify-end gap-2">
                                <Button size="icon" variant="outline" className="p-2 h-8 w-8" onClick={() => handleEditAssignment(assignment)} aria-label="Edit Assignment">
                                  <Edit size={16} />
                                </Button>
                                <Button size="icon" variant="destructive" className="p-2 h-8 w-8" onClick={() => handleDeleteAssignment(assignment)} aria-label="Delete Assignment">
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            {searchQuery || courseFilter ? "No matching teaching loads found." : "No teaching loads assigned yet."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filteredAssignments.length > 0 && (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4">
                    <div className="flex flex-row items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        Showing <span className="font-medium">{indexOfFirstCourseItem + 1}</span> to <span className="font-medium">{Math.min(indexOfLastCourseItem, filteredAssignments.length)}</span> of <span className="font-medium">{filteredAssignments.length}</span> entries
                      </div>
                      <div className="flex items-center mt-0 sm:mt-0">
                        <Select value={itemsPerPage.toString()} onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}>
                          <SelectTrigger className="h-8 w-[70px]"><SelectValue placeholder={itemsPerPage} /></SelectTrigger>
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
                      <PaginationComponent currentPage={currentPage} totalPages={totalCoursesPages} onPageChange={paginateCourses} />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="advisees" className="mt-0">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/80">
                      <TableRow>
                        <TableHead className="px-3 py-2 font-medium">Student ID</TableHead>
                        <TableHead className="px-3 py-2 font-medium">Name</TableHead>
                        <TableHead className="px-3 py-2 font-medium">Section</TableHead>
                        <TableHead className="px-3 py-2 font-medium">Year Level</TableHead>
                        <TableHead className="text-right px-3 py-2 font-medium">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentAdviseesItems.length > 0 ? (
                        currentAdviseesItems.map((advisee) => (
                          <TableRow key={advisee.student_db_id}>
                            <TableCell className="px-3 py-2 font-medium">{advisee.student_user_id}</TableCell>
                            <TableCell className="px-3 py-2">{advisee.student_name}</TableCell>
                            <TableCell className="px-3 py-2">{advisee.section_name}</TableCell>
                            <TableCell className="px-3 py-2">{advisee.year_level}</TableCell>
                            <TableCell className="text-right px-3 py-2">
                              <div className="flex justify-end gap-2">
                                <Button size="icon" variant="destructive" className="p-2 h-8 w-8" onClick={() => handleDeleteAdvisee(advisee)} aria-label="Unassign Advisee">
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            {searchQuery || sectionFilter ? "No matching advisees found." : "No advisees assigned yet."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filteredAdvisees.length > itemsPerPage && (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4">
                    <div className="flex flex-row items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        Showing <span className="font-medium">{indexOfFirstAdviseeItem + 1}</span> to <span className="font-medium">{Math.min(indexOfLastAdviseeItem, filteredAdvisees.length)}</span> of <span className="font-medium">{filteredAdvisees.length}</span> entries
                      </div>
                      <div className="flex items-center mt-0 sm:mt-0">
                        <Select value={itemsPerPage.toString()} onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}>
                          <SelectTrigger className="h-8 w-[70px]"><SelectValue placeholder={itemsPerPage} /></SelectTrigger>
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
                      <PaginationComponent currentPage={currentPage} totalPages={totalAdviseesPages} onPageChange={paginateAdvisees} />
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}
