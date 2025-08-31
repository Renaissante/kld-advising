"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Trash2, Users, Plus, Archive, RotateCcw, Search, Loader2, AlertTriangle, Edit } from "lucide-react"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PaginationComponent } from "@/components/shared/PaginationComponent";
import { API_BASE_URL } from '@/config/api';
import { useActive } from "@/contexts/ActiveContext"; // Assuming useActive is from ActiveContext
import { useAuth } from "@/hooks/useAuth"; // Import useAuth
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";




export default function ManageSections() {
  const { activeAcademicYear, activeSemester } = useActive();

  const [sections, setSections] = useState([]) // Initialize as empty array
  const [availableStudents, setAvailableStudents] = useState([]) // Initialize as empty array
  const [selectedSection, setSelectedSection] = useState(null)
  const [viewingStudentsFor, setViewingStudentsFor] = useState(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [showAssignStudentsDialogForSectionId, setShowAssignStudentsDialogForSectionId] = useState(null);
  const [isDeleteSectionDialogOpen, setIsDeleteSectionDialogOpen] = useState(false)
  const [isEditSectionDialogOpen, setIsEditSectionDialogOpen] = useState(false)
  const [isRemoveStudentConfirmDialogOpen, setIsRemoveStudentConfirmDialogOpen] = useState(false);
  const [studentToRemoveDetails, setStudentToRemoveDetails] = useState(null);
  const [isDeleteSectionConfirmDialogOpen, setIsDeleteSectionConfirmDialogOpen] = useState(false);
  const [sectionToDeleteDetails, setSectionToDeleteDetails] = useState(null);
  const [newSection, setNewSection] = useState({
    name: "",
    capacity: 30,
    yearLevel: null,
    program: null,
  })
  const [editedSection, setEditedSection] = useState(null); // State to hold section being edited
  const [searchQuery, setSearchQuery] = useState("")
  const [sectionSearchQuery, setSectionSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1);
  const [studentsPerPage] = useState(10); // You can adjust this value as needed
  const [selectedStudentsForAssignment, setSelectedStudentsForAssignment] = useState([]);
  const [assignStudentsActiveTab, setAssignStudentsActiveTab] = useState("available");

  // Loading and error states for API calls
  const [isLoadingSections, setIsLoadingSections] = useState(true);
  const [sectionsError, setSectionsError] = useState(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentsError, setStudentsError] = useState(null);

  // --- State for Program Chair's Programs ---
  const { user } = useAuth(); // Get user from auth context
  const [programs, setPrograms] = useState([]);
  const [assignedProgramIds, setAssignedProgramIds] = useState([]);
  const [loadingProgramData, setLoadingProgramData] = useState(true);
  const [yearLevels, setYearLevels] = useState([]); // State for year levels

  // Fetch year levels
  useEffect(() => {
    const fetchYearLevels = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/year_level/read.php`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setYearLevels(data.records || []);
      } catch (error) {
        console.error("Error fetching year levels:", error);
        toast.error("Failed to load year levels.");
      }
    };
    fetchYearLevels();
  }, []); // Empty dependency array means this runs once on mount

  // Refactored fetch functions using useCallback
  const fetchSections = useCallback(async () => {
    if (!activeAcademicYear?.id || !activeSemester?.id || loadingProgramData) {
        setIsLoadingSections(false);
      console.log("Waiting for AY/Sem or Program Chair data to fetch sections.");
      if (loadingProgramData) console.log("Program data is still loading.");
      else if (!activeAcademicYear?.id || !activeSemester?.id) console.log("Active AY/Sem not set.");
      setSections([]); // Clear sections if conditions aren't met
        return;
      }
    if (!loadingProgramData && assignedProgramIds.length === 0) {
      console.log("Program Chair has no assigned programs. Cannot fetch sections.");
      setSections([]);
      setIsLoadingSections(false);
      return;
    }
      setSectionsError(null);
      try {
      const programIdsParam = assignedProgramIds.length > 0 ? `&program_ids=${assignedProgramIds.join(',')}` : '';
      const apiUrl = `${API_BASE_URL}/program_chair/read_sections.php?academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}${programIdsParam}`;
      const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
      setSections(data || []);
      } catch (error) {
        console.error("Error fetching sections:", error);
      setSectionsError("Failed to load sections. Please try again.");
      setSections([]);
      } finally {
        setIsLoadingSections(false);
      }
  }, [activeAcademicYear, activeSemester, loadingProgramData, assignedProgramIds]); // Add activeTab to dependencies

  const fetchUnassignedStudents = useCallback(async () => {
      setIsLoadingStudents(true);
      setStudentsError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/student/read_unassigned_students.php?academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
      setAvailableStudents(data || []);
      } catch (error) {
        console.error("Error fetching unassigned students:", error);
      setStudentsError("Failed to load unassigned students. Please try again.");
      setAvailableStudents([]);
      } finally {
        setIsLoadingStudents(false);
    }
  }, [activeAcademicYear, activeSemester]);

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
          setSectionsError(prev => prev || `Failed to load assigned programs: ${programData.message}`);
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
        setSectionsError(prev => prev || "Error loading assigned programs.");
        setPrograms([]);
        setAssignedProgramIds([]);
      } finally {
        setLoadingProgramData(false);
      }
    };
    fetchProgramChairData();
  }, [user]); // Add fetchSections to dependencies to avoid stale closure warning

  // Main data fetching effect
  useEffect(() => {
    if (activeAcademicYear?.id && activeSemester?.id && !loadingProgramData) {
      if (assignedProgramIds.length > 0) {
      fetchSections();
      } else if (!loadingProgramData) {
        console.log("No assigned programs for program chair, clearing sections.");
        setSections([]);
        setIsLoadingSections(false);
      }
      fetchUnassignedStudents();
    } else if (!activeAcademicYear?.id || !activeSemester?.id) {
      setSections([]);
      setIsLoadingSections(false);
      setAvailableStudents([]);
      setIsLoadingStudents(false);
    }
  }, [activeAcademicYear, activeSemester, loadingProgramData, assignedProgramIds, fetchSections, fetchUnassignedStudents]);

  const getUnassignedStudents = () => {
    // This function will now filter from the `availableStudents` fetched from API
    // The API should already return truly unassigned students. We might need to adjust this logic
    // if API returns all students and we need to filter based on section_id client-side.
    // For now, assume API returns only students with section_id IS NULL for the current AY.
    return availableStudents;
  }

  const getFilteredUnassignedStudents = () => {
    const unassignedStudents = getUnassignedStudents()
    if (!searchQuery.trim()) return unassignedStudents

    const query = searchQuery.toLowerCase()
    return unassignedStudents.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        student.studentId.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
        (student.previousSection && student.previousSection.toLowerCase().includes(query)),
    )
  }

  // Pagination Logic for unassigned students
  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  const currentStudents = getFilteredUnassignedStudents().slice(indexOfFirstStudent, indexOfLastStudent);
  const totalPages = Math.ceil(getFilteredUnassignedStudents().length / studentsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleCreateSection = async () => {
    if (!newSection.name || !newSection.capacity || !newSection.program || !newSection.yearLevel || !activeAcademicYear?.id || !activeSemester?.id) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/program_chair/create_section.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newSection.name,
          capacity: newSection.capacity,
          program_id: newSection.program,
          year_level_id: newSection.yearLevel,
          academic_year_id: activeAcademicYear.id,
          semester_id: activeSemester.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      toast.success(data.message || `${newSection.name} has been created successfully.`);
      setIsCreateDialogOpen(false);
      fetchSections(); // Refresh the list of sections

    setNewSection({
      name: "",
        capacity: 40,
      yearLevel: null,
      program: null,
      });

    } catch (error) {
      console.error("Error creating section:", error);
      toast.error(error.message || "Failed to create section. Please try again.");
    }
  };

  const confirmRemoveStudent = async (studentDbId, sectionId, studentName, sectionName) => {
    setIsRemoveStudentConfirmDialogOpen(false);
    try {
      const response = await fetch(`${API_BASE_URL}/program_chair/unassign_student_from_section.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ student_id: studentDbId, section_id: sectionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      toast.success(data.message || `${studentName} has been unassigned from ${sectionName}.`);

      // Re-fetch sections and unassigned students to update the UI
      fetchSections();
      fetchUnassignedStudents();

    } catch (error) {
      console.error("Error unassigning student:", error);
      toast.error(error.message || "Failed to unassign student. Please try again.");
    } finally {
      setStudentToRemoveDetails(null);
    }
  };

  const confirmDeleteSection = async (sectionId, sectionName) => {
    setIsDeleteSectionConfirmDialogOpen(false);
    try {
      const response = await fetch(`${API_BASE_URL}/program_chair/delete_section.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ section_id: sectionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      toast.success(data.message || `${sectionName} has been permanently deleted.`);

      // Refresh the list of sections
      fetchSections();
      fetchUnassignedStudents(); // Refresh unassigned students list after section deletion

    } catch (error) {
      console.error("Error deleting section:", error);
      toast.error(error.message || "Failed to delete section. Please try again.");
    } finally {
      setSectionToDeleteDetails(null);
    }
  };

  const handleRemoveStudent = (studentId, sectionId, studentName, sectionName) => {
    setStudentToRemoveDetails({ studentDbId: studentId, sectionId, studentName, sectionName });
    setIsRemoveStudentConfirmDialogOpen(true);
  };

  const updateSectionStatus = async (sectionId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/program_chair/update_section_status.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ section_id: sectionId, status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      toast.success(data.message);

      // Optimistically update the UI or refetch sections
      setSections((prevSections) =>
        prevSections.map((section) =>
          section.id === sectionId ? { ...section, status: newStatus } : section
        )
      );
      fetchSections(); // Re-fetch sections to get updated student counts
      fetchUnassignedStudents(); // Re-fetch unassigned students as section_id might be set to NULL
    } catch (error) {
      console.error(`Error updating section status to ${newStatus}:`, error);
      toast.error(error.message || `Failed to set section to ${newStatus}.`)
    }
  }

  const handleArchiveSection = (sectionId) => {
    updateSectionStatus(sectionId, "archived");
  }

  const handleRestoreSection = (sectionId) => {
    updateSectionStatus(sectionId, "active");
  }

  const confirmUpdateSection = async () => {
    if (!editedSection || !editedSection.id || !editedSection.name || !editedSection.capacity || !editedSection.program || !editedSection.yearLevel) {
      toast.error("Incomplete section details for update.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/program_chair/update_section.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editedSection.id,
          name: editedSection.name,
          capacity: editedSection.capacity,
          program_id: editedSection.program,
          year_level_id: editedSection.yearLevel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      toast.success(data.message || `${editedSection.name} updated successfully.`);
      fetchSections(); // Refresh the list of sections

    } catch (error) {
      console.error("Error updating section:", error);
      toast.error(error.message || "Failed to update section. Please try again.");
    } finally {
      setEditedSection(null);
      setIsEditSectionDialogOpen(false); // Close dialog on both success and failure
    }
  };

  const handleEditSection = (section) => {
    setEditedSection({
      id: section.id,
      name: section.name,
      capacity: section.capacity,
      program: section.program_id, // Assuming program_id is what the select expects
      yearLevel: section.year_level_id, // Assuming year_level_id is what the select expects
    });
    setIsEditSectionDialogOpen(true);
  };

  const handleDeleteSection = (sectionId, sectionName) => {
    setSectionToDeleteDetails({ id: sectionId, name: sectionName });
    setIsDeleteSectionConfirmDialogOpen(true);
  }

  const handleAssignSelectedStudents = async (studentIds) => {
    if (!selectedSection) return;

    try {
      const response = await fetch(`${API_BASE_URL}/program_chair/assign_students_to_section.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ section_id: selectedSection.id, student_ids: studentIds }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Students assigned successfully.");
      } else if (response.status === 207) {
        // Partial success
        toast.warning(data.message || "Some students could not be assigned.");
        if (data.failed_students) {
          console.warn("Failed student assignments:", data.failed_students);
        }
      } else {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      // After assignment, re-fetch all sections and unassigned students to update UI
      // (Alternatively, optimize by only updating affected section and unassigned students list)
      fetchSections();
      fetchUnassignedStudents();

    } catch (error) {
      console.error("Error assigning students:", error);
      toast.error(error.message || "Failed to assign students. Please try again.");
    } finally {
      setShowAssignStudentsDialogForSectionId(null);
      setSelectedStudentsForAssignment([]);
      setSearchQuery(""); // Clear search query after assigning
      setAssignStudentsActiveTab("available"); // Reset tab to available
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case "archived":
        return <Badge variant="secondary">Archived</Badge>
      case "completed":
        return <Badge variant="outline">Completed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getEnrolledStudentCount = (students, requiredStatus = 'enrolled') => {
    return students.filter(student => student.enrollmentStatus === requiredStatus).length;
  };

  const activeSections = sections.filter((s) => s.status === "active" && s.name.toLowerCase().includes(sectionSearchQuery.toLowerCase()))
  const archivedSections = sections.filter((s) => s.status === "archived" && s.name.toLowerCase().includes(sectionSearchQuery.toLowerCase()))
  const completedSections = sections.filter((s) => s.status === "completed" && s.name.toLowerCase().includes(sectionSearchQuery.toLowerCase()))

  return (
    <SidebarProvider>
    <AppSidebar />
    <main className="w-full">
      <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-[#1b4b2a]">Manage Sections</h1>
              <p className="text-muted-foreground">Create, manage, and assign students to course sections</p>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search sections..."
                value={sectionSearchQuery}
                onChange={(e) => setSectionSearchQuery(e.target.value)}
                className="w-[200px]"
              />
              {/* Global Alert Dialog for Section Deletion */}
              <AlertDialog open={isDeleteSectionConfirmDialogOpen} onOpenChange={setIsDeleteSectionConfirmDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the section "{sectionToDeleteDetails?.name}" and all its enrolled students.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setSectionToDeleteDetails(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                      if (sectionToDeleteDetails) {
                        confirmDeleteSection(sectionToDeleteDetails.id, sectionToDeleteDetails.name);
                        setSectionToDeleteDetails(null); // Clear details after action is initiated
                      }
                    }}>
                      Continue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Global Alert Dialog for Student Removal */}
              <AlertDialog open={isRemoveStudentConfirmDialogOpen} onOpenChange={setIsRemoveStudentConfirmDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Student Removal</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to unassign {studentToRemoveDetails?.studentName} from {studentToRemoveDetails?.sectionName}?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setStudentToRemoveDetails(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => confirmRemoveStudent(studentToRemoveDetails.studentDbId, studentToRemoveDetails.sectionId, studentToRemoveDetails.studentName, studentToRemoveDetails.sectionName)}>
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>


              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={(isOpen) => {
                  setIsCreateDialogOpen(isOpen);
                  if (!isOpen) {
                    // Reset newSection state when the dialog is closed
                    setNewSection({
                      name: "",
                      capacity: 40,
                      yearLevel: null,
                      program: null,
                    });
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="green">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Section
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create New Section</DialogTitle>
                    <DialogDescription>Add a new section for the current academic period.</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="flex flex-col space-y-2 col-span-2">
                      <Label htmlFor="program">Program</Label>
                      <Select
                        onValueChange={(value) =>
                          setNewSection({
                            ...newSection,
                            program: value,
                          })
                        }
                        value={newSection.program || ""}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a program" />
                        </SelectTrigger>
                        <SelectContent>
                          {programs.map((program) => (
                            <SelectItem key={program.id} value={program.id}>
                              {program.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col space-y-2 col-span-2">
                      <Label htmlFor="yearLevel">Year Level</Label>
                      <Select
                        onValueChange={(value) =>
                          setNewSection({
                            ...newSection,
                            yearLevel: value, // Store the ID or the entire object based on your needs
                          })
                        }
                        value={newSection.yearLevel || ""}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a year level" />
                        </SelectTrigger>
                        <SelectContent>
                          {yearLevels.map((yl) => (
                            <SelectItem key={yl.id} value={yl.id}>
                              {yl.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., BSIS 101"
                        value={newSection.name}
                        onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="capacity">Capacity</Label>
                      <Input
                        id="capacity"
                        type="number"
                        value={newSection.capacity}
                        onChange={(e) =>
                          setNewSection({ ...newSection, capacity: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="green" onClick={handleCreateSection}>Create Section</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Edit Section Dialog */}
              <Dialog open={isEditSectionDialogOpen} onOpenChange={setIsEditSectionDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Edit Section</DialogTitle>
                    <DialogDescription>
                      Modify the details of the selected section.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="flex flex-col space-y-2 col-span-2">
                      <Label htmlFor="edit-program">Program</Label>
                      <Select
                        onValueChange={(value) =>
                          setEditedSection((prev) => ({ ...prev, program: value }))
                        }
                        value={editedSection?.program || ""}
                      >
                        <SelectTrigger id="edit-program">
                          <SelectValue placeholder="Select a program" />
                        </SelectTrigger>
                        <SelectContent>
                          {programs.map((program) => (
                            <SelectItem key={program.id} value={program.id}>
                              {program.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col space-y-2 col-span-2">
                      <Label htmlFor="edit-yearLevel">Year Level</Label>
                      <Select
                        onValueChange={(value) =>
                          setEditedSection((prev) => ({ ...prev, yearLevel: value }))
                        }
                        value={editedSection?.yearLevel || ""}
                      >
                        <SelectTrigger id="edit-yearLevel">
                          <SelectValue placeholder="Select a year level" />
                        </SelectTrigger>
                        <SelectContent>
                          {yearLevels.map((yl) => (
                            <SelectItem key={yl.id} value={yl.id}>
                              {yl.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="edit-name">Name</Label>
                      <Input
                        id="edit-name"
                        placeholder="e.g., BSIS 101"
                        value={editedSection?.name || ""}
                        onChange={(e) =>
                          setEditedSection((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="edit-capacity">Capacity</Label>
                      <Input
                        id="edit-capacity"
                        type="number"
                        value={editedSection?.capacity || 0}
                        onChange={(e) =>
                          setEditedSection((prev) => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="green" onClick={confirmUpdateSection}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">Active Sections ({activeSections.length})</TabsTrigger>
              <TabsTrigger value="archived">Archived ({archivedSections.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedSections.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              <div className="grid gap-4">
                {isLoadingSections ? (
                  <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    <span>Loading sections...</span>
                  </div>
                ) : sectionsError ? (
                  <div className="flex justify-center items-center p-8 bg-destructive/10 text-destructive rounded-md">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    <p>Error loading sections: {sectionsError}</p>
                  </div>
                ) : (
                  activeSections.map((section) => (
                  <div key={section.id} className="space-y-4">
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              {section.name}
                              {getStatusBadge(section.status)}
                            </CardTitle>
                            <CardDescription>
                              {section.semester} {section.academic_year}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (viewingStudentsFor === section.id) {
                                  setViewingStudentsFor(null);
                                  setSelectedSection(null);
                                } else {
                                  setViewingStudentsFor(section.id);
                                  setSelectedSection(section);
                                }
                              }}
                            >
                              <Users className="w-4 h-4 mr-2" />
                              {viewingStudentsFor === section.id ? "Hide Students" : "Students List"}
                            </Button>
                           
                            <Button variant="outline" size="sm" onClick={() => handleEditSection(section)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Button>

                            <Button variant="outline" size="sm" onClick={() => handleArchiveSection(section.id)}>
                                <Archive className="w-4 h-4 mr-2" />
                              Archive
                            </Button>
                            
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteSection(section.id, section.name)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="font-medium">Year Level</p>
                            <p className="text-muted-foreground">
                              {section.year_level}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">Number of Students</p>
                            <p className="text-muted-foreground">
                              {getEnrolledStudentCount(section.enrolledStudents, 'enrolled')}/{section.capacity}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">Status</p>
                            <p className="text-muted-foreground capitalize">{section.status}</p>
                          </div>
                          <div>
                            <p className="font-medium">Advisor</p>
                            <p className="text-muted-foreground">{section.advisor_name || "N/A"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    {viewingStudentsFor === section.id && (
                      <Card>
                        <CardHeader>
                          <div className="flex justify-between items-center">
                            <div>
                              <CardTitle className="text-lg">Students in {section.name}</CardTitle>
                              <CardDescription>
                                Current enrollment: {getEnrolledStudentCount(section.enrolledStudents, 'enrolled')}/{section.capacity}
                              </CardDescription>
                            </div>
                              <Button
                                variant="green"
                                onClick={() => {
                                  setShowAssignStudentsDialogForSectionId(section.id);
                                  setSelectedSection(section);
                                }}
                              >
                                Assign Students
                              </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Student ID</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Previous Section</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                   
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {section.enrolledStudents.filter(student => student.enrollmentStatus === 'enrolled').length > 0 ? (
                                  section.enrolledStudents.filter(student => student.enrollmentStatus === 'enrolled').map((student) => (
                                    <TableRow key={student.id}>
                                      <TableCell className="font-medium">{student.studentId}</TableCell>
                                    <TableCell>{student.name}</TableCell>
                                    <TableCell>{student.email}</TableCell>
                                    <TableCell>{student.previousSection || "N/A"}</TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleRemoveStudent(student.id, section.id, student.name, section.name)}
                                      >
                                          <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TableCell>
                                    
                                  </TableRow>
                                ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                      No students enrolled yet
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                      <Dialog open={showAssignStudentsDialogForSectionId === section.id} onOpenChange={(open) => {
                          setShowAssignStudentsDialogForSectionId(open ? section.id : null);
                          setSelectedSection(open ? section : null);
                          if (!open) {
                              // Clear search query and selected students when modal closes
                              setSearchQuery("");
                              setSelectedStudentsForAssignment([]);
                          }
                        }}>
                      <DialogContent className="sm:max-w-[700px]">
                        <DialogHeader>
                            <div className="flex flex-col space-y-1.5">
                          <DialogTitle>Assign Students to Section</DialogTitle>
                          <DialogDescription>
                            Select unassigned students to assign to this section
                          </DialogDescription>
                            </div>
                        </DialogHeader>
                          <Tabs value={assignStudentsActiveTab} onValueChange={setAssignStudentsActiveTab}>
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                              <TabsTrigger value="available">Available Students</TabsTrigger>
                              <TabsTrigger value="selected">Selected ({selectedStudentsForAssignment.length})</TabsTrigger>
                            </TabsList>

                            {/* Available Students Tab Content */}
                            <TabsContent value="available">
                        <div className="space-y-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
                              placeholder="Search by name, student ID, email, or previous section..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                                {isLoadingStudents ? (
                                  <div className="flex items-center justify-center p-8 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    <span>Loading students...</span>
                                  </div>
                                ) : studentsError ? (
                                  <div className="flex justify-center items-center p-8 bg-destructive/10 text-destructive rounded-md">
                                    <AlertTriangle className="h-5 w-5 mr-2" />
                                    <p>Error loading students: {studentsError}</p>
                                  </div>
                                ) : (
                          <div className="max-h-96 overflow-y-auto border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Student ID</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Previous Section</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                        {currentStudents.map((student) => (
                                  <TableRow key={student.id}>
                                    <TableCell className="font-medium">{student.studentId}</TableCell>
                                    <TableCell>{student.name}</TableCell>
                                    <TableCell>{student.email}</TableCell>
                                    <TableCell>{student.previousSection || "N/A"}</TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        size="sm"
                                                variant={selectedStudentsForAssignment.includes(student.id) ? "secondary" : "outline"}
                                        onClick={() => {
                                                  setSelectedStudentsForAssignment((prev) =>
                                                    prev.includes(student.id)
                                                      ? prev.filter((id) => id !== student.id)
                                                      : [...prev, student.id]
                                                  );
                                                }}
                                              >
                                                {selectedStudentsForAssignment.includes(student.id) ? "Deselect" : "Select"}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                        {currentStudents.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                      {searchQuery
                                        ? "No students found matching your search"
                                        : "No unassigned students available"}
                                    </TableCell>
                                  </TableRow>
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                                <PaginationComponent
                                  currentPage={currentPage}
                                  totalPages={totalPages}
                                  onPageChange={handlePageChange}
                                />
                              </div>
                            </TabsContent>

                            {/* Selected Students Tab Content (Empty for now, will fill in next step) */}
                            <TabsContent value="selected">
                              <div className="space-y-4">
                                <div className="max-h-96 overflow-y-auto border rounded-md">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Student ID</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Previous Section</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {selectedStudentsForAssignment.length > 0 ? (
                                        selectedStudentsForAssignment.map((studentId) => {
                                          const student = availableStudents.find((s) => s.id === studentId);
                                          if (!student) return null;
                                          return (
                                            <TableRow key={student.id}>
                                              <TableCell className="font-medium">{student.studentId}</TableCell>
                                              <TableCell>{student.name}</TableCell>
                                              <TableCell>{student.email}</TableCell>
                                              <TableCell>{student.previousSection || "N/A"}</TableCell>
                                              <TableCell className="text-right">
                                                <Button
                                                  size="sm"
                                                  variant="destructive"
                                                  onClick={() => {
                                                    setSelectedStudentsForAssignment((prev) =>
                                                      prev.filter((id) => id !== student.id)
                                                    );
                                                  }}
                                                >
                                                  Remove
                                                </Button>
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })
                                      ) : (
                                        <TableRow>
                                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No students selected yet.
                                          </TableCell>
                                        </TableRow>
                                      )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                            </TabsContent>
                          </Tabs>

                          <DialogFooter className="mt-6 pt-4 border-t">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowAssignStudentsDialogForSectionId(null);
                                setSearchQuery("");
                                setSelectedStudentsForAssignment([]);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="green"
                              onClick={() => handleAssignSelectedStudents(selectedStudentsForAssignment)}
                              disabled={selectedStudentsForAssignment.length === 0}
                            >
                              Assign Selected Students
                            </Button>
                          </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  ))
                )}
                {activeSections.length === 0 && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <p className="text-muted-foreground">
                        No active sections found. Create your first section to get started.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="archived" className="space-y-4">
              <div className="grid gap-4">
                {isLoadingSections ? (
                  <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    <span>Loading sections...</span>
                  </div>
                ) : sectionsError ? (
                  <div className="flex justify-center items-center p-8 bg-destructive/10 text-destructive rounded-md">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    <p>Error loading sections: {sectionsError}</p>
                  </div>
                ) : (
                  archivedSections.map((section) => (
                  <div key={section.id} className="space-y-4">
                    <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {section.name}
                            {getStatusBadge(section.status)}
                          </CardTitle>
                          <CardDescription>
                                {section.academic_year}  {section.semester}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (viewingStudentsFor === section.id) {
                                  setViewingStudentsFor(null);
                                  setSelectedSection(null);
                                } else {
                                  setViewingStudentsFor(section.id);
                                  setSelectedSection(section);
                                }
                              }}
                            >
                              <Users className="w-4 h-4 mr-2" />
                              {viewingStudentsFor === section.id ? "Hide Students" : "Students List"}
                            </Button>
                          <Button variant="outline" size="sm" onClick={() => handleRestoreSection(section.id)}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Restore
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteSection(section.id, section.name)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Year Level</p>
                          <p className="text-muted-foreground">
                            {section.year_level}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Number of Students</p>
                          <p className="text-muted-foreground">
                            {getEnrolledStudentCount(section.enrolledStudents, 'archived')}/{section.capacity}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Status</p>
                          <p className="text-muted-foreground capitalize">{section.status}</p>
                        </div>
                        <div>
                          <p className="font-medium">Advisor</p>
                          <p className="text-muted-foreground">{section.advisor_name || "N/A"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {viewingStudentsFor === section.id && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Students in {section.name}</CardTitle>
                        <CardDescription>
                          Current enrollment: {getEnrolledStudentCount(section.enrolledStudents, 'archived')}/{section.capacity}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Student ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Previous Section</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {section.enrolledStudents.filter(student => student.enrollmentStatus === 'archived').length > 0 ? (
                                section.enrolledStudents.filter(student => student.enrollmentStatus === 'archived').map((student) => (
                                <TableRow key={student.id}>
                                  <TableCell className="font-medium">{student.studentId}</TableCell>
                                  <TableCell>{student.name}</TableCell>
                                  <TableCell>{student.email}</TableCell>
                                  <TableCell>{student.previousSection || "N/A"}</TableCell>
                                </TableRow>
                              ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    No students enrolled yet
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  </div>
                  ))
                )}
                {archivedSections.length === 0 && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <p className="text-muted-foreground">No archived sections found.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              <div className="grid gap-4">
                {isLoadingSections ? (
                  <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    <span>Loading sections...</span>
                  </div>
                ) : sectionsError ? (
                  <div className="flex justify-center items-center p-8 bg-destructive/10 text-destructive rounded-md">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    <p>Error loading sections: {sectionsError}</p>
                  </div>
                ) : (
                  completedSections.map((section) => (
                  <div key={section.id} className="space-y-4">
                    <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {section.name}
                            {getStatusBadge(section.status)}
                          </CardTitle>
                          <CardDescription>
                              {section.academic_year} {section.semester}
                          </CardDescription>
                        </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (viewingStudentsFor === section.id) {
                                  setViewingStudentsFor(null);
                                  setSelectedSection(null);
                                } else {
                                  setViewingStudentsFor(section.id);
                                  setSelectedSection(section);
                                }
                              }}
                            >
                              <Users className="w-4 h-4 mr-2" />
                              {viewingStudentsFor === section.id ? "Hide Students" : "Students List"}
                            </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteSection(section.id, section.name)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Year Level</p>
                          <p className="text-muted-foreground">
                            {section.year_level}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Number of Students</p>
                          <p className="text-muted-foreground">
                            {getEnrolledStudentCount(section.enrolledStudents, 'completed')}/{section.capacity}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Status</p>
                          <p className="text-muted-foreground capitalize">{section.status}</p>
                        </div>
                        <div>
                          <p className="font-medium">Advisor</p>
                          <p className="text-muted-foreground">{section.advisor_name || "N/A"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                    {viewingStudentsFor === section.id && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Students in {section.name}</CardTitle>
                          <CardDescription>
                            Current enrollment: {getEnrolledStudentCount(section.enrolledStudents, 'completed')}/{section.capacity}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Student ID</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Previous Section</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {section.enrolledStudents.filter(student => student.enrollmentStatus === 'completed').length > 0 ? (
                                  section.enrolledStudents.filter(student => student.enrollmentStatus === 'completed').map((student) => (
                                    <TableRow key={student.id}>
                                      <TableCell className="font-medium">{student.studentId}</TableCell>
                                      <TableCell>{student.name}</TableCell>
                                      <TableCell>{student.email}</TableCell>
                                      <TableCell>{student.previousSection || "N/A"}</TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                      No students enrolled yet
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  ))
                )}
                {completedSections.length === 0 && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <p className="text-muted-foreground">No completed sections found.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
    </main>
      <Toaster />
  </SidebarProvider>
  )
}