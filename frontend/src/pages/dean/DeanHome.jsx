import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";
import { API_BASE_URL } from '@/config/api';
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { PaginationComponent } from "@/components/shared/PaginationComponent" // Import PaginationComponent
import {
  Users,
  GraduationCap,
  CheckCircle,
  BookOpen,
  TrendingUp,
  Filter,
  User,
  FileText,
  Eye,
} from "lucide-react"
import { useActive } from '@/contexts/ActiveContext';

const DeanHome = () => {
  const [dashboardData, setDashboardData] = useState({
    academicYears: [],
    semesters: [],
    programs: [],
    overallStats: {
      advisingCompletionRate: 0,
      gradingCompletionRate: 0,
      totalStudentsAdvised: 0,
      totalCoursesGraded: 0,
      totalActiveStudents: 0,
    },
    recentActivity: [],
    sectionData: [],
    programPerformance: [],
    advisingStatusBreakdown: [],
    gradingStatusBreakdown: [],
    advisingStatusByYear: [],
    gradingStatusByYear: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedYear, setSelectedYear] = useState("")
  const [selectedSemester, setSelectedSemester] = useState("")
  const [selectedProgram, setSelectedProgram] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState("section")
  const [sortDirection, setSortDirection] = useState("asc")
  const [currentPage, setCurrentPage] = useState(1) // New state for current page
  const sectionsPerPage = 8 // New constant for sections per page
  const RECENT_ACTIVITY_LIMIT = 3; // Limit recent activities to 5

  const { activeAcademicYear, activeSemester, loading: activeContextLoading } = useActive();

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append('academic_year', selectedYear);
      if (selectedSemester) params.append('semester_name', selectedSemester);
      if (selectedProgram) params.append('program_name', selectedProgram);

      const response = await fetch(`${API_BASE_URL}/dean/read_dashboard_data.php?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setDashboardData(data)

      // Set initial selected year and semester based on active context, if available

    } catch (e) {
      setError("Failed to fetch dashboard data.")
      console.error("Error fetching dashboard data:", e)
    } finally {
      setLoading(false)
    }
  }, [selectedYear, selectedSemester, selectedProgram])

  useEffect(() => {
    if (!activeContextLoading) {
      fetchDashboardData();
    }
  }, [fetchDashboardData, activeAcademicYear, activeSemester, activeContextLoading]);

  // New useEffect to set initial selected year and semester based on active context or fetched data
  useEffect(() => {
    if (!activeContextLoading && dashboardData.academicYears.length > 0 && dashboardData.semesters.length > 0) {
      if (activeAcademicYear && !selectedYear) {
        setSelectedYear(activeAcademicYear.year);
      }
      if (activeSemester && !selectedSemester) {
        setSelectedSemester(activeSemester.name);
      }
    }
  }, [activeContextLoading, activeAcademicYear, activeSemester, dashboardData.academicYears, dashboardData.semesters, selectedYear, selectedSemester]);

  // Trigger data fetch when filters change
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, selectedYear, selectedSemester, selectedProgram]);

  // Filter and sort section data
  const filteredSections = dashboardData.sectionData.filter(
    (section) => {
      return (
        section.section.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (selectedProgram === "all" || section.program === selectedProgram) &&
        (selectedYear === "" || section.academicYear === selectedYear) &&
        (selectedSemester === "" || section.semester === selectedSemester)
      );
    }
  );

  const filteredAndSortedSectionData = filteredSections.sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

  // Pagination logic
  const indexOfLastSection = currentPage * sectionsPerPage
  const indexOfFirstSection = indexOfLastSection - sectionsPerPage
  const currentSections = filteredAndSortedSectionData.slice(indexOfFirstSection, indexOfLastSection)
  const totalPages = Math.ceil(filteredAndSortedSectionData.length / sectionsPerPage)

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
    setCurrentPage(1) // Reset to first page on sort change
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen text-xl">Loading dashboard data...</div>
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-xl text-red-500">Error: {error}</div>
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        
        <div className="container mx-auto p-4 md:p-6 mt-4">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col">
              <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Dean's Academic Progress Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Monitor advising and grading completion across all programs and sections
              </p>
            </div>

         
 
            {/* Metrics Cards - 4 Equal Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Students Enrolled Card */}
              <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Students Enrolled</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{dashboardData.overallStats.totalActiveStudents.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">Total active students</p>
                    </div>
                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/30">
                      <BookOpen className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Students Advised Card */}
              <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Students Advised</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                        {dashboardData.overallStats.totalStudentsAdvised.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        of {dashboardData.overallStats.totalActiveStudents.toLocaleString()} total students
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/30">
                      <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Advising Completion Card */}
              <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Advising Completion</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{dashboardData.overallStats.advisingCompletionRate}%</p>
                      <Progress value={dashboardData.overallStats.advisingCompletionRate} className="mt-2" />
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedYear} • {selectedSemester}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Grading Completion Card */}
              <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Grading Completion</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{dashboardData.overallStats.gradingCompletionRate}%</p>
                      <Progress value={dashboardData.overallStats.gradingCompletionRate} className="mt-2" />
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedYear} • {selectedSemester}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                      <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters - Full Width */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Academic Year</label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-40 h-9"> {/* Added h-9 */}
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboardData.academicYears.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Semester</label>
                    <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                      <SelectTrigger className="w-40 h-9"> {/* Added h-9 */}
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboardData.semesters.map((semester) => (
                          <SelectItem key={semester} value={semester}>
                            {semester}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Program</label>
                    <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                      <SelectTrigger className="w-48 h-9"> {/* Added h-9 */}
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Programs</SelectItem>
                        {dashboardData.programs.map((program) => (
                          <SelectItem key={program.id} value={program.name}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main Content Area - Left Large, Right Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content Area - 3 columns */}
              <div className="lg:col-span-2">
                <Tabs defaultValue="sections" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-3 bg-muted/60 dark:bg-muted/30"> {/* Changed to 3 columns */}
                    <TabsTrigger value="sections">Section Details</TabsTrigger>
                    <TabsTrigger value="programs">Program Performance</TabsTrigger>
                    <TabsTrigger value="status">Student Status</TabsTrigger>
                  </TabsList>

                  {/* Section Details Tab */}
                  <TabsContent value="sections" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Advising & Grading Completion by Section</CardTitle>
                        <CardDescription>
                          Detailed view of completion rates for each section in {selectedSemester}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 h-[655px] overflow-y-auto"> {/* Adjusted height for alignment */}
                        <div className="flex gap-4">
                          <Input
                            placeholder="Search sections..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm h-9"
                          />
                        </div>

                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => handleSort("section")}
                                >
                                  Section Name {sortField === "section" && (sortDirection === "asc" ? "↑" : "↓")}
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => handleSort("program")}
                                >
                                  Program {sortField === "program" && (sortDirection === "asc" ? "↑" : "↓")}
                                </TableHead>
                                <TableHead>Year Level</TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => handleSort("advisingCompletion")}
                                >
                                  Advising % {sortField === "advisingCompletion" && (sortDirection === "asc" ? "↑" : "↓")}
                                </TableHead>
                                <TableHead
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => handleSort("gradingCompletion")}
                                >
                                  Grading % {sortField === "gradingCompletion" && (sortDirection === "asc" ? "↑" : "↓")}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {currentSections.map((section) => (
                                <TableRow key={section.section_id}>
                                  <TableCell className="font-medium">{section.section}</TableCell>
                                  <TableCell>{section.program}</TableCell>
                                  <TableCell>{section.yearLevel}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span className="w-12">{section.advisingCompletion}%</span>
                                      <Progress value={section.advisingCompletion} className="w-16" />
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span className="w-12">{section.gradingCompletion}%</span>
                                      <Progress value={section.gradingCompletion} className="w-16" />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <PaginationComponent
                          currentPage={currentPage}
                          totalPages={totalPages}
                          onPageChange={handlePageChange}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Program Performance Tab */}
                  <TabsContent value="programs" className="space-y-4">
                    <div className="flex flex-col gap-6"> {/* Changed to flex-col for stacking */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Advising Completion by Program</CardTitle>
                          <CardDescription>Compare advising rates across academic programs</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ChartContainer
                            config={{
                              advisingRate: {
                                label: "Advising Rate",
                                color: "hsl(var(--chart-1))",
                              },
                            }}
                            className="h-[228px]" // Adjusted height for stacking
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={dashboardData.programPerformance}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="programAbbreviation" angle={-45} textAnchor="end" height={100} fontSize={12} />
                                <YAxis />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="advisingRate" fill="#22c55e" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Grading Completion by Program</CardTitle>
                          <CardDescription>Compare grading rates across academic programs</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ChartContainer
                            config={{
                              gradingRate: {
                                label: "Grading Rate",
                                color: "hsl(var(--chart-2))",
                              },
                            }}
                            className="h-[263px]" // Adjusted height for stacking
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={dashboardData.programPerformance}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="programAbbreviation" angle={-45} textAnchor="end" height={100} fontSize={12} />
                                <YAxis />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="gradingRate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* Student Status Tab */}
                  <TabsContent value="status" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Advising Status Breakdown</CardTitle>
                          <CardDescription>Distribution of students by advising status</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ChartContainer
                            config={{
                              advised: {
                                label: "Advised",
                                color: "#22c55e",
                              },
                              pending: {
                                label: "Pending Advising",
                                color: "#f59e0b",
                              },
                            }}
                            className="h-[228px]"
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={dashboardData.advisingStatusBreakdown}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={30}
                                  outerRadius={60}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {dashboardData.advisingStatusBreakdown.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <ChartTooltip
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload
                                      return (
                                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                                          <p className="font-medium">{data.name}</p>
                                          <p className="text-sm text-muted-foreground">
                                            {data.value.toLocaleString()} students
                                          </p>
                                        </div>
                                      )
                                    }
                                    return null
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                          <div className="flex justify-center gap-4 mt-4">
                            {dashboardData.advisingStatusBreakdown.map((item, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-sm">
                                  {item.name}: {item.value.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Advising Status by Year Level</CardTitle>
                          <CardDescription>Advising completion status across different year levels</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ChartContainer
                            config={{
                              advised: {
                                label: "Advised",
                                color: "#22c55e",
                              },
                              pendingAdvising: {
                                label: "Pending Advising",
                                color: "#f59e0b",
                              },
                            }}
                            className="h-[228px]"
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={dashboardData.advisingStatusByYear}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="yearLevel" angle={-45} textAnchor="end" height={100} fontSize={12} />
                                <YAxis />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="advised" stackId="a" fill="#22c55e" />
                                <Bar dataKey="pendingAdvising" stackId="a" fill="#f59e0b" />
                              </BarChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Grading Status Breakdown</CardTitle>
                          <CardDescription>Distribution of students by grading status</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ChartContainer
                            config={{
                              graded: {
                                label: "Graded",
                                color: "#3b82f6",
                              },
                              pending: {
                                label: "Pending Grades",
                                color: "#ef4444",
                              },
                            }}
                            className="h-[228px]"
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={dashboardData.gradingStatusBreakdown}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={30}
                                  outerRadius={60}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {dashboardData.gradingStatusBreakdown.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <ChartTooltip
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload
                                      return (
                                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                                          <p className="font-medium">{data.name}</p>
                                          <p className="text-sm text-muted-foreground">
                                            {data.value.toLocaleString()} students
                                          </p>
                                        </div>
                                      )
                                    }
                                    return null
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                          <div className="flex justify-center gap-4 mt-4">
                            {dashboardData.gradingStatusBreakdown.map((item, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-sm">
                                  {item.name}: {item.value.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Grading Status by Year Level</CardTitle>
                          <CardDescription>Grading completion status across different year levels</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ChartContainer
                            config={{
                              graded: {
                                label: "Graded",
                                color: "#3b82f6",
                              },
                              pendingGrades: {
                                label: "Pending Grades",
                                color: "#ef4444",
                              },
                            }}
                            className="h-[228px]"
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={dashboardData.gradingStatusByYear}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="yearLevel" angle={-45} textAnchor="end" height={100} fontSize={12} />
                                <YAxis />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="graded" stackId="a" fill="#3b82f6" />
                                <Bar dataKey="pendingGrades" stackId="a" fill="#ef4444" />
                              </BarChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* Critical Alerts Tab */}
                  <TabsContent value="alerts" className="hidden"> {/* Removed Critical Alerts Tab */}
                    </TabsContent>
                </Tabs>
              </div>

              {/* Right Sidebar - 1 column */}
              <div className="lg:col-span-1 space-y-6">
                {/* Key Dates & Deadlines */}
                <Card>
                  <CardHeader>
                    <CardTitle>Key Dates & Deadlines</CardTitle>
                    <CardDescription>Important upcoming academic dates</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 h-[310px]">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600 font-semibold text-sm dark:bg-red-900/30 dark:text-red-400">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Advising Deadline</p>
                        <p className="text-sm text-muted-foreground mt-1">October 20, 2025</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-semibold text-sm dark:bg-orange-900/30 dark:text-orange-400">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Grading Submission Deadline</p>
                        <p className="text-sm text-muted-foreground mt-1">November 15, 2025</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm dark:bg-blue-900/30 dark:text-blue-400">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Next Enrollment Period</p>
                        <p className="text-sm text-muted-foreground mt-1">December 1, 2025 - December 15, 2025</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-semibold text-sm dark:bg-purple-900/30 dark:text-purple-400">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Semester Start Date</p>
                        <p className="text-sm text-muted-foreground mt-1">January 6, 2026</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Recent Activity
                      <button className="text-sm text-blue-600 hover:text-blue-800">View all</button>
                  </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 h-[310px]"> {/* Adjusted height, removed overflow */}
                    {dashboardData.recentActivity.slice(0, RECENT_ACTIVITY_LIMIT).map((activity, index) => {
                      // Determine icon based on activity type
                      const ActivityIcon = activity.type === "advising" 
                        ? CheckCircle 
                        : activity.type === "grading" 
                          ? GraduationCap 
                          : activity.type === "update" 
                            ? FileText 
                            : User;

                      return (
                        <div key={activity.id || index} className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              activity.type === "advising"
                                ? "bg-green-100 dark:bg-green-900/30"
                                : activity.type === "grading"
                                  ? "bg-blue-100 dark:bg-blue-900/30"
                                  : activity.type === "update"
                                    ? "bg-purple-100 dark:bg-purple-900/30"
                                    : "bg-gray-100 dark:bg-gray-800"
                            }`}
                          >
                            <ActivityIcon
                              className={`w-4 h-4 ${
                                activity.type === "advising"
                                  ? "text-green-600 dark:text-green-400"
                                  : activity.type === "grading"
                                    ? "text-blue-600 dark:text-blue-400"
                                    : activity.type === "update"
                                      ? "text-purple-600 dark:text-purple-400"
                                      : "text-gray-600 dark:text-gray-400"
                              }`}
                            />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{activity.user} ({activity.role})</p>
                            <p className="text-sm text-muted-foreground">{activity.action}</p>
                            <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}

export default DeanHome