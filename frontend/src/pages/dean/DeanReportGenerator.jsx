import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Download } from "lucide-react";

const DeanReportGenerator = () => {
    const [selectedReportType, setSelectedReportType] = useState("advisingCompletion");
    const [advisingCompletionData, setAdvisingCompletionData] = useState([]);
    const [facultyWorkloadData, setFacultyWorkloadData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeAcademicYear, setActiveAcademicYear] = useState(null);
    const [activeSemester, setActiveSemester] = useState(null);

    // Static data for faculty workload (will be replaced later if a dedicated API is found)
    const staticFacultyWorkloadData = [
        { faculty: "Maria C. Reyes", advisedStudents: 45, sectionsTaught: 3, totalUnits: 9 },
        { faculty: "Jose L. Santos", advisedStudents: 40, sectionsTaught: 4, totalUnits: 12 },
        { faculty: "Anna B. Garcia", advisedStudents: 38, sectionsTaught: 3, totalUnits: 9 },
        { faculty: "David M. Cruz", advisedStudents: 50, sectionsTaught: 4, totalUnits: 12 },
        { faculty: "Sophia N. Lim", advisedStudents: 30, sectionsTaught: 2, totalUnits: 6 },
    ];

    useEffect(() => {
        // setFacultyWorkloadData(staticFacultyWorkloadData); // Initialize with static data - REMOVED
        fetchReportData();
    }, [selectedReportType, activeAcademicYear, activeSemester]);

    const fetchReportData = async () => {
        setLoading(true);
        setError(null);
        try {
            let url = '';
            if (selectedReportType === "advisingCompletion") {
                url = `http://localhost/kld-advising/backend/api/dean/read_dashboard_data.php`;
            } else if (selectedReportType === "facultyWorkload") {
                url = `http://localhost/kld-advising/backend/api/dean/read_faculty_workload.php`;
            }

            const queryParams = [];
            if (activeAcademicYear) {
                queryParams.push(`academic_year=${activeAcademicYear}`);
            }
            if (activeSemester) {
                queryParams.push(`semester_name=${activeSemester}`);
            }

            if (queryParams.length > 0) {
                url += `?${queryParams.join('&')}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            if (result.activeAcademicYear) {
                setActiveAcademicYear(result.activeAcademicYear.academic_year_name);
            }
            if (result.activeSemester) {
                setActiveSemester(result.activeSemester.semester_name);
            }

            // Map programPerformance to advisingCompletionData format
            if (selectedReportType === "advisingCompletion" && result.programPerformance) {
                const mappedAdvisingData = result.programPerformance.map(program => {
                    const totalStudents = result.sectionData.filter(s => s.program === program.program).reduce((sum, s) => sum + s.totalStudents, 0);
                    const advisedStudents = result.sectionData.filter(s => s.program === program.program).reduce((sum, s) => sum + s.advisedStudents, 0);
                    const pendingForms = totalStudents - advisedStudents;

                    return {
                        program: program.program,
                        totalForms: totalStudents,
                        completedForms: advisedStudents,
                        completionRate: `${program.advisingRate}%`,
                        overdueForms: pendingForms,
                    };
                });
                setAdvisingCompletionData(mappedAdvisingData);
            } else if (selectedReportType === "facultyWorkload") {
                setFacultyWorkloadData(result);
            }

        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const generateReport = async () => {
        try {
            let reportDataToSend = {};
            let filename = "";

            if (selectedReportType === "advisingCompletion") {
                reportDataToSend = {
                    type: "advisingCompletion",
                    data: advisingCompletionData,
                    academicYear: activeAcademicYear,
                    semester: activeSemester
                };
                filename = `Advising_Completion_Report_${activeAcademicYear}_${activeSemester}.pdf`;
            } else if (selectedReportType === "facultyWorkload") {
                reportDataToSend = {
                    type: "facultyWorkload",
                    data: facultyWorkloadData,
                    academicYear: activeAcademicYear,
                    semester: activeSemester
                };
                filename = `Faculty_Workload_Report_${activeAcademicYear}_${activeSemester}.pdf`;
            } else {
                console.warn("Unknown report type selected for PDF generation.");
                return;
            }

            const response = await fetch("http://localhost/kld-advising/backend/api/dean/generate_report_pdf.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(reportDataToSend),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            console.log("PDF report generated and downloaded.");
        } catch (error) {
            console.error("Error generating PDF report:", error);
            setError("Failed to generate PDF report.");
        }
    };

    const renderReportTable = () => {
        if (loading) {
            return <div className="text-center py-4">Loading report data...</div>;
        }

        if (error) {
            return <div className="text-center py-4 text-red-500">Error: {error}</div>;
        }

        if (selectedReportType === "advisingCompletion") {
            return (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Program</TableHead>
                            <TableHead>Total Forms</TableHead>
                            <TableHead>Completed Forms</TableHead>
                            <TableHead>Pending Forms</TableHead>
                            <TableHead>Completion Rate</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {advisingCompletionData.map((data, index) => (
                            <TableRow key={index}>
                                <TableCell>{data.program}</TableCell>
                                <TableCell>{data.totalForms}</TableCell>
                                <TableCell>{data.completedForms}</TableCell>
                                <TableCell>{data.overdueForms}</TableCell>
                                <TableCell>{data.completionRate}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            );
        } else if (selectedReportType === "facultyWorkload") {
            return (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Faculty</TableHead>
                            <TableHead>Advised Students</TableHead>
                            <TableHead>Sections Taught</TableHead>
                            <TableHead>Total Units</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {facultyWorkloadData.map((data, index) => (
                            <TableRow key={index}>
                                <TableCell>{data.faculty}</TableCell>
                                <TableCell>{data.advisedStudents}</TableCell>
                                <TableCell>{data.sectionsTaught}</TableCell>
                                <TableCell>{data.totalUnits}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            );
        }
        return null;
    };

    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="w-full">
                <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />

                <div className="container mx-auto p-4 md:p-6 mt-4 dark:bg-gray-950">
                    <div className="flex flex-col gap-6">
                        <div>
                            <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Generate Reports</h1>
                            <p className="text-muted-foreground mt-1">
                                Generate various reports for academic overview
                            </p>
                        </div>

                        <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50">Report Options</CardTitle>
                                <Button
                                    onClick={generateReport}
                                    variant="green"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Generate Report
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Report Type</label>
                                    <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                                        <SelectTrigger className="border-gray-300 w-full md:w-60 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-50">
                                            <SelectValue placeholder="Select a report type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="advisingCompletion">Advising Completion Report</SelectItem>
                                            <SelectItem value="facultyWorkload">Faculty Workload Report</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="mt-6">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Report Preview</h3>
                                    <div className="border border-gray-200 rounded-lg dark:border-gray-700 overflow-x-auto">
                                        {renderReportTable()}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </SidebarProvider>
    );
};

export default DeanReportGenerator;
