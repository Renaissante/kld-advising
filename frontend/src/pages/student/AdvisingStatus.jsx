import React, { useState, useEffect, useCallback, useMemo } from "react"
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Hourglass, FileText, ArrowRightCircle, CircleDotDashed, CircleCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from '@/config/api';
import { useActive } from "@/contexts/ActiveContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function AdvisingStatus() {
  const { user } = useAuth();
  const { activeAcademicYear, activeSemester, loading: activeLoading } = useActive();

  const [advisingStatusData, setAdvisingStatusData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const isOverallLoading = isLoading || activeLoading;

  const fetchAdvisingStatus = useCallback(async () => {
    if (!user?.id || activeLoading || !activeAcademicYear?.id || !activeSemester?.id) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/student/get_curriculum.php?student_id=${user.id}&active_academic_year_id=${activeAcademicYear.id}&active_semester_id=${activeSemester.id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data.message) {
        setError(data.message);
        setAdvisingStatusData(null);
        return;
      }
      setAdvisingStatusData(data);
    } catch (err) {
      console.error("Error fetching advising status:", err);
      setError(err.message || "Failed to load advising status.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, activeLoading, activeAcademicYear?.id, activeSemester?.id]);

  useEffect(() => {
    fetchAdvisingStatus();
  }, [fetchAdvisingStatus]);

  const advisingProgress = useMemo(() => {
    let gradesSubmittedStatus = "pending";
    let advisorApprovalStatus = "pending";
    let advisingFormReleasedStatus = "pending";

    // Assume grades are submitted if there's an advising request (pending or approved)
    if (advisingStatusData?.has_pending_advising_request || advisingStatusData?.has_approved_advising_request) {
      gradesSubmittedStatus = "completed";
    }

    if (advisingStatusData?.has_approved_advising_request) {
      advisorApprovalStatus = "completed";
      advisingFormReleasedStatus = "completed"; // If approved, form is considered released
    } else if (advisingStatusData?.has_pending_advising_request) {
      advisorApprovalStatus = "in_progress";
    }

    return [
      {
        id: 1,
        stage: "Grades Submitted",
        description: "Your current semester grades have been submitted.",
        status: gradesSubmittedStatus,
        date: null, // This would ideally come from the backend
        icon: CircleCheck,
        badgeText: gradesSubmittedStatus === "completed" ? "Complete" : "Pending",
        bgColor: gradesSubmittedStatus === "completed" ? "bg-green-50/50 dark:bg-green-900/20" : "bg-gray-50/50 dark:bg-gray-800/20",
        iconColor: gradesSubmittedStatus === "completed" ? "text-green-500" : "text-gray-500",
      },
      {
        id: 2,
        stage: "Waiting for Advisor Approval",
        description: "Your advising form is awaiting review and approval from your advisor.",
        status: advisorApprovalStatus,
        date: null,
        icon: advisorApprovalStatus === "in_progress" ? ArrowRightCircle : advisorApprovalStatus === "completed" ? CheckCircle2 : CircleDotDashed,
        badgeText: advisorApprovalStatus === "completed" ? "Approved" : advisorApprovalStatus === "in_progress" ? "In Progress" : "Pending",
        bgColor: advisorApprovalStatus === "completed" ? "bg-green-50/50 dark:bg-green-900/20" : advisorApprovalStatus === "in_progress" ? "bg-blue-50/50 dark:bg-blue-900/20" : "bg-gray-50/50 dark:bg-gray-800/20",
        iconColor: advisorApprovalStatus === "completed" ? "text-green-500" : advisorApprovalStatus === "in_progress" ? "text-blue-500" : "text-gray-500",
      },
      {
        id: 3,
        stage: "Advising Form Released",
        description: "Your advising form will be released for enrollment after approval.",
        status: advisingFormReleasedStatus,
        date: null,
        icon: advisingFormReleasedStatus === "completed" ? FileText : CircleDotDashed,
        badgeText: advisingFormReleasedStatus === "completed" ? "Released" : "Pending",
        bgColor: advisingFormReleasedStatus === "completed" ? "bg-green-50/50 dark:bg-green-900/20" : "bg-gray-50/50 dark:bg-gray-800/20",
        iconColor: advisingFormReleasedStatus === "completed" ? "text-green-500" : "text-gray-500",
      },
    ];
  }, [advisingStatusData]);

  const completedStages = advisingProgress.filter(item => item.status === "completed").length;
  const totalStages = advisingProgress.length;
  const overallProgress = Math.round((completedStages / totalStages) * 100);

  if (!user) return null;

  if (isOverallLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="w-full">
          <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
          <div className="container mx-auto p-4 md:p-6 mt-4">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-center h-48 border rounded-lg bg-muted/50">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-lg text-muted-foreground">Loading advising status...</span>
              </div>
            </div>
          </div>
        </main>
      </SidebarProvider>
    );
  }

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="w-full">
          <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
          <div className="container mx-auto p-4 md:p-6 mt-4">
            <div className="flex flex-col gap-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </main>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <Toaster richColors position="bottom-right" />
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        <div className="container mx-auto p-4 md:p-6 mt-4">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Advising Progress</h1>
              <p className="text-muted-foreground">
                Track the status of your grade submission and approval process.
              </p>
            </div>

            <div className="relative space-y-6 max-w-2xl">
              {advisingProgress.map((item, index) => (
                <div key={item.id} className="flex items-start">
                  <div className="flex flex-col items-center mr-4 self-stretch">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center z-10 mb-2 flex-shrink-0", item.iconColor, {
                      "bg-green-100 dark:bg-green-900": item.status === "completed",
                      "bg-blue-100 dark:bg-blue-900": item.status === "in_progress",
                      "bg-gray-100 dark:bg-gray-700": item.status === "pending",
                    })}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    {index < advisingProgress.length - 1 && (
                      <div className={cn("w-0.5 h-full", {
                        "bg-green-300 dark:bg-green-700": item.status === "completed",
                        "bg-blue-300 dark:bg-blue-700": item.status === "in_progress",
                        "bg-gray-300 dark:bg-gray-600": item.status === "pending",
                      })}></div>
                    )}
                  </div>
                  <Card className={cn("flex-1", item.bgColor, {
                    "border-green-200 dark:border-green-800": item.status === "completed",
                    "border-blue-200 dark:border-blue-800": item.status === "in_progress",
                    "border-gray-200 dark:border-gray-800": item.status === "pending",
                  })}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold">{item.stage}</CardTitle>
                        <Badge variant={item.status === "completed" ? "default" : item.status === "in_progress" ? "outline" : "secondary"}>
                          {item.badgeText}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1">{item.description}</CardDescription>
                      {item.date && (
                        <p className="text-xs text-muted-foreground mt-2">{item.date}</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>

            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold mb-2">Overall Progress</h2>
              <Progress value={overallProgress} className="w-full" fillColor={overallProgress === 100 ? "bg-green-500" : "bg-black"} />
              <p className="text-right text-sm text-muted-foreground mt-1">{overallProgress}%</p>
            </div>

            <div className="flex justify-start max-w-2xl">
              <Button disabled={advisingProgress.find(item => item.stage === "Advising Form Released")?.status !== "completed"}>
                <FileText className="h-4 w-4 mr-2" /> View Advising Form
              </Button>
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}
