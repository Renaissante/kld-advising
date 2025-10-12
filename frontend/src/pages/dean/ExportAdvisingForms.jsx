import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '@/config/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Download, Search, FileDown, Filter, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { PaginationComponent } from "@/components/shared/PaginationComponent";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ExportAdvisingForms = () => {
    const [academicYears, setAcademicYears] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [sections, setSections] = useState([]);
    const [yearLevels, setYearLevels] = useState([]);

    const [selectedAcademicYear, setSelectedAcademicYear] = useState(null); // Initialize as null
    const [selectedSemester, setSelectedSemester] = useState(null); // Initialize as null
    const [selectedProgram, setSelectedProgram] = useState("all");
    const [selectedSection, setSelectedSection] = useState("all");
    const [selectedYearLevel, setSelectedYearLevel] = useState("all");

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFormat, setSelectedFormat] = useState("PDF");

    const [allAdvisingForms, setAllAdvisingForms] = useState([]);
    const [filteredAdvisingForms, setFilteredAdvisingForms] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const formsPerPage = 8; // Number of forms to display per page

    const [allYearLevels, setAllYearLevels] = useState([]);
    const [filteredYearLevels, setFilteredYearLevels] = useState([]);
    const [allSections, setAllSections] = useState([]);
    const [filteredSections, setFilteredSections] = useState([]);

    // Derived state for only completed and filtered forms
    const completedFilteredForms = useMemo(() => {
        return filteredAdvisingForms.filter(form => form.status === "Completed");
    }, [filteredAdvisingForms]);

    const fetchFilterData = useCallback(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/dean/read_dashboard_data.php`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                
                // Set active academic year and semester directly
                setSelectedAcademicYear(data.activeAcademicYear?.academic_year_name || null);
                setSelectedSemester(data.activeSemester?.semester_name || null);

                setPrograms(data.programs);
                setAllYearLevels(data.yearLevels);
                setAllSections(data.sections);

            // Removed these as they are now fetched as full lists and filtered dynamically
            // const uniqueSections = Array.from(new Set(data.sectionData.map(s => s?.section_name).filter(Boolean)));
            // const uniqueYearLevels = Array.from(new Set(data.sectionData.map(s => s?.year_level).filter(Boolean)));
            // setSections(["all", ...uniqueSections]);
            // setYearLevels(["all", ...uniqueYearLevels]);

            } catch (err) {
                setError('Failed to fetch filter data.');
                console.error("Error fetching filter data:", err);
            } finally {
                setLoading(false);
            }
    }, []);

    useEffect(() => {
        fetchFilterData();
    }, [fetchFilterData]);

    // Dependent dropdown logic
    useEffect(() => {
        if (selectedProgram === "all") {
            setFilteredYearLevels(allYearLevels);
        } else {
            const programId = programs.find(p => p.name === selectedProgram)?.id;
            if (programId) {
                const yearsForProgram = Array.from(new Set(allSections.filter(s => s.program_id === programId).map(s => s.year_level_name)));
                setFilteredYearLevels(allYearLevels.filter(yl => yearsForProgram.includes(yl.level)));
            } else {
                setFilteredYearLevels(allYearLevels);
            }
        }
        setSelectedYearLevel("all"); // Reset year level when program changes
    }, [selectedProgram, allYearLevels, allSections, programs]);

    useEffect(() => {
        if (selectedProgram === "all" && selectedYearLevel === "all") {
            setFilteredSections(allSections.map(s => s.section_name));
        } else {
            let sectionsToFilter = allSections;

            if (selectedProgram !== "all") {
                const programId = programs.find(p => p.name === selectedProgram)?.id;
                sectionsToFilter = sectionsToFilter.filter(s => s.program_id === programId);
            }

            if (selectedYearLevel !== "all") {
                sectionsToFilter = sectionsToFilter.filter(s => s.year_level_name === selectedYearLevel);
            }
            setFilteredSections(Array.from(new Set(sectionsToFilter.map(s => s.section_name))));
        }
        setSelectedSection("all"); // Reset section when program or year level changes
    }, [selectedProgram, selectedYearLevel, allSections, programs]);


    const fetchAdvisingForms = useCallback(async () => {
        if (!selectedAcademicYear || !selectedSemester) {
            setLoading(false);
            return; // Don't fetch if active year or semester is not yet set
        }
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                academic_year: selectedAcademicYear, // Use active academic year
                semester: selectedSemester, // Use active semester
                // Remove program, section, year_level, search_query from initial fetch
                // These will be handled by client-side filtering into filteredAdvisingForms
                // program: selectedProgram === 'all' ? '' : selectedProgram,
                // section: selectedSection === 'all' ? '' : selectedSection,
                // year_level: selectedYearLevel === 'all' ? '' : selectedYearLevel,
                // search_query: searchQuery,
            });
            const response = await fetch(`${API_BASE_URL}/dean/read_advising_forms.php?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setAllAdvisingForms(data.map(form => ({
                advised_course_id: form?.advised_course_id ?? '',
                student_name: form?.student_name ?? '',
                student_number: form?.student_number ?? '',
                advisor_name: form?.advisor_name ?? '',
                section_name: form?.section_name ?? '',
                year_level: form?.year_level ?? '',
                program_name: form?.program_name ?? '',
                academic_year_name: form?.academic_year_name ?? '',
                semester_name: form?.semester_name ?? '',
                advising_date: form?.advising_date ?? '',
                status: form?.advising_status ?? 'Pending',
            })));
        } catch (err) {
            setError('Failed to fetch advising forms.');
            console.error("Error fetching advising forms:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedAcademicYear, selectedSemester]);

    useEffect(() => {
        fetchAdvisingForms();
    }, [fetchAdvisingForms]);

    useEffect(() => {
        const filtered = allAdvisingForms.filter((form) => {
            const matchesSearch =
                (form?.student_name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (form?.student_number ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (form?.advisor_name ?? '').toLowerCase().includes(searchQuery.toLowerCase());

            const matchesSection = selectedSection === "all" || (form?.section_name ?? '') === selectedSection;
            const matchesYearLevel = selectedYearLevel === "all" || (form?.year_level ?? '') === selectedYearLevel;
            const matchesProgram = selectedProgram === "all" || (form?.program_name ?? '') === selectedProgram;
            // Academic year and semester are already filtered by the backend when fetching allAdvisingForms
            // const matchesAcademicYear = selectedAcademicYear === "all" || (form?.academic_year_name ?? '') === selectedAcademicYear;
            // const matchesSemester = selectedSemester === "all" || (form?.semester_name ?? '') === selectedSemester;

            // Removed: const matchesStatus = form?.status === "Completed"; // Only include completed forms

            return matchesSearch && matchesSection && matchesYearLevel && matchesProgram;
        });
        setFilteredAdvisingForms(filtered);
        setCurrentPage(1); // Reset to first page on filter change
    }, [allAdvisingForms, searchQuery, selectedSection, selectedYearLevel, selectedProgram]); // Removed selectedAcademicYear, selectedSemester

    const hasActiveFilters =
        // selectedAcademicYear !== "all" || // Academic year is now always active, not a selectable filter
        // selectedSemester !== "all" ||    // Semester is now always active, not a selectable filter
        selectedProgram !== "all" ||
        selectedSection !== "all" ||
        selectedYearLevel !== "all" ||
        searchQuery !== "";

    const clearAllFilters = () => {
        // Academic Year and Semester are now active and should not be cleared
        // setSelectedAcademicYear("all");
        // setSelectedSemester("all");
        setSelectedProgram("all");
        setSelectedSection("all");
        setSelectedYearLevel("all");
        setSearchQuery("");
    };

    const handleExport = async () => {
        console.log(`Exporting ${completedFilteredForms.length} forms as ${selectedFormat}`);
        console.log("Filters:", { selectedAcademicYear, selectedSemester, selectedProgram, selectedSection, selectedYearLevel, searchQuery, selectedFormat });

        if (completedFilteredForms.length === 0) {
            toast.info("No completed advising forms match the current filters for export.");
            return;
        }

        try {
            const params = new URLSearchParams({
                academic_year: selectedAcademicYear, // Pass active academic year
                semester: selectedSemester, // Pass active semester
                program: selectedProgram === 'all' ? '' : selectedProgram,
                section: selectedSection === 'all' ? '' : selectedSection,
                year_level: selectedYearLevel === 'all' ? '' : selectedYearLevel,
                search_query: searchQuery,
                format: selectedFormat.toLowerCase(), // Use lowercase for backend
            });

            const response = await fetch(`${API_BASE_URL}/dean/export_advising_forms.php?${params.toString()}`);

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.message) {
                        errorMessage = errorJson.message;
                    }
                } catch (jsonError) {
                    // If not JSON, use the raw text
                    errorMessage = errorText;
                }
                throw new Error(errorMessage);
            }
            
            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'advising_forms';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            // Create a link element, set the download attribute, and click it
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename; // Use the filename from the header
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            toast.success(`Exported ${completedFilteredForms.length} advising forms as ${selectedFormat}.`);
        } catch (err) {
            console.error("Error during export:", err);
            toast.error(`Failed to export forms: ${err.message}`);
        }
    };

    // Pagination logic
    const indexOfLastForm = currentPage * formsPerPage;
    const indexOfFirstForm = indexOfLastForm - formsPerPage;
    const currentForms = filteredAdvisingForms.slice(indexOfFirstForm, indexOfLastForm);
    const totalPages = Math.ceil(filteredAdvisingForms.length / formsPerPage);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="w-full">
                <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />

                <div className="container mx-auto p-4 md:p-6 mt-4 dark:bg-gray-950">
                    <div className="flex flex-col gap-6">
                        {/* Header */}
                <div>
                            <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Advising Forms Management</h1>
                            <p className="text-muted-foreground mt-1">
                                View and export completed advising forms
                            </p>
                </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Total Forms</p>
                                           <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{allAdvisingForms.length}</p>
                                            <p className="text-xs text-gray-500 mt-1">All advising records</p>
                                        </div>
                                       <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                                            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Completed</p>
                                           <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                                                {allAdvisingForms.filter((f) => f.status === "Completed").length}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">Ready to export</p>
                                        </div>
                                       <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30">
                                            <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className={`bg-white border shadow-sm dark:bg-gray-950 dark:border-gray-800 ${hasActiveFilters ? "border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30" : "border-gray-200"}`}>
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                <div>
                                            <p className="text-sm text-muted-foreground mb-1">Filtered Results</p>
                                           <p className={`text-2xl font-semibold ${hasActiveFilters ? "text-purple-600 dark:text-purple-400" : "text-gray-900 dark:text-gray-50"}`}>
                                                {filteredAdvisingForms.length}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {hasActiveFilters ? "Filters applied" : "No filters applied"}
                                            </p>
                                        </div>
                                       <div className={`p-3 rounded-lg ${hasActiveFilters ? "bg-purple-100 dark:bg-purple-900/30" : "bg-purple-50 dark:bg-purple-900/30"}`}>
                                            <Filter className={`w-6 h-6 ${hasActiveFilters ? "text-purple-700" : "text-purple-600"}`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                </div>

                        <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                       <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50">Filter & Export</CardTitle>
                                       <CardDescription className="text-muted-foreground">
                                            Step 1: Apply filters • Step 2: Choose format • Step 3: Export
                                        </CardDescription>
                                    </div>
                                    {hasActiveFilters && (
                                        <Button variant="outline" size="sm" onClick={clearAllFilters} className="text-gray-600 hover:text-gray-900 bg-transparent">
                                            <X className="w-4 h-4 mr-2 dark:text-gray-400" /> Clear Filters
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                <div>
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">Filters</label>
                                    <div className="flex flex-wrap gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                                                <Input
                                                    placeholder="Search students or faculty..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="pl-10 border-gray-300 w-full md:w-60 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-50"
                                                />
                                            </div>
                                        </div>

                                        {/* Display Active Academic Year and Semester */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Academic Year</label>
                                            <Input
                                                value={selectedAcademicYear || "Loading..."}
                                                readOnly
                                                className="w-full md:w-40 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Semester</label>
                                            <Input
                                                value={selectedSemester || "Loading..."}
                                                readOnly
                                                className="w-full md:w-40 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Program</label>
                                            <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                                                <SelectTrigger className="border-gray-300 w-full md:w-40 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-50">
                                                    <SelectValue placeholder="All Programs" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Programs</SelectItem>
                                                    {programs.map((program, index) => (
                                                        <SelectItem key={program.id || `program-${index}`} value={program.name}>{program.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Year Level</label>
                                            <Select value={selectedYearLevel} onValueChange={setSelectedYearLevel}>
                                                <SelectTrigger className="border-gray-300 w-full md:w-40 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-50">
                                                    <SelectValue placeholder="All Year Levels" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Year Levels</SelectItem>
                                                    {filteredYearLevels.map((year, index) => (
                                                        <SelectItem key={year.id || `yearLevel-${index}`} value={year.level}>
                                                            {year.level}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Section</label>
                                            <Select value={selectedSection} onValueChange={setSelectedSection}>
                                                <SelectTrigger className="border-gray-300 w-full md:w-40 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-50">
                                                    <SelectValue placeholder="All Sections" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Sections</SelectItem>
                                                    {filteredSections.map((sectionName, index) => (
                                                        <SelectItem key={`${sectionName}-${index}`} value={sectionName}>
                                                            {sectionName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                </div>
            </div>

                                <div className="border-t border-gray-200 pt-4">
                                    <div className="flex items-end gap-3">
                                        <div className="flex-1">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Export Format</label>
                                            <Select value={selectedFormat} onValueChange={(value) => setSelectedFormat(value)}>
                                                <SelectTrigger className="border-gray-300 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-50">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="PDF">PDF Document (.pdf)</SelectItem>
                                                    <SelectItem value="DOC">Word Document (.docx)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button
                                            onClick={handleExport}
                                            variant="green"
                                            disabled={completedFilteredForms.length === 0}
                                        >
                                            <FileDown className="w-4 h-4 mr-2 dark:text-gray-50" />
                                            Export {completedFilteredForms.length} {completedFilteredForms.length === 1 ? "Form" : "Forms"}
                                        </Button>
                                    </div>
                                    {completedFilteredForms.length > 0 && (
                                        <p className="text-xs text-muted-foreground mt-3">
                                            {hasActiveFilters
                                                ? `You're about to export ${completedFilteredForms.length} filtered form${completedFilteredForms.length === 1 ? "" : "s"} as ${selectedFormat}.`
                                                : `You're about to export all ${completedFilteredForms.length} forms as ${selectedFormat}.`}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Forms Table Card */}
                        <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50">Advising Forms</CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    {filteredAdvisingForms.length} {filteredAdvisingForms.length === 1 ? "form" : "forms"}{" "}
                                    {hasActiveFilters ? "matching your filters" : "available"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto border border-gray-200 rounded-lg dark:border-gray-700">
                                    <Table className="min-w-full table-auto md:table-fixed">
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="px-3 py-2">Student</TableHead>
                                                <TableHead className="px-3 py-2">Advisor</TableHead>
                                                <TableHead className="px-3 py-2">Section</TableHead>
                                                <TableHead className="px-3 py-2">Year Level</TableHead>
                                                <TableHead className="px-3 py-2">Program</TableHead>
                                                <TableHead className="px-3 py-2">Date</TableHead>
                                                <TableHead className="px-3 py-2">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loading ? (
                                                [...Array(5)].map((_, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell colSpan={7} className="py-4">
                                                            <Skeleton className="h-5 w-full" />
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : filteredAdvisingForms.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-12">
                                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                                            <FileText className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
                                                            <p className="font-medium">No forms found</p>
                                                            <p className="text-sm mt-1 dark:text-gray-400">Try adjusting your filters or search query</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                currentForms.map((form, index) => (
                                                    <TableRow key={`${form.student_number}-${form.advised_course_id ?? `form-${index}`}`} className="hover:bg-gray-50 dark:hover:bg-muted/50">
                                                        <TableCell className="font-medium text-gray-900 px-3 py-2">
                                                            <div>
                                                                <div className="dark:text-gray-50">{form.student_name}</div>
                                                                <div className="text-xs text-gray-500 dark:text-gray-400">ID: {form.student_number}</div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-gray-600 dark:text-gray-400 px-3 py-2">{(form.advisor_name ?? 'N/A')}</TableCell>
                                                        <TableCell className="text-gray-600 dark:text-gray-400 px-3 py-2">{form.section_name ?? 'N/A'}</TableCell>
                                                        <TableCell className="text-gray-600 dark:text-gray-400 px-3 py-2">{form.year_level ?? 'N/A'}</TableCell>
                                                        <TableCell className="text-gray-600 dark:text-gray-400 px-3 py-2">{form.program_name ?? 'N/A'}</TableCell>
                                                        <TableCell className="text-gray-600 dark:text-gray-400 px-3 py-2">
                                                            {form.advising_date ? new Date(form.advising_date).toLocaleDateString("en-US", {
                                                                month: "short",
                                                                day: "numeric",
                                                                year: "numeric",
                                                            }) : 'N/A'}
                                                        </TableCell>
                                                        <TableCell className="px-3 py-2">
                                                           <Badge
                                                               variant={
                                                                   form.status === "Completed"
                                                                       ? "default"
                                                                       : "secondary"
                                                               }
                                                           >
                                                               {form.status}
                                                           </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                {filteredAdvisingForms.length > formsPerPage && (
                                  <div className='mt-6'>
                                    <PaginationComponent
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        onPageChange={handlePageChange}
                                    />
                                  </div>
                                )}
                                {error && <div className="text-red-500 dark:text-red-400 text-center mt-4">Error: {error}</div>}
                            </CardContent>
                        </Card>
            </div>
        </div>
            </main>
        </SidebarProvider>
    );
};

export default ExportAdvisingForms;
