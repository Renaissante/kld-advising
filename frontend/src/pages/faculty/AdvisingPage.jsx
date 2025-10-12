import React, { useState, useEffect, useMemo } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { Toaster } from "@/components/ui/sonner";
import { Search, Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SectionCarousel from "./SectionCarousel";
import StudentTable from "./StudentTable";
import AdvisingModal from "./AdvisingModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useActive } from "@/contexts/ActiveContext";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { API_BASE_URL } from '@/config/api'; 
const AdvisingPage = () => {
  const { user } = useAuth();
  const { activeAcademicYear, activeSemester, loading: activeLoading } = useActive();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("current");
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isAdvisingModalOpen, setIsAdvisingModalOpen] = useState(false);

  const [allSections, setAllSections] = useState([]);
  const [isLoadingSections, setIsLoadingSections] = useState(true);
  const [sectionsError, setSectionsError] = useState(null);

  const [selectedHistoricalAy, setSelectedHistoricalAy] = useState("");
  const [selectedHistoricalSem, setSelectedHistoricalSem] = useState("");
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);

  const [students, setStudents] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState(null);

  const [unavailableAdvisorStudents, setUnavailableAdvisorStudents] = useState([]);
  const [isLoadingUnavailableAdvisorStudents, setIsLoadingUnavailableAdvisorStudents] = useState(false);
  const [unavailableAdvisorStudentsError, setUnavailableAdvisorStudentsError] = useState(null);

  useEffect(() => {
    if (!user?.id) {
      setIsLoadingSections(false);
      setAllSections([]);
      setAcademicYears([]);
      setSemesters([]);
      return;
    }

    const fetchSections = async () => {
      setIsLoadingSections(true);
      setSectionsError(null);
      setAllSections([]);
      setAcademicYears([]);
      setSemesters([]);
      try {
        const apiUrl = `${API_BASE_URL}/faculty/get_sections.php?faculty_id=${user.id}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (jsonError) { /* Ignore */ }
          throw new Error(errorMessage);
        }

        const result = await response.json();

        if (result.success && result.data) {
          setAllSections(result.data);

          const uniqueAys = [...new Map(result.data.map(item =>
            [item.academic_year_id, { id: item.academic_year_id, year: item.academic_year }])).values()];
          const uniqueSems = [...new Map(result.data.map(item =>
            [item.semester_id, { id: item.semester_id, name: item.semester }])).values()];

          uniqueAys.sort((a, b) => a.year.localeCompare(b.year));
          uniqueSems.sort((a, b) => a.id - b.id);

          setAcademicYears(uniqueAys);
          setSemesters(uniqueSems);

        } else {
          throw new Error(result.message || 'Failed to fetch sections.');
        }

      } catch (err) {
        console.error("Error fetching sections:", err);
        setSectionsError(err.message);
        toast.error(`Error loading sections: ${err.message}`);
        setAllSections([]);
        setAcademicYears([]);
        setSemesters([]);
      } finally {
        setIsLoadingSections(false);
      }
    };

    fetchSections();
  }, [user]);

  useEffect(() => {
    const fetchUnavailableAdvisorStudents = async () => {
      if (activeTab !== "unavailable-advisor-students") return;
      if (!user?.id || !activeAcademicYear?.id || !activeSemester?.id) {
        setUnavailableAdvisorStudents([]);
        setIsLoadingUnavailableAdvisorStudents(false);
        setUnavailableAdvisorStudentsError(null);
        return;
      }

      setIsLoadingUnavailableAdvisorStudents(true);
      setUnavailableAdvisorStudentsError(null);
      try {
        const apiUrl = `${API_BASE_URL}/student/read_students_by_unavailable_advisor.php?academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}`;
        console.log("Fetching students with unavailable advisors from:", apiUrl);

        const response = await fetch(apiUrl);
        if (!response.ok) {
          let errorMsg = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
            console.error("Unavailable students fetch error response:", errorData);
          } catch (e) {
            console.error("Unavailable students fetch error (non-JSON):", await response.text());
          }
          throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("Unavailable students API response:", data);

        if (data.success && Array.isArray(data.data)) {
          setUnavailableAdvisorStudents(data.data);
        } else if (data.success && !Array.isArray(data.data)) {
          console.warn("API for unavailable students returned success but data is not an array:", data.data);
          setUnavailableAdvisorStudents([]);
          throw new Error(data.message || "API returned unexpected data format for unavailable students.");
        } else {
          throw new Error(data.message || "Failed to fetch students with unavailable advisors.");
        }
      } catch (error) {
        console.error("Fetching unavailable advisor students failed:", error);
        setUnavailableAdvisorStudentsError(error.message || "Failed to load students with unavailable advisors. Please try again later.");
        setUnavailableAdvisorStudents([]);
      } finally {
        setIsLoadingUnavailableAdvisorStudents(false);
      }
    };

    fetchUnavailableAdvisorStudents();
  }, [activeTab, user, activeAcademicYear, activeSemester]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedSection?.id || !user?.id || !activeAcademicYear?.id || !activeSemester?.id) {
        setStudents([]);
        setIsLoadingStudents(false);
        setStudentsError(null);
        if (selectedSection && (!activeAcademicYear?.id || !activeSemester?.id)) {
            console.warn("Cannot fetch students: Active academic year or semester ID is missing.");
        }
        return;
      }

      setIsLoadingStudents(true);
      setStudentsError(null);
      try {
        const apiUrl = `${API_BASE_URL}/faculty/get_students_by_section.php?section_id=${selectedSection.id}&faculty_id=${user.id}&academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}`;

        console.log("Fetching students from:", apiUrl);
        const response = await fetch(apiUrl);

        if (!response.ok) {
          let errorMsg = `HTTP error! status: ${response.status}`;
          let errorData = null;
          try {
            errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
            console.error("Student fetch error response:", errorData);
          } catch (e) {
             console.error("Student fetch error (non-JSON):", await response.text());
           }
          throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("Students API response:", data);

        if (data.success && Array.isArray(data.data)) {
           setStudents(data.data);
           console.log("Students state set:", data.data);
        } else {
           if (data.success && !Array.isArray(data.data)) {
               console.warn("API success but data is not an array:", data.data);
               setStudents([]);
               throw new Error(data.message || "API returned unexpected data format.");
           } else {
               throw new Error(data.message || "API returned success:false or missing data field.");
           }
        }
      } catch (error) {
        console.error("Fetching students failed:", error);
        setStudentsError(error.message || "Failed to load students. Please try again later.");
        setStudents([]);
      } finally {
        setIsLoadingStudents(false);
      }
    };

    if (selectedSection && !activeLoading) {
        fetchStudents();
    } else {
        setStudents([]);
        setIsLoadingStudents(false);
        setStudentsError(null);
    }

  }, [selectedSection, user, activeAcademicYear, activeSemester, activeLoading]);

  // Modified function to update student status AND units after advising
  const handleAdvisingComplete = (studentId, advisedUnits) => {
    setStudents(prevStudents =>
      prevStudents.map(student =>
        student.id === studentId ? { ...student, advising_status: "Done", units: advisedUnits } : student
      )
    );
  };


  const hasAvailableSections = useMemo(() => {
    if (!allSections || allSections.length === 0) {
      return false;
    }

    const activeAyId = activeAcademicYear?.id;
    const activeSemId = activeSemester?.id;

    if (activeLoading || !activeAyId || !activeSemId) {
        return allSections.length > 0;
    }

    if (activeTab === "current") {
      return allSections.some(section =>
        section.academic_year_id === activeAyId &&
        section.semester_id === activeSemId
      );
    } else {
      return allSections.some(section =>
        section.academic_year_id < activeAyId ||
        (section.academic_year_id === activeAyId && section.semester_id < activeSemId)
      );
    }
  }, [allSections, activeTab, activeAcademicYear, activeSemester, activeLoading]);

  const handleSectionSelect = (section) => {
    if (selectedSection?.id !== section?.id) {
        console.log("Selected Section:", section);
        setSelectedSection(section);
        setSelectedStudent(null);
    }
  };

  const handleAdviseStudent = (student) => {
    setSelectedStudent(student);
    setIsAdvisingModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAdvisingModalOpen(false);
    setTimeout(() => {
       setSelectedStudent(null);
    }, 300);
  };

  const handleTabChange = (newTabValue) => {
    setActiveTab(newTabValue);
    setSelectedSection(null);
    setSelectedStudent(null);
    setStudents([]);
    setStudentsError(null);
    setSelectedHistoricalAy("");
    setSelectedHistoricalSem("");

    // Reset unavailable advisor students state when switching away from its tab
    if (newTabValue !== "unavailable-advisor-students") {
      setUnavailableAdvisorStudents([]);
      setIsLoadingUnavailableAdvisorStudents(false);
      setUnavailableAdvisorStudentsError(null);
    }
  };

  const handleHistoricalAyChange = (ayId) => {
    const numericAyId = parseInt(ayId);
    setSelectedHistoricalAy(numericAyId);
    setSelectedHistoricalSem("");
    setSelectedSection(null);
    setStudents([]);
    setStudentsError(null);
  };

  const handleHistoricalSemChange = (semId) => {
     const numericSemId = parseInt(semId);
    setSelectedHistoricalSem(numericSemId);
    setSelectedSection(null);
    setStudents([]);
    setStudentsError(null);
  };

  const isLoading = isLoadingSections || activeLoading;

  return (
    <SidebarProvider>
      <Toaster richColors position="bottom-right" />
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />

        <div className="container mx-auto p-4 md:p-6 mt-4">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Academic Advising</h1>
              <p className="text-muted-foreground">Manage academic advising for your assigned sections</p>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-4">
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full md:w-auto">
                <TabsList className="bg-muted/60 dark:bg-muted/30">
                  <TabsTrigger value="previous">Previous Semesters</TabsTrigger>
                  <TabsTrigger value="current">Current Semester</TabsTrigger>
                  <TabsTrigger value="unavailable-advisor-students">Students With Unavailable Advisors</TabsTrigger>
                </TabsList>
              </Tabs>
              {activeTab !== "unavailable-advisor-students" && (
              <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search sections/programs..."
                  className="pl-8 w-full h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              )}
            </div>
      
            {isLoading ? (
              <div className="p-6 border rounded-lg">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : sectionsError && activeTab !== "unavailable-advisor-students" ? (
              <div className="flex justify-center items-center p-8 border rounded-lg bg-destructive/10 text-destructive">
                <p>Error loading sections: {sectionsError}</p>
              </div>
            ) : isLoadingUnavailableAdvisorStudents && activeTab === "unavailable-advisor-students" ? (
              <div className="p-6 border rounded-lg">
                <div className="flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  <span>Loading students...</span>
                </div>
                <Skeleton className="h-40 w-full mt-4" />
              </div>
            ) : unavailableAdvisorStudentsError && activeTab === "unavailable-advisor-students" ? (
              <div className="flex justify-center items-center p-8 border rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5 mr-2" />
                <p>Error loading students: {unavailableAdvisorStudentsError}</p>
              </div>
            ) : activeTab === "unavailable-advisor-students" ? (
              <StudentTable
                students={unavailableAdvisorStudents}
                onAdviseStudent={handleAdviseStudent}
                sectionName="Students With Unavailable Advisors"
                activeTab={activeTab}
              />
            ) : (
              <SectionCarousel
                allSections={allSections}
                selectedSectionId={selectedSection?.id}
                onSelectSection={handleSectionSelect}
                activeTab={activeTab}
                activeAcademicYear={activeAcademicYear}
                activeSemester={activeSemester}
                selectedHistoricalAy={selectedHistoricalAy}
                selectedHistoricalSem={selectedHistoricalSem}
                onHistoricalAyChange={handleHistoricalAyChange}
                onHistoricalSemChange={handleHistoricalSemChange}
                academicYears={academicYears}
                semesters={semesters}
                searchQuery={searchQuery}
              />
            )}

            {selectedSection && !isLoadingSections && !sectionsError && (
                (isLoadingStudents || activeLoading) ? (
                    <div className="p-6 border rounded-lg mt-6">
                        <div className="flex items-center justify-center text-muted-foreground">
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            <span>Loading students...</span>
                        </div>
                        <Skeleton className="h-40 w-full mt-4" />
                    </div>
                ) : studentsError ? (
                    <div className="flex justify-center items-center p-8 border rounded-lg bg-destructive/10 text-destructive mt-6">
                         <AlertTriangle className="h-5 w-5 mr-2" />
                         <p>Error loading students: {studentsError}</p>
                    </div>
                ) : (
              <StudentTable
                        students={students}
                onAdviseStudent={handleAdviseStudent}
                sectionName={selectedSection.name || ""}
                activeTab={activeTab}
              />
                )
            )}
            {!selectedSection && !isLoadingSections && !sectionsError && hasAvailableSections && (
                 <div className="flex justify-center items-center p-8 border rounded-lg text-muted-foreground mt-6">
                    <p>Select a section above to view students.</p>
                 </div>
            )}

            <AdvisingModal
              isOpen={isAdvisingModalOpen}
              onClose={handleCloseModal}
              student={selectedStudent}
              activeAcademicYear={activeAcademicYear}
              activeSemester={activeSemester}
              onAdvisingComplete={handleAdvisingComplete}
            />
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default AdvisingPage;