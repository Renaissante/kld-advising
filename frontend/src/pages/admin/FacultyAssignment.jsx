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
// Removed: const subjectsData = [
// Removed:   { id: "s1", code: "GEC4000", title: "Purposive Communications" },
// Removed:   { id: "s2", code: "GEC8000", title: "Science, Technology, and Society" },
// Removed:   { id: "s3", code: "GEE1000", title: "Living in the IT Era" },
// Removed:   { id: "s4", code: "NSTP1101", title: "National Service Training Program" },
// Removed:   { id: "s5", code: "PE1101", title: "PATHFIT 1" },
// Removed:   { id: "s6", code: "CCIS1101", title: "Introduction to Computing Lec" },
// Removed: ]

// Sample data for sections
// Removed: const sectionsData = [
// Removed:   { id: "sec1", name: "BSIS 2022-A", year: "1st Year", semester: "1st Semester" },
// Removed:   { id: "sec2", name: "BSIS 2022-B", year: "1st Year", semester: "1st Semester" },
// Removed:   { id: "sec3", name: "BSIS 2023-A", year: "1st Year", semester: "1st Semester" },
// Removed:   { id: "sec4", name: "BSIS 2023-B", year: "1st Year", semester: "1st Semester" },
// Removed: ]

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
  const [advisees, setAdvisees] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Existing state
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("advisees") // Changed default tab
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [validationMessage, setValidationMessage] = useState("")
  const [isAssignAdviseeDialogOpen, setIsAssignAdviseeDialogOpen] = useState(false)
  const [showUnassignAdviseeDialog, setShowUnassignAdviseeDialog] = useState(false);
  const [adviseeSectionToUnassign, setAdviseeSectionToUnassign] = useState(null);
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)

  // State for dynamic data fetching (Sections for Dialogs)
  const [sectionsData, setSectionsDataState] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Refetch function (extracted for reuse)
  const fetchFacultyData = async () => {
    if (!facultyId) {
      setError("Faculty ID not found.")
      setIsLoading(false)
      return
    }
    setIsLoading(true); // Set loading true at the start of fetch
    setError(null)
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/read_single_faculty_assignment.php?faculty_id=${facultyId}&academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}&status=active`,
      )
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`
        try { const errorData = await response.json(); errorMsg = errorData.message || errorData.error_details_debug || errorMsg } catch (e) { /* ignore */ }
        throw new Error(errorMsg)
      }
      const data = await response.json()
      if (!data.facultyInfo) { throw new Error("Faculty not found after update."); }
      setFacultyInfo(data.facultyInfo)
      setAdvisees(data.advisees || [])
      // Calculate total advisees by summing student_count from each advised section
      const totalAdviseesCount = (data.advisees || []).reduce((sum, section) => sum + (section.student_count || 0), 0);
      setFacultyInfo(prevInfo => ({
        ...prevInfo,
        adviseesAssigned: totalAdviseesCount,
        advisedSectionsCount: (data.advisees || []).length // Ensure this is updated as well
      }));
    } catch (error) {
      console.error("Refetching faculty assignment data failed:", error)
      toast.error("Failed to refresh data", { description: error.message || "Could not update faculty details." });
    } finally {
      setIsLoading(false); // Turn off loading indicator
    }
  }

  // Fetch primary faculty data
  useEffect(() => {
    if (!facultyId) {
      setError("Faculty ID not found in URL.")
      setIsLoading(false)
      return
    }
    // Add check for activeAcademicYear and activeSemester
    if (!activeAcademicYear?.id || !activeSemester?.id) {
      console.log("Waiting for active academic year/semester to be set...");
      setIsLoading(false); // Ensure loading is turned off if we're waiting
      setError("Please select an active academic year and semester to view assignments.");
      return;
    }
    fetchFacultyData();
  }, [facultyId, activeAcademicYear, activeSemester])

  // --- Fetch Sections (Updated with Program Filtering) ---
  useEffect(() => {
    const fetchSections = async () => {
      if (!activeAcademicYear?.id || !activeSemester?.id) { // Removed loadingProgramData and assignedProgramIds.length === 0 check
        console.log("Waiting for AY/Sem to fetch sections.");
        if (!activeAcademicYear?.id || !activeSemester?.id) console.log("Active AY/Sem not set.");
        setSectionsDataState([]); // Use renamed state setter
        return;
      }
      // Removed the entire block for program chair filtering (lines 219-224)
      
      console.log("Fetching sections for AY:", activeAcademicYear.id, "Sem:", activeSemester.id);
      setLoadingSections(true);
      try {
        const url = `${API_BASE_URL}/admin/read_sections.php?academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}&status=active`;
        const response = await fetch(url);
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
        const data = await response.json();
        console.log("All sections data received:", data);
        // Removed program filtering logic (lines 233-240)
        setSectionsDataState(data); // Replaced with direct assignment
      } catch (error) {
        console.error("Error fetching sections:", error);
        setSectionsDataState([]); // Use renamed state setter
        setError(prev => prev || "Error loading sections.");
      } finally {
        setLoadingSections(false);
      }
    };
    fetchSections();
  }, [activeAcademicYear, activeSemester]);

  // Reset dialogs when component unmounts
  useEffect(() => {
    return () => {
      setShowValidationDialog(false)
      setIsAssignAdviseeDialogOpen(false);
    }
  }, [])

  const handleUnassignAdviseeSection = (adviseeSection) => {
    console.log("Attempting to unassign advisee section:", adviseeSection);
    setAdviseeSectionToUnassign(adviseeSection);
    setShowUnassignAdviseeDialog(true);
  };

  const confirmUnassignAdviseeSection = async () => {
      if (!adviseeSectionToUnassign || !facultyInfo) return;
      const toastId = toast.loading("Unassigning advisee...");
      try {
          const response = await fetch(`${API_BASE_URL}/admin/unassign_advisor.php`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  faculty_id: facultyInfo.faculty_id,
                  section_id: adviseeSectionToUnassign.section_id
              })
          });
          const data = await response.json();
          toast.dismiss(toastId);
          if (response.ok) {
              toast.success("Advisee section unassigned successfully", { id: `unassign-advisee-success-${facultyInfo.faculty_id}-${adviseeSectionToUnassign.section_id}-${Date.now()}` });
              await fetchFacultyData();
              setShowUnassignAdviseeDialog(false);
              setAdviseeSectionToUnassign(null);
          } else {
              console.error("Error unassigning advisee:", data.message);
              toast.error("Failed to unassign advisee section", { id: `unassign-advisee-error-${facultyInfo.faculty_id}-${adviseeSectionToUnassign.section_id}-${Date.now()}`, description: data.message || "Please try again." });
          }
      } catch (error) {
          toast.dismiss(toastId);
          console.error("Error in unassign advisee API call:", error);
          toast.error("Network error", { id: `unassign-advisee-network-error-${facultyInfo.faculty_id}-${Date.now()}`, description: "Could not unassign advisee section." });
      }
  };

  const showError = (message) => {
    setValidationMessage(message)
    setShowValidationDialog(true)
  }

  // Filter advisees based on search query and section filter
  const filteredAdvisees = advisees.filter(
    (advisee) => {
      return (
        advisee.section_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        advisee.year_level?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        advisee.semester?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  )

  // Calculate pagination for advisees
  const totalAdviseesPages = Math.ceil(filteredAdvisees.length / itemsPerPage)
  const indexOfLastAdviseeItem = currentPage * itemsPerPage
  const indexOfFirstAdviseeItem = indexOfLastAdviseeItem - itemsPerPage
  const currentAdviseesItems = filteredAdvisees.slice(indexOfFirstAdviseeItem, indexOfLastAdviseeItem)

  // Handle page changes (reset page when tab changes or filters change)
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery])

  const paginateAdvisees = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalAdviseesPages) {
      setCurrentPage(pageNumber)
    }
  }

  // --- Dialog Components ---
  const ValidationDialog = ({ open, onOpenChange }) => (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) setValidationMessage(""); }}>
      <DialogPortal><DialogContent><DialogHeader><DialogTitle>Invalid Input</DialogTitle></DialogHeader><p>{validationMessage}</p><DialogFooter><Button variant="green" onClick={() => onOpenChange(false)}>OK</Button></DialogFooter></DialogContent></DialogPortal>
    </Dialog>
  )

  const UnassignAdviseeConfirmationDialog = ({ open, onOpenChange, adviseeSection, onConfirm }) => (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) setAdviseeSectionToUnassign(null); }}>
      <DialogPortal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Unassign Advisee Section</DialogTitle>
            <DialogDescription asChild>
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Are you sure you want to unassign this advisee section?
                </p>
                {adviseeSection && (
                  <div className="bg-muted p-3 rounded-md text-sm">
                    <p><span className="font-semibold">Section:</span> {adviseeSection.section_name}</p>
                    <p><span className="font-semibold">Year Level:</span> {adviseeSection.year_level}</p>
                    <p><span className="font-semibold">Semester:</span> {adviseeSection.semester}</p>
                    <p><span className="font-semibold">Students:</span> {adviseeSection.student_count}</p>
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="destructive" onClick={onConfirm}>Unassign</Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );

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
        if (!open || !activeAcademicYear?.id || !activeSemester?.id) { // Removed assignedProgramIds.length === 0 check
          setSectionsWithoutAdvisors([]); // Clear if conditions aren't met
          return;
        }

        setLoadingUnassignedSections(true);
        try {
          // URL for sections without advisors, filtered by AY and Sem
          const url = `${API_BASE_URL}/admin/read_sections.php?academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}&filter_type=no_advisor&status=active`;

          console.log("Fetching sections without advisors for dialog:", url);

          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          // Removed program filtering logic (lines 800-815)
          setSectionsWithoutAdvisors(data); // Replaced with direct assignment
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
    }, [open, activeAcademicYear, activeSemester]);


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
                                  {`No unassigned sections found for ${activeAcademicYear?.year || 'AY'} ${activeSemester?.name || 'Sem'}.`}
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
      const response = await fetch(`${API_BASE_URL}/admin/assign_advisor.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.ok) {
        toast.dismiss(toastId);
        // Assuming the API returns the section name for the description
        toast.success("Advisor assigned successfully", {
          id: `assign-advisee-success-${facultyInfo.faculty_id}-${assignmentData.sectionId}-${Date.now()}`,
          description: `${facultyInfo.faculty_name} assigned to advise ${data.section_name || 'section'}`
        });

        // --- Refetch Data ---
        await fetchFacultyData();
        // --- End Refetch Data ---

        setIsAssignAdviseeDialogOpen(false); // Close the dialog

      } else {
        toast.dismiss(toastId);
        console.error("Error assigning advisor:", data.message);
        toast.error("Failed to assign advisor", {
          id: `assign-advisee-error-${facultyInfo.faculty_id}-${assignmentData.sectionId}-${Date.now()}`,
          description: data.message || "Error assigning the advisor. Please try again."
        });
      }
    } catch (error) {
      if (toastId) toast.dismiss(toastId);
      console.error("Error in assign advisor API call:", error);
      toast.error("Network error", {
        id: `assign-advisee-network-error-${facultyInfo.faculty_id}-${Date.now()}`,
        description: "Connection problem. Please check your network and try again."
      });
    }
  };

  // --- Render Logic ---
  if (isLoading) {
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
             <Button variant="ghost" className="mb-4" onClick={() => navigate("/admin/manage-advisors")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Manage Advisors
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
             <Button variant="ghost" className="mb-4" onClick={() => navigate("/admin/manage-advisors")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Manage Advisors
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
          <UnassignAdviseeConfirmationDialog
            open={showUnassignAdviseeDialog}
            onOpenChange={setShowUnassignAdviseeDialog}
            adviseeSection={adviseeSectionToUnassign}
            onConfirm={confirmUnassignAdviseeSection}
          />

          <AssignAdviseeDialog
            open={isAssignAdviseeDialogOpen}
            onOpenChange={setIsAssignAdviseeDialogOpen}
            faculty={facultyInfo}
            onSave={handleSaveAdviseeAssignment}
          />

          <div className="p-4 md:p-6">
            <div className="flex items-center mb-6">
              <Button variant="ghost" className="mr-2" onClick={() => navigate("/admin/manage-advisors")}> <ArrowLeft className="h-4 w-4 mr-2" /> Back </Button>
              <div>
                <h1 className="text-2xl font-semibold text-[#1b4b2a]">{facultyInfo.faculty_name}</h1>
                <p className="text-muted-foreground">{facultyInfo.role} • {facultyInfo.department_name} • A.Y. {activeAcademicYear?.year || 'N/A'} {activeSemester?.name || 'N/A'}</p>
              </div>
            </div>

            <Card className="mb-6 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-80">
              <CardHeader className="pb-3"><CardTitle>Faculty Information</CardTitle><CardDescription>Details and current assignments</CardDescription></CardHeader>
              <CardContent><div className="flex flex-wrap items-baseline gap-x-6 gap-y-3"><div><p className="text-sm font-medium text-muted-foreground">Email</p><p className="text-base">{facultyInfo.email}</p></div><div className="md:pl-6 md:border-l border-gray-300"><p className="text-sm font-medium text-muted-foreground">Assigned Advisee Sections</p><p className="text-base">{facultyInfo.advisedSectionsCount}</p></div><div className="md:pl-6 md:border-l border-gray-300"><p className="text-sm font-medium text-muted-foreground">Number of Advisees</p><p className="text-base">{facultyInfo.adviseesAssigned}</p></div></div></CardContent>
            </Card>

            {/* Removed: <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full"> */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-4">
                {/* Removed: <TabsList className="bg-emerald-50 dark:bg-emerald-900/30 border-[1px] border-emerald-200 dark:border-emerald-80">
                  <TabsTrigger value="advisees">Advisees</TabsTrigger>
                </TabsList> */}
                <h2 className="text-xl font-semibold text-[#1b4b2a]">Advisees</h2>
                <div className="flex items-center gap-2">
                  <div className="relative w-full md:w-auto flex-grow sm:flex-grow-0 sm:w-60">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={`Search advisees...`}
                      className="pl-8 h-9 rounded-md"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <>
                    <Button variant="green" onClick={() => setIsAssignAdviseeDialogOpen(true)}>
                      <PlusCircle className="h-4 w-4 mr-1" /> Assign Advisee Section
                    </Button>
                  </>
                </div>
              </div>

              {/* Converted TabsContent to a div directly */} 
              <div className="mt-0">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/80">
                      <TableRow>
                        <TableHead className="px-3 py-2 font-medium">Section</TableHead>
                        <TableHead className="px-3 py-2 font-medium">Year Level</TableHead>
                        <TableHead className="px-3 py-2 font-medium">Semester</TableHead>
                        <TableHead className="text-right px-3 py-2 font-medium">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentAdviseesItems.length > 0 ? (
                        currentAdviseesItems.map((advisee) => (
                          <TableRow key={advisee.section_id}>
                            <TableCell className="px-3 py-2">{advisee.section_name}</TableCell>
                            <TableCell className="px-3 py-2">{advisee.year_level}</TableCell>
                            <TableCell className="px-3 py-2"><Badge variant="outline">{advisee.semester}</Badge></TableCell>
                            <TableCell className="text-right px-3 py-2">
                              <div className="flex justify-end gap-2">
                                <Button size="icon" variant="destructive" className="p-2 h-8 w-8" onClick={() => handleUnassignAdviseeSection(advisee)} aria-label="Unassign Advisee">
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">{searchQuery ? "No matching advisee sections found." : "No advisee sections assigned yet."}</TableCell>
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
              </div>
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}

