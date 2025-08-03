import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableHead, TableRow, TableHeader, TableCell, TableBody } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogPortal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PlusSquare, Trash2, Edit } from "lucide-react";
import { DatePicker } from "@/components/shared/DatePicker";
import { Label } from "@/components/ui/label";
import { PaginationComponent } from "@/components/shared/PaginationComponent";
import { useActive } from '@/contexts/ActiveContext';
import { API_BASE_URL } from '@/config/api';
const ManageCurriculum = () => {
  const [selectedTab, setSelectedTab] = useState("academic_year");
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showMaxActiveDialog, setShowMaxActiveDialog] = useState(false);
  const [yearToUpdate, setYearToUpdate] = useState(null);
  const [semesterToUpdate, setSemesterToUpdate] = useState(null);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [yearToDelete, setYearToDelete] = useState(null);

  // Pagination states
  const [currentPages, setCurrentPages] = useState({
    academic_year: 1,
    semester: 1,
    program: 1,
    year_level: 1
  });
  const pageSize = 5;

  // Calculate total pages for each table
  const getTotalPages = (items) => {
    if (!items || !Array.isArray(items)) {
      return 1;
    }
    return Math.ceil(items.length / pageSize);
  };

  // Get paginated items for each table
  const getPaginatedItems = (items, tab) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return [];
    }
    const startIndex = (currentPages[tab] - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPages(prev => ({
      ...prev,
      [selectedTab]: page
    }));
  };

  // Get current total pages based on selected tab
  const getCurrentTotalPages = () => {
    switch (selectedTab) {
      case 'academic_year':
        return getTotalPages(academicYears);
      case 'semester':
        return getTotalPages(semesters);
      case 'program':
        return getTotalPages(programs);
      case 'year_level':
        return getTotalPages(yearLevels);
      default:
        return 1;
    }
  };

  // Get current paginated items based on selected tab
  const getCurrentPaginatedItems = () => {
    switch (selectedTab) {
      case 'academic_year':
        return getPaginatedItems(academicYears, selectedTab);
      case 'semester':
        return getPaginatedItems(semesters, selectedTab);
      case 'program':
        return getPaginatedItems(programs, selectedTab);
      case 'year_level':
        return getPaginatedItems(yearLevels, selectedTab);
      default:
        return [];
    }
  };

  // New entry states
  const [newAcademicYear, setNewAcademicYear] = useState({ 
    year: "", 
    startDate: "", 
    endDate: "" 
  });
  const [newProgram, setNewProgram] = useState({ name: "", department_id: null });
  const [newSemester, setNewSemester] = useState({ name: "" });
  const [newYearLevel, setNewYearLevel] = useState({ name: "" });

  const tabTitles = {
    academic_year: "Manage Academic Years",
    semester: "Manage Semesters",
    program: "Manage Programs",
    year_level: "Manage Year Levels",
  };

  // General Data
  const [academicYears, setAcademicYears] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [yearLevels, setYearLevels] = useState([]);

  const { activeAcademicYear, activeSemester, refreshActiveData } = useActive();

  // Add logging for initial active data
  useEffect(() => {
    console.log('Initial Active Data:', {
      academicYear: activeAcademicYear,
      semester: activeSemester
    });
  }, []);

  // Add logging when active data changes
  useEffect(() => {
    console.log('Active Data Changed:', {
      academicYear: activeAcademicYear,
      semester: activeSemester
    });
  }, [activeAcademicYear, activeSemester]);

  // Add dialog state management
  const handleDialogChange = (dialogType, isOpen) => {
    // Set the specific dialog state
    switch (dialogType) {
      case 'add':
        setShowAddDialog(isOpen);
        if (!isOpen) {
          // Reset form when closing add dialog
          switch (selectedTab) {
            case 'academic_year':
              resetAcademicYearForm();
              break;
            case 'program':
              resetProgramForm();
              break;
            case 'semester':
              resetSemesterForm();
              break;
            case 'year_level':
              resetYearLevelForm();
              break;
          }
        }
        break;
      case 'status':
        setShowStatusDialog(isOpen);
        if (!isOpen) {
          setYearToUpdate(null);
          setSemesterToUpdate(null);
        }
        break;
      case 'maxActive':
        setShowMaxActiveDialog(isOpen);
        break;
      case 'validation':
        setShowValidationDialog(isOpen);
        break;
    }
  };

  // Update reset functions to not handle dialog state
  const resetAcademicYearForm = () => {
    setNewAcademicYear({ year: "", startDate: "", endDate: "" });
  };

  const resetProgramForm = () => {
    setNewProgram({ name: "", department_id: null });
  };

  const resetSemesterForm = () => {
    setNewSemester({ name: "" });
  };

  const resetYearLevelForm = () => {
    setNewYearLevel({ name: "" });
  };

  // Add handler for academic year input formatting
  const handleAcademicYearInput = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    
    if (value.length > 8) value = value.slice(0, 8);
    
    // Format as YYYY-YYYY
    if (value.length > 4) {
      const startYear = value.slice(0, 4);
      const endYear = value.slice(4);
      value = `${startYear}-${endYear}`;
    }
    
    setNewAcademicYear({ ...newAcademicYear, year: value });
  };

  // Add validation for academic year
  const isValidAcademicYear = (year) => {
    if (!year) return false;
    const [startYear, endYear] = year.split('-');
    if (!startYear || !endYear) return false;
    
    const start = parseInt(startYear);
    const end = parseInt(endYear);
    
    // Check if years are valid numbers and end year is start year + 1
    return !isNaN(start) && !isNaN(end) && end === start + 1;
  };

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

  // Update showError to not close other dialogs and ignore success messages
  const showError = (message) => {
    // Skip showing error dialog for specific messages
    if (!message) return;
    
    // Convert message to lowercase for case-insensitive checks
    const lowerMessage = message.toLowerCase();
    
    // Don't show error dialog for success messages or "not found" messages after deletion
    if (lowerMessage.includes("success") || 
        lowerMessage.includes("deleted") || 
        (lowerMessage.includes("not found") && 
         (lowerMessage.includes("semester") || 
          lowerMessage.includes("program") || 
          lowerMessage.includes("year level") || 
          lowerMessage.includes("academic year")))) {
      return;
    }
    
    // For all other error messages, show the error dialog
    setValidationMessage(message);
    setShowValidationDialog(true);
  };

  // Update handleToggleAcademicYearStatus to show confirmation dialog
  const handleToggleAcademicYearStatus = (yearId) => {
    setYearToUpdate(yearId);
    setShowStatusDialog(true);
  };

  // Update handleConfirmStatusChange to log before and after refresh
  const handleConfirmStatusChange = async () => {
    try {
      const yearToUpdateRecord = academicYears.find(year => year.id === yearToUpdate);
      const newStatus = yearToUpdateRecord.status === "Active" ? "Inactive" : "Active";

      console.log('Before status change - Active Data:', {
        academicYear: activeAcademicYear,
        semester: activeSemester
      });

      const response = await fetch(`${API_BASE_URL}/academic_year/update.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: yearToUpdateRecord.id,
          status: newStatus
        })
      });

      const data = await response.json();

      if (response.ok && data.academic_year) {
        setAcademicYears(prevYears => 
          prevYears.map(year => 
            year.id === yearToUpdateRecord.id ? data.academic_year : year
          )
        );
        setShowStatusDialog(false);
        setYearToUpdate(null);
        
        // Refresh active data and log
        await refreshActiveData();
        console.log('After status change - Active Data:', {
          academicYear: activeAcademicYear,
          semester: activeSemester
        });
      } else {
        showError(data.message || "Failed to update academic year status");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Update handleAddAcademicYear to remove sorting
  const handleAddAcademicYear = async () => {
    if (!newAcademicYear.year || !newAcademicYear.startDate || !newAcademicYear.endDate) {
      showError("Please fill in all fields");
      return;
    }

    if (!isValidAcademicYear(newAcademicYear.year)) {
      showError("Please enter a valid academic year (e.g., 2024-2025)");
      return;
    }

    // Format dates to YYYY-MM-DD
    const formatDate = (dateString) => {
      if (!dateString) return "";
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formattedStartDate = formatDate(newAcademicYear.startDate);
    const formattedEndDate = formatDate(newAcademicYear.endDate);

    // Validate dates
    if (!formattedStartDate || !formattedEndDate) {
      showError("Please select valid dates");
      return;
    }

    // Check if end date is after start date
    if (new Date(formattedEndDate) <= new Date(formattedStartDate)) {
      showError("End date must be after start date");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/academic_year/create.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          academic_year_name: newAcademicYear.year,
          start_date: formattedStartDate,
          end_date: formattedEndDate
        })
      });

      const data = await response.json();

      if (response.ok && data.academic_year) {
        // Add the new academic year to the state using the returned data
        setAcademicYears(prevYears => [...prevYears, data.academic_year]);
        resetAcademicYearForm();
        handleDialogChange('add', false);
      } else {
        showError(data.message || "Failed to create academic year");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  const handleAddProgram = async () => {
    if (!newProgram.name) {
      showError("Please enter a program name");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/program/create.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProgram.name,
          department_id: newProgram.department_id || null
        })
      });

      const data = await response.json();

      if (response.ok && data.program) {
        // Add the new program to the state using the returned data
        setPrograms(prevPrograms => [...prevPrograms, data.program]);
        resetProgramForm();
        handleDialogChange('add', false);
      } else {
        showError(data.message || "Failed to create program");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  const handleAddSemester = async () => {
    if (!newSemester.name) {
      showError("Please enter a semester name");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/semester/create.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          semester_name: newSemester.name
        })
      });

      const data = await response.json();

      if (response.ok && data.semester) {
        // Add the new semester to the state using the returned data
        setSemesters(prevSemesters => [...prevSemesters, data.semester]);
        resetSemesterForm();
        handleDialogChange('add', false);
      } else {
        showError(data.message || "Failed to create semester");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  const handleAddYearLevel = async () => {
    if (!newYearLevel.name) {
      showError("Please enter a year level");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/year_level/create.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newYearLevel.name
        })
      });

      const data = await response.json();

      if (response.ok && data.year_level) {
        setYearLevels(prevLevels => [...prevLevels, data.year_level]);
        resetYearLevelForm();
        handleDialogChange('add', false);
      } else {
        showError(data.message || "Failed to create year level");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Update useEffect to fetch programs too
  useEffect(() => {
    const fetchAcademicYears = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/academic_year/read.php`);
        const data = await response.json();
        
        if (response.ok) {
          setAcademicYears(data);
        } else {
          console.error("Failed to fetch academic years:", data.message);
        }
      } catch (error) {
        console.error("Error fetching academic years:", error);
      }
    };

    const fetchSemesters = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/semester/read.php`);
        const data = await response.json();
        
        if (response.ok) {
          setSemesters(data);
        } else {
          console.error("Failed to fetch semesters:", data.message);
        }
      } catch (error) {
        console.error("Error fetching semesters:", error);
      }
    };

    const fetchPrograms = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/program/read.php`);
        const data = await response.json();
        
        if (response.ok) {
          setPrograms(data);
        } else {
          console.error("Failed to fetch programs:", data.message);
        }
      } catch (error) {
        console.error("Error fetching programs:", error);
      }
    };

    const fetchDepartments = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/users/departments.php`);
        const data = await response.json();
        
        if (response.ok) {
          // Check the structure of the response
          if (Array.isArray(data)) {
            setDepartments(data);
          } else if (!data.error) {
            setDepartments(data);
          } else {
            console.error("Failed to fetch departments:", data.error);
          }
        } else {
          console.error("Failed to fetch departments:", data.message || "Unknown error");
        }
      } catch (error) {
        console.error("Error fetching departments:", error);
      }
    };

    const fetchYearLevels = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/year_level/read.php`);
        const data = await response.json();
        
        if (response.ok) {
          // Check the structure of the response and set appropriately
          if (data.records && Array.isArray(data.records)) {
            setYearLevels(data.records);
          } else if (Array.isArray(data)) {
            setYearLevels(data);
          } else {
            console.error("Unexpected year levels data structure:", data);
          }
        } else {
          console.error("Failed to fetch year levels:", data.message);
        }
      } catch (error) {
        console.error("Error fetching year levels:", error);
      }
    };

    fetchAcademicYears();
    fetchSemesters();
    fetchPrograms();
    fetchDepartments();
    fetchYearLevels();
  }, []);

  // Add delete handler function
  const handleDeleteAcademicYear = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/academic_year/delete.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: yearToDelete
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Determine if this was a successful operation based on message content
        const isSuccess = (data.message && (
          data.message.toLowerCase().includes("success") || 
          data.message.toLowerCase().includes("deleted")
        )) || data.success === true;

        if (isSuccess) {
          // Remove the deleted academic year from the state
          setAcademicYears(prevYears => 
            prevYears.filter(year => year.id !== yearToDelete)
          );
          setShowDeleteDialog(false);
          setYearToDelete(null);
        } else {
          // Only show an error if it was not a success
          showError(data.message || "Failed to delete academic year");
        }
      } else {
        showError(data.message || "Failed to delete academic year");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Add delete button handler
  const handleDeleteClick = (yearId) => {
    setYearToDelete(yearId);
    setShowDeleteDialog(true);
  };

  // Add new state for edit dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [yearToEdit, setYearToEdit] = useState(null);
  const [editForm, setEditForm] = useState({
    year: "",
    startDate: "",
    endDate: ""
  });

  // Add edit handlers
  const handleEditClick = (year) => {
    setYearToEdit(year);
    // Format dates for the DatePicker
    const formatDateForPicker = (dateString) => {
      if (!dateString) return "";
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";
        return date.toISOString();
      } catch (error) {
        console.error("Error formatting date:", error);
        return "";
      }
    };

    setEditForm({
      year: year.year,
      startDate: formatDateForPicker(year.startDate),
      endDate: formatDateForPicker(year.endDate)
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!editForm.year || !editForm.startDate || !editForm.endDate) {
      showError("Please fill in all fields");
      return;
    }

    if (!isValidAcademicYear(editForm.year)) {
      showError("Please enter a valid academic year (e.g., 2024-2025)");
      return;
    }

    // Format dates to YYYY-MM-DD
    const formatDate = (dateString) => {
      if (!dateString) return "";
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formattedStartDate = formatDate(editForm.startDate);
    const formattedEndDate = formatDate(editForm.endDate);

    // Validate dates
    if (!formattedStartDate || !formattedEndDate) {
      showError("Please select valid dates");
      return;
    }

    // Check if end date is after start date
    if (new Date(formattedEndDate) <= new Date(formattedStartDate)) {
      showError("End date must be after start date");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/academic_year/update.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: yearToEdit.id,
          academic_year_name: editForm.year,
          start_date: formattedStartDate,
          end_date: formattedEndDate
        })
      });

      const data = await response.json();

      if (response.ok && data.academic_year) {
        // Update the academic years state with the updated record
        setAcademicYears(prevYears => 
          prevYears.map(year => 
            year.id === yearToEdit.id ? data.academic_year : year
          )
        );
        setShowEditDialog(false);
        setYearToEdit(null);
        setEditForm({ year: "", startDate: "", endDate: "" });
      } else {
        showError(data.message || "Failed to update academic year");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Add new state for edit semester dialog
  const [showEditSemesterDialog, setShowEditSemesterDialog] = useState(false);
  const [semesterToEdit, setSemesterToEdit] = useState(null);
  const [editSemesterForm, setEditSemesterForm] = useState({
    name: ""
  });

  // Add edit semester handlers
  const handleEditSemesterClick = (semester) => {
    setSemesterToEdit(semester);
    setEditSemesterForm({
      name: semester.name
    });
    setShowEditSemesterDialog(true);
  };

  const handleEditSemesterSubmit = async () => {
    if (!editSemesterForm.name) {
      showError("Please enter a semester name");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/semester/update.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: semesterToEdit.id,
          semester_name: editSemesterForm.name
        })
      });

      const data = await response.json();

      if (response.ok && data.semester) {
        // Update the semesters state with the updated record
        setSemesters(prevSemesters => 
          prevSemesters.map(semester => 
            semester.id === semesterToEdit.id ? data.semester : semester
          )
        );
        setShowEditSemesterDialog(false);
        setSemesterToEdit(null);
        setEditSemesterForm({ name: "" });
      } else {
        showError(data.message || "Failed to update semester");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Add semester delete state
  const [showDeleteSemesterDialog, setShowDeleteSemesterDialog] = useState(false);
  const [semesterToDelete, setSemesterToDelete] = useState(null);

  // Add semester delete handlers
  const handleDeleteSemesterClick = (semesterId) => {
    setSemesterToDelete(semesterId);
    setShowDeleteSemesterDialog(true);
  };

  const handleDeleteSemester = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/semester/delete.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: semesterToDelete
        })
      });

      const data = await response.json();

      // If the request was successful (even if the item wasn't found)
      if (response.ok) {
        // Determine if this was a successful operation based on message content
        const isSuccess = (data.message && (
          data.message.toLowerCase().includes("success") || 
          data.message.toLowerCase().includes("deleted")
        )) || data.success === true;

        if (isSuccess) {
          // Remove the deleted semester from the state
          setSemesters(prevSemesters => 
            prevSemesters.filter(semester => semester.id !== semesterToDelete)
          );
          setShowDeleteSemesterDialog(false);
          setSemesterToDelete(null);
        } else {
          // Only show an error if it was not a success
          showError(data.message || "Failed to delete semester");
        }
      } else {
        showError(data.message || "Failed to delete semester");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Add new state for edit program dialog
  const [showEditProgramDialog, setShowEditProgramDialog] = useState(false);
  const [programToEdit, setProgramToEdit] = useState(null);
  const [editProgramForm, setEditProgramForm] = useState({
    name: "",
    department_id: null
  });

  // Add edit program handlers
  const handleEditProgramClick = (program) => {
    setProgramToEdit(program);
    setEditProgramForm({
      name: program.name,
      department_id: program.department_id
    });
    setShowEditProgramDialog(true);
  };

  const handleEditProgramSubmit = async () => {
    if (!editProgramForm.name) {
      showError("Please enter a program name");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/program/update.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: programToEdit.id,
          name: editProgramForm.name,
          department_id: editProgramForm.department_id
        })
      });

      const data = await response.json();

      if (response.ok && data.program) {
        // Update the programs state with the updated record
        setPrograms(prevPrograms => 
          prevPrograms.map(program => 
            program.id === programToEdit.id ? data.program : program
          )
        );
        setShowEditProgramDialog(false);
        setProgramToEdit(null);
        setEditProgramForm({ name: "", department_id: null });
      } else {
        showError(data.message || "Failed to update program");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Add program delete state
  const [showDeleteProgramDialog, setShowDeleteProgramDialog] = useState(false);
  const [programToDelete, setProgramToDelete] = useState(null);

  // Add program delete handlers
  const handleDeleteProgramClick = (programId) => {
    setProgramToDelete(programId);
    setShowDeleteProgramDialog(true);
  };

  const handleDeleteProgram = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/program/delete.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: programToDelete
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Determine if this was a successful operation based on message content
        const isSuccess = (data.message && (
          data.message.toLowerCase().includes("success") || 
          data.message.toLowerCase().includes("deleted")
        )) || data.success === true;

        if (isSuccess) {
          // Remove the deleted program from the state
          setPrograms(prevPrograms => 
            prevPrograms.filter(program => program.id !== programToDelete)
          );
          setShowDeleteProgramDialog(false);
          setProgramToDelete(null);
        } else {
          // Only show an error if it was not a success
          showError(data.message || "Failed to delete program");
        }
      } else {
        showError(data.message || "Failed to delete program");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Add edit year level handlers
  const [showEditYearLevelDialog, setShowEditYearLevelDialog] = useState(false);
  const [yearLevelToEdit, setYearLevelToEdit] = useState(null);
  const [editYearLevelForm, setEditYearLevelForm] = useState({
    name: ""
  });

  const handleEditYearLevelClick = (yearLevel) => {
    setYearLevelToEdit(yearLevel);
    setEditYearLevelForm({
      name: yearLevel.name
    });
    setShowEditYearLevelDialog(true);
  };

  const handleEditYearLevelSubmit = async () => {
    if (!editYearLevelForm.name) {
      showError("Please enter a year level name");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/year_level/update.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: yearLevelToEdit.id,
          name: editYearLevelForm.name
        })
      });

      const data = await response.json();

      if (response.ok && data.year_level) {
        setYearLevels(prevLevels => 
          prevLevels.map(level => 
            level.id === yearLevelToEdit.id ? data.year_level : level
          )
        );
        setShowEditYearLevelDialog(false);
        setYearLevelToEdit(null);
        setEditYearLevelForm({ name: "" });
      } else {
        showError(data.message || "Failed to update year level");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Add delete year level handlers
  const [showDeleteYearLevelDialog, setShowDeleteYearLevelDialog] = useState(false);
  const [yearLevelToDelete, setYearLevelToDelete] = useState(null);

  const handleDeleteYearLevelClick = (yearLevelId) => {
    setYearLevelToDelete(yearLevelId);
    setShowDeleteYearLevelDialog(true);
  };

  const handleDeleteYearLevel = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/year_level/delete.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: yearLevelToDelete
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Determine if this was a successful operation based on message content
        const isSuccess = (data.message && (
          data.message.toLowerCase().includes("success") || 
          data.message.toLowerCase().includes("deleted")
        )) || data.success === true;

        if (isSuccess) {
          setYearLevels(prevLevels => 
            prevLevels.filter(level => level.id !== yearLevelToDelete)
          );
          setShowDeleteYearLevelDialog(false);
          setYearLevelToDelete(null);
        } else {
          // Only show an error if it was not a success
          showError(data.message || "Failed to delete year level");
        }
      } else {
        showError(data.message || "Failed to delete year level");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  // Add semester status handlers
  const handleToggleSemesterStatus = (semesterId) => {
    setSemesterToUpdate(semesterId);
    setShowStatusDialog(true);
  };

  // Update handleConfirmSemesterStatusChange to log before and after refresh
  const handleConfirmSemesterStatusChange = async () => {
    try {
      const semesterToUpdateRecord = semesters.find(semester => semester.id === semesterToUpdate);
      const newStatus = semesterToUpdateRecord.status === "Active" ? "Inactive" : "Active";

      console.log('Before semester status change - Active Data:', {
        academicYear: activeAcademicYear,
        semester: activeSemester
      });

      const response = await fetch(`${API_BASE_URL}/semester/update.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: semesterToUpdateRecord.id,
          status: newStatus
        })
      });

      const data = await response.json();

      if (response.ok && data.semester) {
        // Update the semesters state with the updated record
        setSemesters(prevSemesters => 
          prevSemesters.map(semester => 
            semester.id === semesterToUpdateRecord.id ? data.semester : semester
          )
        );
        setShowStatusDialog(false);
        setSemesterToUpdate(null);
        
        // Refresh active data and log
        await refreshActiveData();
        console.log('After semester status change - Active Data:', {
          academicYear: activeAcademicYear,
          semester: activeSemester
        });
      } else {
        showError(data.message || "Failed to update semester status");
      }
    } catch (error) {
      showError("Error connecting to the server");
      console.error("Error:", error);
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        <ValidationDialog open={showValidationDialog} onOpenChange={(open) => handleDialogChange('validation', open)} />

        <div className="flex flex-col mt-4">
          <div className="flex overflow-hidden h-[calc(100vh-17rem)]">
            <main className="w-full p-4 md:p-6 overflow-auto">
              <div className="flex justify-between items-start">
                <h1 className="text-xl font-semibold text-[#1b4b2a]">{tabTitles[selectedTab]}</h1>
                <Dialog open={showAddDialog} onOpenChange={(open) => handleDialogChange('add', open)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="p-2">
                      <PlusSquare size={24} />
                    </Button>
                  </DialogTrigger>
                  <DialogPortal>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add {tabTitles[selectedTab].replace("Manage ", "")}</DialogTitle>
                      </DialogHeader>
                      
                      {selectedTab === "academic_year" && (
                        <>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="academicYear">Academic Year</Label>
                            <Input
                              id="academicYear"
                              placeholder="YYYY-YYYY (e.g., 2024-2025)"
                              value={newAcademicYear.year}
                              onChange={handleAcademicYearInput}
                              className={!isValidAcademicYear(newAcademicYear.year) && newAcademicYear.year ? "border-red-500" : ""}
                            />
                            {!isValidAcademicYear(newAcademicYear.year) && newAcademicYear.year && (
                              <p className="text-sm text-red-500">Please enter a valid academic year (e.g., 2024-2025)</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="startDate">Start Date</Label>
                            <DatePicker
                              id="startDate"
                              value={newAcademicYear.startDate}
                              onChange={(date) => setNewAcademicYear({ ...newAcademicYear, startDate: date })}
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="endDate">End Date</Label>
                            <DatePicker
                              id="endDate"
                              value={newAcademicYear.endDate}
                              onChange={(date) => setNewAcademicYear({ ...newAcademicYear, endDate: date })}
                              required
                            />
                          </div>
                          <DialogFooter>
                            <Button variant="green" onClick={handleAddAcademicYear}>Save</Button>
                          </DialogFooter>
                        </>
                      )}

                      {selectedTab === "program" && (
                        <>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="programName">Program Name</Label>
                            <Input
                              id="programName"
                              placeholder="Program Name"
                              value={newProgram.name}
                              onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="department">Department</Label>
                            <Select
                              value={newProgram.department_id?.toString() || "null"}
                              onValueChange={(value) => setNewProgram({ ...newProgram, department_id: value === "null" ? null : parseInt(value) })}
                            >
                              <SelectTrigger><SelectValue placeholder="Select Department (Optional)" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="null">None</SelectItem>
                                {departments.map((department) => (
                                  <SelectItem key={department.id} value={department.id.toString()}>
                                    {department.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <DialogFooter>
                            <Button variant="green" onClick={handleAddProgram}>Save</Button>
                          </DialogFooter>
                        </>
                      )}

                      {selectedTab === "semester" && (
                        <>
                          <Input
                            placeholder="Semester Name"
                            value={newSemester.name}
                            onChange={(e) => setNewSemester({ ...newSemester, name: e.target.value })}
                          />
                          <DialogFooter>
                            <Button variant="green" onClick={handleAddSemester}>Save</Button>
                          </DialogFooter>
                        </>
                      )}

                      {selectedTab === "year_level" && (
                        <>
                          <Input
                            placeholder="Year Level"
                            value={newYearLevel.name}
                            onChange={(e) => setNewYearLevel({ ...newYearLevel, name: e.target.value })}
                          />
                          <DialogFooter>
                            <Button variant="green" onClick={handleAddYearLevel}>Save</Button>
                          </DialogFooter>
                        </>
                      )}
                    </DialogContent>
                  </DialogPortal>
                </Dialog>
              </div>

              <Tabs defaultValue="academic_year" onValueChange={setSelectedTab}>
                <TabsList className="mb-4 bg-[#f0f5f0]">
                  <TabsTrigger value="academic_year">Academic Year</TabsTrigger>
                  <TabsTrigger value="semester">Semester</TabsTrigger>
                  <TabsTrigger value="program">Program</TabsTrigger>
                  <TabsTrigger value="year_level">Year Level</TabsTrigger>
                </TabsList>

                <div className="flex-1 flex flex-col">
                  {/* Academic Year Management */}
                  <TabsContent value="academic_year">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[25%]">Academic Year</TableHead>
                          <TableHead className="w-[20%]">Start Date</TableHead>
                          <TableHead className="w-[20%]">End Date</TableHead>
                          <TableHead className="w-[15%]">Status</TableHead>
                          <TableHead className="w-[20%] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getCurrentPaginatedItems().map((year) => (
                          <TableRow key={year.id}>
                            <TableCell className="font-medium">{year.year}</TableCell>
                            <TableCell>{year.startDate}</TableCell>
                            <TableCell>{year.endDate}</TableCell>
                            <TableCell>
                              <Button
                                variant={year.status === "Active" ? "green" : "destructive"}
                                size="sm"
                                className="w-16"
                                onClick={() => handleToggleAcademicYearStatus(year.id)}
                              >
                                {year.status}
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  className="p-2"
                                  onClick={() => handleEditClick(year)}
                                >
                                  <Edit size={24} />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="destructive" 
                                  className="p-2"
                                  onClick={() => handleDeleteClick(year.id)}
                                >
                                  <Trash2 size={24} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <Dialog open={showStatusDialog} onOpenChange={(open) => handleDialogChange('status', open)}>
                      <DialogPortal>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Confirm Status Change</DialogTitle>
                          </DialogHeader>
                          <p>Are you sure you want to change the status of this academic year?</p>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => handleDialogChange('status', false)}>Cancel</Button>
                            <Button variant="green" onClick={handleConfirmStatusChange}>Confirm</Button>
                          </DialogFooter>
                        </DialogContent>
                      </DialogPortal>
                    </Dialog>
                  </TabsContent>

                  <TabsContent value="semester">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[40%]">Semester</TableHead>
                          <TableHead className="w-[20%]">Status</TableHead>
                          <TableHead className="w-[40%] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getCurrentPaginatedItems().map((semester) => (
                          <TableRow key={semester.id}>
                            <TableCell className="font-medium">{semester.name}</TableCell>
                            <TableCell>
                              <Button
                                variant={semester.status === "Active" ? "green" : "destructive"}
                                size="sm"
                                className="w-16"
                                onClick={() => handleToggleSemesterStatus(semester.id)}
                              >
                                {semester.status}
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  className="p-2"
                                  onClick={() => handleEditSemesterClick(semester)}
                                >
                                  <Edit size={24} />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="destructive" 
                                  className="p-2"
                                  onClick={() => handleDeleteSemesterClick(semester.id)}
                                >
                                  <Trash2 size={24} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <Dialog open={showStatusDialog} onOpenChange={(open) => handleDialogChange('status', open)}>
                      <DialogPortal>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Confirm Status Change</DialogTitle>
                          </DialogHeader>
                          <p>Are you sure you want to change the status of this {selectedTab === 'academic_year' ? 'academic year' : 'semester'}?</p>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => handleDialogChange('status', false)}>Cancel</Button>
                            <Button variant="green" onClick={selectedTab === 'academic_year' ? handleConfirmStatusChange : handleConfirmSemesterStatusChange}>Confirm</Button>
                          </DialogFooter>
                        </DialogContent>
                      </DialogPortal>
                    </Dialog>
                  </TabsContent>

                  <TabsContent value="program">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[50%]">Program</TableHead>
                          <TableHead className="w-[20%]">Department</TableHead>
                          <TableHead className="w-[30%] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getCurrentPaginatedItems().map((program) => (
                          <TableRow key={program.id}>
                            <TableCell className="font-medium">{program.name}</TableCell>
                            <TableCell>{program.department_name || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  className="p-2"
                                  onClick={() => handleEditProgramClick(program)}
                                >
                                  <Edit size={24} />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="destructive" 
                                  className="p-2"
                                  onClick={() => handleDeleteProgramClick(program.id)}
                                >
                                  <Trash2 size={24} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="year_level">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[70%]">Year Level</TableHead>
                          <TableHead className="w-[30%] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getCurrentPaginatedItems().map((level) => (
                          <TableRow key={level.id}>
                            <TableCell className="font-medium">{level.name}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  className="p-2"
                                  onClick={() => handleEditYearLevelClick(level)}
                                >
                                  <Edit size={24} />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="destructive" 
                                  className="p-2"
                                  onClick={() => handleDeleteYearLevelClick(level.id)}
                                >
                                  <Trash2 size={24} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                </div>
                <div className="w-full flex justify-end p-4">
                  <PaginationComponent
                    currentPage={currentPages[selectedTab]}
                    totalPages={getCurrentTotalPages()}
                    onPageChange={handlePageChange}
                  />
                </div>
              </Tabs>
            </main>
          </div>
        </div>

        {/* Add Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogPortal>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Delete</DialogTitle>
              </DialogHeader>
              <p>Are you sure you want to delete this academic year? This action cannot be undone.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteAcademicYear}>Delete</Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>

        {/* Edit Academic Year Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogPortal>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Academic Year</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editAcademicYear">Academic Year</Label>
                  <Input
                    id="editAcademicYear"
                    placeholder="YYYY-YYYY (e.g., 2024-2025)"
                    value={editForm.year}
                    onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                    className={!isValidAcademicYear(editForm.year) && editForm.year ? "border-red-500" : ""}
                  />
                  {!isValidAcademicYear(editForm.year) && editForm.year && (
                    <p className="text-sm text-red-500">Please enter a valid academic year (e.g., 2024-2025)</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editStartDate">Start Date</Label>
                  <DatePicker
                    id="editStartDate"
                    value={editForm.startDate}
                    onChange={(date) => setEditForm({ ...editForm, startDate: date })}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editEndDate">End Date</Label>
                  <DatePicker
                    id="editEndDate"
                    value={editForm.endDate}
                    onChange={(date) => setEditForm({ ...editForm, endDate: date })}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                <Button variant="green" onClick={handleEditSubmit}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>

        {/* Edit Semester Dialog */}
        <Dialog open={showEditSemesterDialog} onOpenChange={setShowEditSemesterDialog}>
          <DialogPortal>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Semester</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editSemesterName">Semester Name</Label>
                  <Input
                    id="editSemesterName"
                    placeholder="Semester Name"
                    value={editSemesterForm.name}
                    onChange={(e) => setEditSemesterForm({ ...editSemesterForm, name: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditSemesterDialog(false)}>Cancel</Button>
                <Button variant="green" onClick={handleEditSemesterSubmit}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>

        {/* Delete Semester Dialog */}
        <Dialog open={showDeleteSemesterDialog} onOpenChange={setShowDeleteSemesterDialog}>
          <DialogPortal>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Delete</DialogTitle>
              </DialogHeader>
              <p>Are you sure you want to delete this semester? This action cannot be undone.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteSemesterDialog(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteSemester}>Delete</Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>

        {/* Edit Program Dialog */}
        <Dialog open={showEditProgramDialog} onOpenChange={setShowEditProgramDialog}>
          <DialogPortal>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Program</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editProgramName">Program Name</Label>
                  <Input
                    id="editProgramName"
                    placeholder="Program Name"
                    value={editProgramForm.name}
                    onChange={(e) => setEditProgramForm({ ...editProgramForm, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editDepartment">Department</Label>
                  <Select
                    value={editProgramForm.department_id?.toString() || "null"}
                    onValueChange={(value) => setEditProgramForm({ ...editProgramForm, department_id: value === "null" ? null : parseInt(value) })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">None</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id.toString()}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditProgramDialog(false)}>Cancel</Button>
                <Button variant="green" onClick={handleEditProgramSubmit}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>

        {/* Delete Program Dialog */}
        <Dialog open={showDeleteProgramDialog} onOpenChange={setShowDeleteProgramDialog}>
          <DialogPortal>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Delete</DialogTitle>
              </DialogHeader>
              <p>Are you sure you want to delete this program? This action cannot be undone.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteProgramDialog(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteProgram}>Delete</Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>

        {/* Edit Year Level Dialog */}
        <Dialog open={showEditYearLevelDialog} onOpenChange={setShowEditYearLevelDialog}>
          <DialogPortal>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Year Level</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editYearLevelName">Year Level Name</Label>
                  <Input
                    id="editYearLevelName"
                    placeholder="Year Level Name"
                    value={editYearLevelForm.name}
                    onChange={(e) => setEditYearLevelForm({ ...editYearLevelForm, name: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditYearLevelDialog(false)}>Cancel</Button>
                <Button variant="green" onClick={handleEditYearLevelSubmit}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>

        {/* Delete Year Level Dialog */}
        <Dialog open={showDeleteYearLevelDialog} onOpenChange={setShowDeleteYearLevelDialog}>
          <DialogPortal>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Delete</DialogTitle>
              </DialogHeader>
              <p>Are you sure you want to delete this year level? This action cannot be undone.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteYearLevelDialog(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteYearLevel}>Delete</Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      </main>
    </SidebarProvider>
  );
};

export default ManageCurriculum;
