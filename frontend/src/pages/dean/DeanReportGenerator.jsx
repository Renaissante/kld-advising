import React, { useState } from 'react';
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

    // Static data for reports
    const advisingCompletionData = [
        { program: "BS Computer Science", completedForms: 280, totalForms: 300, completionRate: "93.3%", overdueForms: 20 },
        { program: "BS Information Technology", completedForms: 230, totalForms: 250, completionRate: "92.0%", overdueForms: 20 },
        { program: "BS Information Systems", completedForms: 160, totalForms: 180, completionRate: "88.9%", overdueForms: 20 },
    ];

    const facultyWorkloadData = [
        { faculty: "Maria C. Reyes", advisedStudents: 45, sectionsTaught: 3, totalUnits: 9 },
        { faculty: "Jose L. Santos", advisedStudents: 40, sectionsTaught: 4, totalUnits: 12 },
        { faculty: "Anna B. Garcia", advisedStudents: 38, sectionsTaught: 3, totalUnits: 9 },
        { faculty: "David M. Cruz", advisedStudents: 50, sectionsTaught: 4, totalUnits: 12 },
        { faculty: "Sophia N. Lim", advisedStudents: 30, sectionsTaught: 2, totalUnits: 6 },
    ];

    const generateReport = () => {
        // For now, just log the selected report type and data
        console.log("Generating report:", selectedReportType);
        if (selectedReportType === "enrollment") {
            console.log("Enrollment Data:", enrollmentData);
        } else if (selectedReportType === "advisingCompletion") {
            console.log("Advising Completion Data:", advisingCompletionData);
        } else if (selectedReportType === "facultyWorkload") {
            console.log("Faculty Workload Data:", facultyWorkloadData);
        }
        // In a real application, this would trigger a download or display a generated report.
    };

    const renderReportTable = () => {
        if (selectedReportType === "advisingCompletion") {
            return (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Program</TableHead>
                            <TableHead>Total Forms</TableHead>
                            <TableHead>Completed Forms</TableHead>
                            <TableHead>Overdue Forms</TableHead>
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
