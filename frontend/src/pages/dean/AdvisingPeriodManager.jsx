"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Calendar, Power, Clock, CheckCircle, XCircle, AlertCircle, CheckCircle2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/App-sidebar"
import Header from "@/components/layout/Header"
import { DatePicker } from "@/components/shared/DatePicker" // Import the custom DatePicker component
import { useActive } from '@/contexts/ActiveContext'; // Import useActive context
import { API_BASE_URL } from '@/config/api'; // Import API_BASE_URL
import { format } from 'date-fns'; // Import format from date-fns
import { toast } from "sonner"; // Import toast
import {
  AlertDialog, // Import AlertDialog components
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdvisingPeriodManager() {
  const [isAdvisingActive, setIsAdvisingActive] = useState(true)
  const [startDate, setStartDate] = useState("") // Initialize as empty string
  const [endDate, setEndDate] = useState("")   // Initialize as empty string
  const [isSaving, setIsSaving] = useState(false)
  const [advisingPeriodId, setAdvisingPeriodId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState(0);

  const { activeAcademicYear, activeSemester, loading: activeContextLoading, refreshAdvisingStatus } = useActive(); // Destructure refreshAdvisingStatus
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket("ws://192.168.18.6:8080"); // Replace with your WebSocket server address

    ws.current.onopen = () => {
      console.log("WebSocket connection established");
    };

    ws.current.onmessage = (event) => {
      // We don't expect to receive messages here, but good to have a handler
      console.log("WebSocket message received:", event.data);
    };

    ws.current.onclose = () => {
      console.log("WebSocket connection closed");
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.current.close();
    };
  }, []);

  // Function to fetch advising period data
  const fetchAdvisingPeriod = useCallback(async () => {
    if (activeAcademicYear && activeSemester) {
      setLoading(true);
      setError(null);
      try {
        console.log("Fetching advising period for:", { academicYearId: activeAcademicYear.id, semesterId: activeSemester.id });
        const response = await fetch(`${API_BASE_URL}/advising_period/read_single.php?academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}`);
        if (!response.ok) {
          if (response.status === 404) {
            // No advising period found, can proceed to create
            setAdvisingPeriodId(null);
            setIsAdvisingActive(false);
            setStartDate("");
            setEndDate("");
            setDaysRemaining(0);
          } else {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        } else {
          const data = await response.json();
          setAdvisingPeriodId(data.id);
          setIsAdvisingActive(data.status === 'active');
          setStartDate(data.start_date);
          setEndDate(data.end_date);

          // Calculate days remaining
          const end = new Date(data.end_date);
          const now = new Date();
          const diffTime = end.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          setDaysRemaining(diffDays > 0 ? diffDays : 0);
        }
      } catch (e) {
        setError("Failed to fetch advising period: " + e.message);
        console.error("Error fetching advising period:", e);
      } finally {
        setLoading(false);
      }
    } else if (!activeContextLoading) {
      // If active context is loaded but no active year/semester, set loading to false
      setLoading(false);
    }
  }, [activeAcademicYear, activeSemester, activeContextLoading]);

  useEffect(() => {
    if (!activeContextLoading) {
      fetchAdvisingPeriod();
    }
  }, [activeContextLoading, fetchAdvisingPeriod]);

  const handleCreateAdvisingPeriod = async () => {
    if (!activeAcademicYear || !activeSemester || !startDate || !endDate) {
      alert("Please select both start and end dates for the new advising period.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const formattedStartDate = format(new Date(startDate), 'yyyy-MM-dd');
      const formattedEndDate = format(new Date(endDate), 'yyyy-MM-dd');
      console.log("Creating advising period with:", { academicYearId: activeAcademicYear.id, semesterId: activeSemester.id, startDate: formattedStartDate, endDate: formattedEndDate });
      const response = await fetch(`${API_BASE_URL}/advising_period/create.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          academic_year_id: activeAcademicYear.id,
          semester_id: activeSemester.id,
          start_date: formattedStartDate,
          end_date: formattedEndDate,
          status: 'inactive' // New period starts inactive
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to create advising period.");
      }
      toast.success("Advising period created successfully! It is currently inactive.");
      fetchAdvisingPeriod(); // Re-fetch to update UI
    } catch (e) {
      setError("Error creating advising period: " + e.message);
      console.error("Error creating advising period:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAdvising = async () => {
    if (!advisingPeriodId) {
      alert("No advising period found to activate/deactivate. Please create one first.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const newStatus = isAdvisingActive ? 'inactive' : 'active';
      console.log("Toggling advising status with:", { advisingPeriodId, academicYearId: activeAcademicYear.id, semesterId: activeSemester.id, newStatus });
      const response = await fetch(`${API_BASE_URL}/advising_period/update_status.php`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: advisingPeriodId, // Include ID
          academic_year_id: activeAcademicYear.id,
          semester_id: activeSemester.id,
          status: newStatus
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to update advising system status.");
      }
      toast.success(`Advising system ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully.`);
      fetchAdvisingPeriod(); // Re-fetch to update UI
      refreshAdvisingStatus(); // Refresh global advising status

      // Send WebSocket notification
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: "backend_event", // Use backend_event for dean actions
          payload: {
            event: "advising_period_updated",
            data: {
              action_type: newStatus === 'active' ? 'Activated' : 'Deactivated',
              academic_year: activeAcademicYear?.year,
              semester: activeSemester?.name,
            },
          },
        }));
      }
    } catch (e) {
      setError("Error updating advising system status: " + e.message);
      console.error("Error updating advising system status:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePeriod = async () => {
    if (!advisingPeriodId) {
      alert("No advising period found to update dates for. Please create one first.");
      return;
    }
    if (!startDate || !endDate) {
      alert("Please select both start and end dates.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const formattedStartDate = format(new Date(startDate), 'yyyy-MM-dd');
      const formattedEndDate = format(new Date(endDate), 'yyyy-MM-dd');
      console.log("Saving advising period dates with:", { advisingPeriodId, academicYearId: activeAcademicYear.id, semesterId: activeSemester.id, startDate: formattedStartDate, endDate: formattedEndDate });
      const response = await fetch(`${API_BASE_URL}/advising_period/update_dates.php`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: advisingPeriodId, // Include ID
          academic_year_id: activeAcademicYear.id,
          semester_id: activeSemester.id,
          start_date: formattedStartDate,
          end_date: formattedEndDate
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to update advising period dates.");
      }
      toast.success("Advising period dates updated successfully!");
      fetchAdvisingPeriod(); // Re-fetch to update UI

      // Send WebSocket notification for date update
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: "backend_event", // Use backend_event for dean actions
          payload: {
            event: "advising_period_updated",
            data: {
              action_type: "Updated Dates",
              academic_year: activeAcademicYear?.year,
              semester: activeSemester?.name,
            },
          },
        }));
      }
    } catch (e) {
      setError("Error updating advising period dates: " + e.message);
      console.error("Error updating advising period dates:", e);
    } finally {
      setIsSaving(false);
    }
  };

  if (activeContextLoading || loading) {
    return <div className="flex justify-center items-center h-screen text-xl">Loading advising period data...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-xl text-red-500">Error: {error}</div>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        
        <div className="container mx-auto p-4 md:p-6 mt-4 dark:bg-gray-950">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Advising System Management</h1>
              <p className="text-muted-foreground">Configure and control the academic advising system</p>
            </div>

            {/* Status Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">System Status</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{isAdvisingActive ? "Active" : "Inactive"}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${isAdvisingActive ? "bg-green-50 dark:bg-emerald-900/30" : "bg-gray-100 dark:bg-gray-700"}`}>
                      {isAdvisingActive ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Current Period</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                        {activeAcademicYear?.year} {activeSemester?.name}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                      <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Days Remaining</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{daysRemaining}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/30">
                      <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* System Control Card */}
              <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50">System Control</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Enable or disable the advising system for all users
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!advisingPeriodId && (
                    <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/30 dark:border-yellow-700">
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-900 dark:text-yellow-50">No Advising Period Set</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Please define the advising period start and end dates below before activating the system.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 dark:bg-gray-900 dark:border-gray-600">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isAdvisingActive ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-200 dark:bg-gray-600"}`}>
                        <Power className={`w-5 h-5 ${isAdvisingActive ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-50">Advising System</p>
                        <p className="text-sm text-muted-foreground">
                          {isAdvisingActive ? "Currently accepting advising requests" : "System is currently disabled"}
                        </p>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Switch className="bg-gray-600 dark:bg-gray-200" checked={isAdvisingActive} disabled={isSaving || !advisingPeriodId} />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Advising System {isAdvisingActive ? 'Deactivation' : 'Activation'}</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to {isAdvisingActive ? 'deactivate' : 'activate'} the advising system?
                            This will {isAdvisingActive ? 'prevent' : 'allow'} students and advisors from accessing the advising features.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleToggleAdvising}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {!isAdvisingActive && advisingPeriodId && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/30 dark:border-red-700">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-900 dark:text-red-50">System Disabled</p>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          Students and advisors cannot access the advising system. Enable it to resume operations.
                        </p>
                      </div>
                    </div>
                  )}

                  {isAdvisingActive && advisingPeriodId && (
                    <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/30 dark:border-green-700">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-50">System Enabled</p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          Students and advisors can access the advising system. disable it to stop operations.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Advising Period Card */}
              <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50">Official Advising Period</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Set the start and end dates for the advising period
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Start Date
                      </Label>
                      <DatePicker
                        id="start-date"
                        value={startDate}
                        onChange={setStartDate}
                        className="border-gray-300 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        End Date
                      </Label>
                      <DatePicker
                        id="end-date"
                        value={endDate}
                        onChange={setEndDate}
                        className="border-gray-300 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-50"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/30 dark:border-blue-700">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
    <div>
                        <p className="font-medium text-blue-900 dark:text-blue-50">Current Period</p>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          {startDate && endDate ? 
                            `${new Date(startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} - ${new Date(endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                            : "N/A"
                          }
                        </p>
                      </div>
                    </div>
    </div>

                  {!advisingPeriodId ? (
                    <Button
                      variant="green"
                      onClick={handleCreateAdvisingPeriod}
                      disabled={isSaving || !startDate || !endDate}
                      className="w-full"
                    >
                      {isSaving ? "Creating..." : "Create Advising Period"}
                    </Button>
                  ) : (
                    <Button
                      variant="green"
                      onClick={handleSavePeriod}
                      disabled={isSaving || !startDate || !endDate}
                      className="w-full"
                    >
                      {isSaving ? "Saving..." : "Save Advising Period"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}
