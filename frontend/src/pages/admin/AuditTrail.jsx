import React, { useEffect, useState, useCallback, useRef } from 'react';
import { API_BASE_URL } from '@/config/api';
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { Loader2, AlertTriangle, ArrowLeft, Search, Download, RefreshCw, Filter, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationComponent } from "@/components/shared/PaginationComponent";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

const AuditTrail = () => {
    const navigate = useNavigate();
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [actionTypeFilter, setActionTypeFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [logsPerPage] = useState(10); // Number of logs per page
    const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });

    const fetchAuditLogs = useCallback(async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${API_BASE_URL}/audit/read.php`, {
                    // fetch sends cookies by default for same-origin requests
                    // For cross-origin, you might need credentials: 'include'
                });

                if (!response.ok) {
                    let errorMsg = `HTTP error! status: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.message || errorData.error_details_debug || errorMsg;
                    } catch (e) { /* ignore JSON parsing error */ }
                    throw new Error(errorMsg);
                }

                const data = await response.json();
                setAuditLogs(data);
            } catch (err) {
                setError(err.message || 'Failed to fetch audit logs. Please try again later.');
                toast.error("Failed to fetch audit logs", { description: err.message || "Network error or server issue." });
                console.error('Error fetching audit logs:', err);
            } finally {
                setLoading(false);
            }
    }, []); // Empty dependency array means this function is created once

    useEffect(() => {
        fetchAuditLogs();
    }, [fetchAuditLogs]); // Now fetchAuditLogs is a dependency

    const wsRef = useRef(null);

    useEffect(() => {
        // Establish WebSocket connection
        wsRef.current = new WebSocket('ws://192.168.18.6:8080');

        wsRef.current.onopen = () => {
            console.log('WebSocket Connected');
            // Optionally send an identification message or subscribe to specific events
        };

        wsRef.current.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log('WebSocket message received:', message);
            if (message.type === 'notification' && message.payload.event === 'audit_log_updated') {
                toast.info("New audit log entry", { description: "Updating audit trail..." });
                fetchAuditLogs(); // Refetch audit logs when a new one is added
            }
        };

        wsRef.current.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        wsRef.current.onclose = () => {
            console.log('WebSocket Disconnected');
            // Attempt to reconnect after a delay, or notify user
        };

        // Cleanup function: close WebSocket when component unmounts
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [fetchAuditLogs]); // Dependency on fetchAuditLogs to ensure it's up-to-date

    // Filtering logic
    const filteredLogs = auditLogs.filter((log) => {
        const matchesSearch =
            log.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase());

        // For now, all logs are considered 'success' as there's no explicit status in backend
        const matchesStatus = true; // Always true for now

        const matchesActionType = actionTypeFilter === "all" || log.action.toLowerCase().includes(actionTypeFilter.toLowerCase());

        // Date range filter
        const logTimestamp = new Date(log.timestamp);
        const matchesDateRange = (() => {
            if (!dateRange || (!dateRange.from && !dateRange.to)) {
                return true; // No date range selected
            }

            const from = dateRange.from ? startOfDay(dateRange.from) : null;
            const to = dateRange.to ? endOfDay(dateRange.to) : null;

            if (from && to) {
                return isWithinInterval(logTimestamp, { start: from, end: to });
            } else if (from) {
                return logTimestamp >= from;
            } else if (to) {
                return logTimestamp <= to;
            }
            return true; // Should not happen if previous checks are correct
        })();

        return matchesSearch && matchesStatus && matchesActionType && matchesDateRange;
    });

    // Pagination Logic
    const indexOfLastLog = currentPage * logsPerPage;
    const indexOfFirstLog = indexOfLastLog - logsPerPage;
    const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
    const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    // Loading state UI
    if (loading) {
        return (
            <SidebarProvider>
                <AppSidebar />
                <main className="w-full">
                    <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
                    <div className="flex justify-center items-center h-[calc(100vh-theme(space.16))]">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-2">Loading audit logs...</span>
                    </div>
                </main>
            </SidebarProvider>
        );
    }

    // Error state UI
    if (error) {
        return (
            <SidebarProvider>
                <AppSidebar />
                <main className="w-full">
                    <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
                    <div className="p-4 md:p-6">
                        <Button variant="ghost" className="mb-4" onClick={() => navigate("/admin/dashboard")}>
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
                        </Button>
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    </div>
                </main>
            </SidebarProvider>
        );
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="w-full">
                <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
                <div className="container mx-auto p-6 space-y-6">
                        {/* Header */}
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold text-[#1b4b2a]">Audit Trail & Logs</h1>
                                <p className="text-muted-foreground">
                                    Monitor system activities and user actions across the academic advising platform
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                                    <Download className="mr-2 h-4 w-4" />
                                    Export
                        </Button>
                    </div>
                        </div>

                        {/* Filters Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Filter className="h-5 w-5" />
                                    Filters & Search
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-4 md:grid-cols-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            placeholder="Search users, actions, or descriptions..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                    <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Filter by action type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Action Types</SelectItem>
                                            <SelectItem value="create_section">Create Section</SelectItem>
                                            <SelectItem value="update_section">Update Section</SelectItem>
                                            <SelectItem value="delete_section">Delete Section</SelectItem>
                                            <SelectItem value="update_section_status">Update Section Status</SelectItem>
                                            {/* Add other relevant action types from your backend */}
                                        </SelectContent>
                                    </Select>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full bg-transparent justify-start text-left font-normal">
                                                <Calendar className="mr-2 h-4 w-4" />
                                                {dateRange && dateRange.from ? (
                                                    dateRange.to ? (
                                                        `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}`
                                                    ) : (
                                                        format(dateRange.from, "LLL dd, y")
                                                    )
                                                ) : (
                                                    "Pick a date range"
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <ShadcnCalendar
                                                mode="range"
                                                selected={dateRange}
                                                onSelect={(newRange) => {
                                                    // When a single date is selected in range mode, ensure 'to' is also set to 'from'
                                                    if (newRange && newRange.from && !newRange.to) {
                                                        setDateRange({ from: newRange.from, to: newRange.from });
                                                    } else if (newRange && !newRange.from && !newRange.to) {
                                                        // If both from and to are undefined, reset to empty range
                                                        setDateRange({ from: undefined, to: undefined });
                                                    } else {
                                                        setDateRange(newRange);
                                                    }
                                                }}
                                                numberOfMonths={2}
                                            />
                                            <div className="p-4 border-t flex justify-end">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setDateRange({ from: undefined, to: undefined })}
                                                >
                                                    Clear Date Range
                                                </Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Audit Logs Table */}
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="font-semibold">Timestamp</TableHead>
                                            <TableHead className="font-semibold">User ID</TableHead>
                                            <TableHead className="font-semibold">Action Type</TableHead>
                                            <TableHead className="font-semibold">Description</TableHead>
                                            <TableHead className="font-semibold">Entity Type</TableHead>
                                            <TableHead className="font-semibold">Entity ID</TableHead>
                                            <TableHead className="font-semibold">Old Values</TableHead>
                                            <TableHead className="font-semibold">New Values</TableHead>
                                            <TableHead className="font-semibold">IP Address</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentLogs.length > 0 ? (
                                            currentLogs.map((log, index) => (
                                                <TableRow key={log.id} className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                                    <TableCell className="text-sm font-mono">{new Date(log.timestamp).toLocaleString()}</TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">{log.user_id}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="default" className="text-xs">
                                                            {log.action}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="max-w-md">
                                                        <p className="text-sm text-foreground text-pretty">{log.description}</p>
                                                    </TableCell>
                                                    <TableCell>{log.entity_type}</TableCell>
                                                    <TableCell>{log.entity_id}</TableCell>
                                                    <TableCell className="max-w-xs overflow-auto"><pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded max-h-24 overflow-auto">{log.old_values || 'N/A'}</pre></TableCell>
                                                    <TableCell className="max-w-xs overflow-auto"><pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded max-h-24 overflow-auto">{log.new_values || 'N/A'}</pre></TableCell>
                                                    <TableCell className="font-mono text-sm text-muted-foreground">{log.ip_address}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                                    No audit trail records found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Pagination component */}
                        <PaginationComponent
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                        />
                </div>
            </main>
            <Toaster />
        </SidebarProvider>
    );
};

export default AuditTrail;
