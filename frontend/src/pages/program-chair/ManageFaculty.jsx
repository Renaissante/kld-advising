import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/App-sidebar"
import Header from "@/components/layout/Header"
import { useState, useEffect, useRef } from "react"
import { Search, Trash2, Calendar, MoreHorizontal, Loader2, AlertTriangle } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { useNavigate } from "react-router-dom"
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PaginationComponent } from "@/components/shared/PaginationComponent";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [validationMessage, setValidationMessage] = useState("")
  const { activeAcademicYear, activeSemester } = useActive()

  // New state for advisor status dialog
  const [showAdvisorStatusDialog, setShowAdvisorStatusDialog] = useState(false);

  // State for faculty list, loading, and error
  const [facultyList, setFacultyList] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)

  // Debug logging for active academic year and semester
  useEffect(() => {
    console.log("Active Academic Year:", activeAcademicYear);
    console.log("Active Semester:", activeSemester);
  }, [activeAcademicYear, activeSemester]);

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
  const totalPages = Math.ceil(filteredFaculty.length / 5) // itemsPerPage is hardcoded to 5
  const indexOfLastItem = currentPage * 5
  const indexOfFirstItem = indexOfLastItem - 5
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
      setShowValidationDialog(false)
    }
  }, [])

  // Reset current page when search query changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const handleUpdateAdvisorStatus = async (facultyId, newStatus) => {
    try {
      const toastId = toast.loading("Updating advisor status...", {
        description: "Processing your request."
      });
      
      const response = await fetch(`${API_BASE_URL}/faculty/update_advisor_status.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ advisor_id: facultyId, new_status: newStatus })
      });
      
      const data = await response.json();
      toast.dismiss(toastId);
      
      if (response.ok) {
        toast.success("Advisor status updated", {
          id: `update-status-success-${facultyId}-${Date.now()}`,
          description: `Status for ${facultyId} changed to ${newStatus}.`
        });

        // Update the faculty list state
        setFacultyList(prevList =>
          prevList.map(faculty =>
            faculty.faculty_id === facultyId ? { ...faculty, advisor_status: newStatus } : faculty
          )
        );
      } else {
        console.error("Error updating advisor status:", data.message);
        toast.error("Failed to update status", {
          id: `update-status-error-${facultyId}-${Date.now()}`,
          description: data.message || "Error updating advisor status. Please try again."
        });
      }
    } catch (error) {
      toast.dismiss();
      console.error("Network error updating advisor status:", error);
      toast.error("Network error", {
        id: `update-status-network-error-${facultyId}-${Date.now()}`,
        description: "Connection problem. Please check your network and try again."
      });
    }
  };

  const showError = (message) => {
    setValidationMessage(message)
    setShowValidationDialog(true)
  }

  // Remove fetch for sections based on active academic year and semester
  // This useEffect and the two following useEffects (fetchCourses and fetchCurriculum) are now removed
  // as they were primarily used by the AssignCourseDialog and AssignAdviseeDialog, which are being removed.
  // If any other part of ManageFaculty.jsx still needs sections, courses, or curriculum data,
  // a new useEffect specific to that need would have to be added.

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

  const AdvisorStatusDialog = ({ open, onOpenChange, faculty, onUpdateStatus }) => {
    if (!faculty) return null; // Don't render if no faculty selected

    const newStatus = faculty.advisor_status === 'available' ? 'unavailable' : 'available';
    const confirmationMessage = `Are you sure you want to mark ${faculty.faculty_name} (${faculty.email}) as ${newStatus}?`;

    const handleConfirm = () => {
      onUpdateStatus(faculty.faculty_id, newStatus);
      onOpenChange(false); // Close the dialog after action
    };

    const handleClose = () => {
      onOpenChange(false);
    };

    return (
      <Dialog open={open} onOpenChange={handleClose}>
      <DialogPortal>
          <DialogContent className="max-w-md">
          <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Confirm Advisor Status Change</DialogTitle>
          </DialogHeader>
            <p>
              {confirmationMessage}
            </p>
            {newStatus === 'unavailable' && (
              <p className="text-xs text-red-500 mt-2">
                Students assigned to this advisor will be listed under "Students With Unavailable Advisors" for other faculty.
              </p>
            )}
          <DialogFooter className="flex justify-between">
              <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
              <Button
                type="button"
                variant={newStatus === 'available' ? 'green' : 'destructive'}
                onClick={handleConfirm}
              >
                Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
    );
  };

  return (
    <SidebarProvider>
      <Toaster />
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        <ValidationDialog open={showValidationDialog} onOpenChange={setShowValidationDialog} />
        {/* <DeleteConfirmationDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} /> */}

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
                          <TableHead className="px-3 py-2 font-medium w-[120px]">Department</TableHead>
                          
                          <TableHead className="px-3 py-2 font-medium w-[130px]">Advisor Status</TableHead>
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
                              <TableCell className="px-3 py-2">{faculty.department_name}</TableCell>
                        
                        <TableCell className="px-3 py-2">
                          <Button
                            variant={faculty.advisor_status === 'available' ? 'outline' : 'destructive'}
                            size="sm"
                            onClick={() => {
                              setSelectedFaculty(faculty);
                              setShowAdvisorStatusDialog(true);
                            }}
                          >
                            {faculty.advisor_status === 'available' ? 'Available' : 'Unavailable'}
                          </Button>
                        </TableCell>
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
                                      <DropdownMenuItem onClick={() => navigate(`/program-chair/faculty-assignment/${faculty.faculty_id}`)}>
                                        <Calendar className="mr-2 h-4 w-4" />
                                        View Assignments
                                      </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                          ))
                          : // Show message when filtered list is empty
                          (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
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
                    <div className="text-sm text-muted-foreground">
                      Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{" "}
                      <span className="font-medium">{Math.min(indexOfLastItem, filteredFaculty.length)}</span> of{" "}
                      <span className="font-medium">{filteredFaculty.length}</span> entries
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
      <AdvisorStatusDialog
        open={showAdvisorStatusDialog}
        onOpenChange={setShowAdvisorStatusDialog}
        faculty={selectedFaculty}
        onUpdateStatus={handleUpdateAdvisorStatus}
      />
    </SidebarProvider>
  )
}
