import React, { useEffect, useRef, useState } from 'react';
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart as BarChartIcon, Users, BookOpen, ListTodo, GraduationCap, TrendingUp, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { useActive } from "@/contexts/ActiveContext";
import { API_BASE_URL } from "@/config/api";
import { Progress } from "@/components/ui/progress";

const defaultSummaryState = {
  totalSubjects: 0,
  totalAdvisees: 0,
  gradedCount: 0,
  pendingGradesCount: 0,
  advisedCount: 0,
  pendingAdvisingCount: 0,
};

const useHoverPopover = () => {
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef(null);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return { open, handleMouseEnter, handleMouseLeave };
};

const Dashboard = () => {
  const { user } = useAuth();
  const { activeAcademicYear, activeSemester, loading: activeContextLoading } = useActive();

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [activeView, setActiveView] = useState('all');
  const [summaryData, setSummaryData] = useState(defaultSummaryState);
  const [gradesData, setGradesData] = useState([]);
  const [advisingProgressData, setAdvisingProgressData] = useState([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(null);
  const subjectsPopover = useHoverPopover();
  const adviseesPopover = useHoverPopover();
  const overallPopover = useHoverPopover();

  useEffect(() => {
    if (activeContextLoading) return;
    if (!user?.id || !activeAcademicYear?.id || !activeSemester?.id) {
      setIsDashboardLoading(false);
      return;
    }

    const controller = new AbortController();
    const fetchDashboardData = async () => {
      setIsDashboardLoading(true);
      setDashboardError(null);
      try {
        const params = new URLSearchParams({
          faculty_id: user.id,
          academic_year_id: activeAcademicYear.id,
          semester_id: activeSemester.id,
        });
        const response = await fetch(`${API_BASE_URL}/faculty/get_dashboard_data.php?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorMessage = `Failed to load dashboard data (HTTP ${response.status})`;
          try {
            const errorBody = await response.json();
            errorMessage = errorBody.message || errorMessage;
          } catch (_) {
            // ignore non-JSON error bodies
          }
          throw new Error(errorMessage);
        }

        const payload = await response.json();
        if (!payload.success) {
          throw new Error(payload.message || "Failed to fetch dashboard data.");
        }

        const data = payload.data || {};
        setSummaryData({ ...defaultSummaryState, ...(data.summary || {}) });
        setGradesData(Array.isArray(data.grades) ? data.grades : []);
        setAdvisingProgressData(Array.isArray(data.advising) ? data.advising : []);
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error("Error fetching faculty dashboard data:", error);
        setDashboardError(error.message || "Failed to load dashboard information.");
        setSummaryData(defaultSummaryState);
        setGradesData([]);
        setAdvisingProgressData([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsDashboardLoading(false);
        }
      }
    };

    fetchDashboardData();
    return () => controller.abort();
  }, [user?.id, activeAcademicYear?.id, activeSemester?.id, activeContextLoading]);

  useEffect(() => {
    if (selectedSubject && !gradesData.some((data) => data.subject === selectedSubject)) {
      setSelectedSubject(null);
      setActiveView('all');
    }
  }, [gradesData, selectedSubject]);

  useEffect(() => {
    if (selectedSection && !advisingProgressData.some((data) => data.section === selectedSection)) {
      setSelectedSection(null);
      setActiveView('all');
    }
  }, [advisingProgressData, selectedSection]);

  // Calculate combined progression
  const totalGradesTasks = summaryData.gradedCount + summaryData.pendingGradesCount;
  const totalAdvisingTasks = summaryData.advisedCount + summaryData.pendingAdvisingCount;
  const overallCompleted = summaryData.gradedCount + summaryData.advisedCount;
  const overallTotal = totalGradesTasks + totalAdvisingTasks;
  const combinedProgress = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

  // Filtered grades data based on selectedSubject
  const filteredGradesData = selectedSubject
    ? gradesData.filter(data => data.subject === selectedSubject)
    : gradesData;

  // Filtered advising data based on selectedSection
  const filteredAdvisingData = selectedSection
    ? advisingProgressData.filter(data => data.section === selectedSection)
    : advisingProgressData;

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        <div className="container mx-auto p-4 md:p-6 mt-4 dark:bg-gray-950">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Faculty Dashboard</h1>
              <p className="text-muted-foreground mt-1">A consolidated view of your grading and advising responsibilities.</p>
            </div>

            {isDashboardLoading && (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading dashboard metrics...</span>
              </div>
            )}

            {dashboardError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {dashboardError}
              </div>
            )}

            {/* Summary Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Total Subjects Taught Card */}
              <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Subjects Taught</p>
                      <Popover open={subjectsPopover.open}>
                        <PopoverTrigger
                          asChild
                          onMouseEnter={subjectsPopover.handleMouseEnter}
                          onMouseLeave={subjectsPopover.handleMouseLeave}
                        >
                          <Button variant="ghost" className="cursor-pointer w-full justify-start text-left p-0 h-auto">
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">{summaryData.totalSubjects}</div>
                            <p className="text-xs text-muted-foreground mt-1">Total courses assigned</p>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[340px] max-h-60 overflow-y-auto p-4 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-lg rounded-lg"
                          align="start"
                          sideOffset={12}
                          onMouseEnter={subjectsPopover.handleMouseEnter}
                          onMouseLeave={subjectsPopover.handleMouseLeave}
                        >
                          <h4 className="font-bold mb-1">Subjects:</h4>
                          <div className="space-y-1">
                            {gradesData.length === 0 && (
                              <p className="text-muted-foreground text-xs px-2 py-1">No subjects found.</p>
                            )}
                            {gradesData.map((data) => (
                              <Button
                                key={data.course_id}
                                variant="ghost"
                                className="w-full justify-start h-auto px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                                onClick={() => {
                                  setSelectedSubject(data.subject);
                                  setActiveView('grades'); // Set activeView to grades
                                }}
                              >
                                {data.course_code || data.subject} {data.course_title ? `- ${data.course_title}` : ''}
                              </Button>
                            ))}
                            {selectedSubject && (
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-auto px-3 py-2 text-left text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-normal leading-snug"
                                onClick={() => {
                                  setSelectedSubject(null);
                                  setActiveView('all'); // Set activeView to all
                                }}
                              >
                                Show All Subjects
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-emerald-900/30">
                      <BookOpen className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total Advisees Card */}
              <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Advisees</p>
                      <Popover open={adviseesPopover.open}>
                        <PopoverTrigger
                          asChild
                          onMouseEnter={adviseesPopover.handleMouseEnter}
                          onMouseLeave={adviseesPopover.handleMouseLeave}
                        >
                          <Button variant="ghost" className="cursor-pointer w-full justify-start text-left p-0 h-auto">
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">{summaryData.totalAdvisees}</div>
                            <p className="text-xs text-muted-foreground mt-1">Students under your advisement</p>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-64 max-h-60 overflow-y-auto p-4 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-lg rounded-lg"
                          align="center"
                          sideOffset={10}
                          onMouseEnter={adviseesPopover.handleMouseEnter}
                          onMouseLeave={adviseesPopover.handleMouseLeave}
                        >
                          <h4 className="font-bold mb-1">Sections:</h4>
                          <div className="space-y-1">
                            {advisingProgressData.length === 0 && (
                              <p className="text-muted-foreground text-xs px-2 py-1">No sections found.</p>
                            )}
                            {advisingProgressData.map((data) => (
                              <Button
                                key={data.section_id}
                                variant="ghost"
                                className="w-full justify-start h-auto px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                                onClick={() => {
                                  setSelectedSection(data.section);
                                  setActiveView('advising'); // Set activeView to advising
                                }}
                              >
                                {data.section}
                              </Button>
                            ))}
                            {selectedSection && (
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-auto px-3 py-2 text-left text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-normal leading-snug"
                                onClick={() => {
                                  setSelectedSection(null);
                                  setActiveView('all'); // Set activeView to all
                                }}
                              >
                                Show All Sections
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-emerald-900/30">
                      <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Overall Task Progress Card */}
              <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Overall Task Progress</p>
                      <Popover open={overallPopover.open}>
                        <PopoverTrigger
                          asChild
                          onMouseEnter={overallPopover.handleMouseEnter}
                          onMouseLeave={overallPopover.handleMouseLeave}
                        >
                          <Button variant="ghost" className="cursor-pointer w-full justify-start text-left p-0 h-auto">
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">{combinedProgress}%</div>
                            <p className="text-xs text-muted-foreground mt-1">Combined grades & advising progress</p>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-72 p-4 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-lg rounded-lg"
                          align="center"
                          sideOffset={10}
                          onMouseEnter={overallPopover.handleMouseEnter}
                          onMouseLeave={overallPopover.handleMouseLeave}
                        >
                          <h4 className="font-bold mb-1">Overall Progress Details:</h4>
                          <div className="space-y-1">
                            <Button
                              variant={activeView === 'grades' ? 'secondary' : 'ghost'}
                              className="w-full justify-start h-auto px-3 py-2 text-left whitespace-normal leading-snug hover:bg-gray-100 dark:hover:bg-gray-800"
                              onClick={() => setActiveView('grades')}
                            >
                              Show Grades ({summaryData.gradedCount} Graded, {summaryData.pendingGradesCount} Pending)
                            </Button>
                            <Button
                              variant={activeView === 'advising' ? 'secondary' : 'ghost'}
                              className="w-full justify-start h-auto px-2 py-1 text-left whitespace-normal leading-snug"
                              onClick={() => setActiveView('advising')}
                            >
                              Show Advising ({summaryData.advisedCount} Advised, {summaryData.pendingAdvisingCount} Pending)
                            </Button>
                            <Button
                              variant={activeView === 'all' ? 'secondary' : 'ghost'}
                              className="w-full justify-start h-auto px-2 py-1 text-left text-blue-600 dark:text-blue-400 whitespace-normal leading-snug"
                              onClick={() => setActiveView('all')}
                            >
                              Show All
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Progress value={combinedProgress} fillColor="bg-blue-500" className="mt-4 h-2" />
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-emerald-900/30">
                      <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Conditionally rendered Grades Analytics Bar Graph Card - FIRST */}
              {(activeView === 'all' || activeView === 'grades') && (
                <Card className={`hover:shadow-lg transition-shadow duration-300 ${activeView !== 'all' ? 'col-span-full' : ''}`}>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                      <ListTodo className="h-6 w-6 text-[#1b4b2a]" /> Grades Progress by Subject {selectedSubject && `(${selectedSubject})`}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground mt-1">Visual comparison of graded and pending student counts for your subjects.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredGradesData.length > 0 ? (
                      <ChartContainer
                        config={{
                          graded: { label: "Graded", color: "#10B981" },
                          pendingGrades: { label: "Pending", color: "#EF4444" },
                        }}
                        className="min-h-[250px] w-full"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={filteredGradesData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="subject" textAnchor="middle" height={100} fontSize={12} />
                            <YAxis type="number" tickLine={false} axisLine={false} />
                            <Tooltip content={<ChartTooltipContent />}>

                            </Tooltip>
                            <Legend wrapperStyle={{ paddingTop: 8, paddingBottom: 4 }} />
                            <Bar dataKey="graded" fill="#10B981" radius={0} name="Graded" stackId="a" />
                            <Bar dataKey="pendingGrades" fill="#EF4444" radius={0} name="Pending" stackId="a" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">No grade data available for the selected filters.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Conditionally rendered Advising Progress Bar Graph Card - SECOND */}
              {(activeView === 'all' || activeView === 'advising') && (
                <Card className={`hover:shadow-lg transition-shadow duration-300 ${activeView !== 'all' ? 'col-span-full' : ''}`}>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                      <GraduationCap className="h-6 w-6 text-[#1b4b2a]" /> Advising Progress by Section {selectedSection && `(${selectedSection})`}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground mt-1">Visual representation of advised and pending students per section.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredAdvisingData.length > 0 ? (
                      <ChartContainer
                        config={{
                          advised_students: { label: "Advised", color: "#008000" },
                          pending_students: { label: "Pending", color: "#FF0000" },
                        }}
                        className="min-h-[250px] w-full"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={filteredAdvisingData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <YAxis dataKey="section" type="category" tickLine={false} axisLine={false} width={80} fontSize={12} />
                            <XAxis type="number" tickLine={false} axisLine={false} />
                            <Tooltip content={<ChartTooltipContent />}>

                            </Tooltip>
                            <Legend wrapperStyle={{ paddingTop: 8, paddingBottom: 4 }} />
                            <Bar dataKey="advised_students" fill="#008000" stackId="a" name="Advised" />
                            <Bar dataKey="pending_students" fill="#FF0000" stackId="a" name="Pending" opacity={0.7} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">No advising data available for the selected filters.</p>
                    )}
                  </CardContent>
                </Card>
              )}

            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default Dashboard;

