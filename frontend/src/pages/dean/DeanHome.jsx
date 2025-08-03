import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";

// ... existing code ...
import { useState } from "react"
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
  AlertCircle,
  BookOpen,
  TrendingUp,
  Filter,
  User,
  FileText,
  Eye,
} from "lucide-react"

// Mock data - REPLACE WITH ACTUAL API CALLS LATER
const mockData = {
  academicYears: ["2023-2024", "2022-2023", "2021-2022"],
  semesters: ["Fall 2024", "Spring 2024", "Fall 2023", "Spring 2023"],
  programs: ["Computer Science", "Business Administration", "Engineering", "Liberal Arts", "Medicine", "Education"],

  overallStats: {
    advisingCompletionRate: 78.5,
    gradingCompletionRate: 87.5,
    totalStudentsAdvised: 2236,
    totalCoursesGraded: 342,
    totalActiveStudents: 2847,
  },

  criticalAlerts: [
    {
      id: 1,
      type: "Low Advising",
      section: "LA-101-A",
      program: "Liberal Arts",
      completion: 67.2,
      priority: "High",
      color: "red",
    },
    {
      id: 2,
      type: "Low Grading",
      section: "EDU-301-B",
      program: "Education",
      completion: 71.8,
      priority: "Medium",
      color: "orange",
    },
    {
      id: 3,
      type: "Overdue",
      section: "BUS-401-A",
      program: "Business Administration",
      completion: 71.0,
      priority: "High",
      color: "red",
    },
  ],

  topPrograms: [
    { rank: 1, program: "Medicine", completion: 94.6 },
    { rank: 2, program: "Computer Science", completion: 89.2 },
    { rank: 3, program: "Engineering", completion: 85.1 },
    { rank: 4, program: "Business Administration", completion: 73.5 },
    { rank: 5, program: "Education", completion: 71.8 },
  ],

  recentActivity: [
    {
      id: 1,
      user: "Dr. Smith",
      action: "Completed advising for CS-401-A",
      time: "2 hours ago",
      type: "advising",
      icon: User,
    },
    {
      id: 2,
      user: "Prof. Johnson",
      action: "Submitted grades for BUS-301-B",
      time: "4 hours ago",
      type: "grading",
      icon: FileText,
    },
    {
      id: 3,
      user: "Dr. Williams",
      action: "Updated section ENG-201-C",
      time: "6 hours ago",
      type: "update",
      icon: BookOpen,
    },
    {
      id: 4,
      user: "Prof. Brown",
      action: "Reviewed student progress",
      time: "8 hours ago",
      type: "review",
      icon: Eye,
    },
  ],

  sectionData: [
    {
      section: "CS-401-A",
      program: "Computer Science",
      yearLevel: "4th Year",
      semester: "Fall 2024",
      totalStudents: 42,
      advisedStudents: 38,
      advisingCompletion: 90.5,
      gradedStudents: 40,
      gradingCompletion: 95.2,
    },
    {
      section: "BUS-301-B",
      program: "Business Administration",
      yearLevel: "3rd Year",
      semester: "Fall 2024",
      totalStudents: 54,
      advisedStudents: 41,
      advisingCompletion: 75.9,
      gradedStudents: 48,
      gradingCompletion: 88.9,
    },
    {
      section: "ENG-201-C",
      program: "Engineering",
      yearLevel: "2nd Year",
      semester: "Fall 2024",
      totalStudents: 36,
      advisedStudents: 32,
      advisingCompletion: 88.9,
      gradedStudents: 33,
      gradingCompletion: 91.7,
    },
    {
      section: "LA-101-A",
      program: "Liberal Arts",
      yearLevel: "1st Year",
      semester: "Fall 2024",
      totalStudents: 58,
      advisedStudents: 39,
      advisingCompletion: 67.2,
      gradedStudents: 46,
      gradingCompletion: 79.3,
    },
    {
      section: "MED-501-A",
      program: "Medicine",
      yearLevel: "5th Year",
      semester: "Fall 2024",
      totalStudents: 34,
      advisedStudents: 33,
      advisingCompletion: 97.1,
      gradedStudents: 33,
      gradingCompletion: 97.1,
    },
    {
      section: "EDU-301-B",
      program: "Education",
      yearLevel: "3rd Year",
      semester: "Fall 2024",
      totalStudents: 39,
      advisedStudents: 28,
      advisingCompletion: 71.8,
      gradedStudents: 33,
      gradingCompletion: 84.6,
    },
    {
      section: "CS-201-B",
      program: "Computer Science",
      yearLevel: "2nd Year",
      semester: "Fall 2024",
      totalStudents: 48,
      advisedStudents: 44,
      advisingCompletion: 91.7,
      gradedStudents: 45,
      gradingCompletion: 93.8,
    },
    {
      section: "BUS-401-A",
      program: "Business Administration",
      yearLevel: "4th Year",
      semester: "Fall 2024",
      totalStudents: 31,
      advisedStudents: 22,
      advisingCompletion: 71.0,
      gradedStudents: 28,
      gradingCompletion: 90.3,
    },
    {
      section: "BUS-401-B",
      program: "Business Administration",
      yearLevel: "4th Year",
      semester: "Fall 2024",
      totalStudents: 31,
      advisedStudents: 22,
      advisingCompletion: 71.0,
      gradedStudents: 28,
      gradingCompletion: 90.3,
    },
    {
      section: "BUS-401-C",
      program: "Business Administration",
      yearLevel: "4th Year",
      semester: "Fall 2024",
      totalStudents: 31,
      advisedStudents: 22,
      advisingCompletion: 71.0,
      gradedStudents: 28,
      gradingCompletion: 90.3,
    },
    {
      section: "BUS-401-D",
      program: "Business Administration",
      yearLevel: "4th Year",
      semester: "Fall 2024",
      totalStudents: 31,
      advisedStudents: 22,
      advisingCompletion: 71.0,
      gradedStudents: 28,
      gradingCompletion: 90.3,
    },
    {
      section: "BUS-401-E",
      program: "Business Administration",
      yearLevel: "4th Year",
      semester: "Fall 2024",
      totalStudents: 31,
      advisedStudents: 22,
      advisingCompletion: 71.0,
      gradedStudents: 28,
      gradingCompletion: 90.3,
    },
    {
      section: "BUS-401-F",
      program: "Business Administration",
      yearLevel: "4th Year",
      semester: "Fall 2024",
      totalStudents: 31,
      advisedStudents: 22,
      advisingCompletion: 71.0,
      gradedStudents: 28,
      gradingCompletion: 90.3,
    },
  ],

  programPerformance: [
    { program: "Medicine", advisingRate: 94.6, gradingRate: 94.6 },
    { program: "Computer Science", advisingRate: 89.2, gradingRate: 92.3 },
    { program: "Engineering", advisingRate: 85.1, gradingRate: 89.1 },
    { program: "Business Administration", advisingRate: 73.5, gradingRate: 85.7 },
    { program: "Education", advisingRate: 71.8, gradingRate: 81.4 },
    { program: "Liberal Arts", advisingRate: 69.2, gradingRate: 83.2 },
  ],

  advisingStatusBreakdown: [
    { name: "Advised", value: 2236, color: "#22c55e" },
    { name: "Pending Advising", value: 611, color: "#f59e0b" },
  ],

  gradingStatusBreakdown: [
    { name: "Graded", value: 2491, color: "#3b82f6" },
    { name: "Pending Grades", value: 356, color: "#ef4444" },
  ],

  advisingStatusByYear: [
    { yearLevel: "1st Year", advised: 150, pendingAdvising: 50 },
    { yearLevel: "2nd Year", advised: 200, pendingAdvising: 40 },
    { yearLevel: "3rd Year", advised: 180, pendingAdvising: 30 },
    { yearLevel: "4th Year", advised: 220, pendingAdvising: 20 },
    { yearLevel: "5th Year", advised: 190, pendingAdvising: 10 },
  ],

  gradingStatusByYear: [
    { yearLevel: "1st Year", graded: 180, pendingGrades: 20 },
    { yearLevel: "2nd Year", graded: 220, pendingGrades: 20 },
    { yearLevel: "3rd Year", graded: 200, pendingGrades: 10 },
    { yearLevel: "4th Year", graded: 230, pendingGrades: 10 },
    { yearLevel: "5th Year", graded: 195, pendingGrades: 5 },
  ],
}

const DeanHome = () => {
  const [selectedYear, setSelectedYear] = useState("2023-2024")
  const [selectedSemester, setSelectedSemester] = useState("Fall 2024")
  const [selectedProgram, setSelectedProgram] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState("section")
  const [sortDirection, setSortDirection] = useState("asc")
  const [currentPage, setCurrentPage] = useState(1) // New state for current page
  const sectionsPerPage = 13 // New constant for sections per page

  // Filter and sort section data
  const filteredAndSortedSectionData = mockData.sectionData
    .filter(
      (section) =>
        section.section.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (selectedProgram === "all" || section.program === selectedProgram) &&
        section.semester === selectedSemester,
    )
    .sort((a, b) => {
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

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        
        <div className="container mx-auto p-4 md:p-6 mt-4">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Dean's Academic Progress Dashboard</h1>
              <p className="text-muted-foreground">
                Monitor advising and grading completion across all programs and sections
              </p>
            </div>

            {/* Filters - Full Width */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
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
                        {mockData.academicYears.map((year) => (
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
                        {mockData.semesters.map((semester) => (
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
                        {mockData.programs.map((program) => (
                          <SelectItem key={program} value={program}>
                            {program}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

         
 
            {/* Metrics Cards - 4 Equal Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Advising Completion</CardTitle>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{mockData.overallStats.advisingCompletionRate}%</div>
                  <Progress value={mockData.overallStats.advisingCompletionRate} className="mt-2" fillColor="bg-green-500" /> {/* Added fillColor */}
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedYear} • {selectedSemester}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Grading Completion</CardTitle>
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{mockData.overallStats.gradingCompletionRate}%</div>
                  <Progress value={mockData.overallStats.gradingCompletionRate} className="mt-2" fillColor="bg-blue-500" /> {/* Added fillColor */}
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedYear} • {selectedSemester}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Students Advised</CardTitle>
                  <Users className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {mockData.overallStats.totalStudentsAdvised.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    of {mockData.overallStats.totalActiveStudents.toLocaleString()} total students
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Courses Graded</CardTitle>
                  <BookOpen className="h-5 w-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{mockData.overallStats.totalCoursesGraded}</div>
                  <p className="text-xs text-muted-foreground mt-2">Course sections completed</p>
                </CardContent>
              </Card>
            </div>



            {/* Main Content Area - Left Large, Right Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content Area - 3 columns */}
              <div className="lg:col-span-2">
                <Tabs defaultValue="sections" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-4 bg-muted/60 dark:bg-muted/30">
                    <TabsTrigger value="sections">Section Details</TabsTrigger>
                    <TabsTrigger value="programs">Program Performance</TabsTrigger>
                    <TabsTrigger value="status">Student Status</TabsTrigger>
                    <TabsTrigger value="alerts">Critical Alerts</TabsTrigger>
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
                                <TableRow key={section.section}>
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
                                data={mockData.programPerformance}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="program" angle={-45} textAnchor="end" height={100} fontSize={12} />
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
                                data={mockData.programPerformance}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="program" angle={-45} textAnchor="end" height={100} fontSize={12} />
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
                                  data={mockData.advisingStatusBreakdown}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={30}
                                  outerRadius={60}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {mockData.advisingStatusBreakdown.map((entry, index) => (
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
                            {mockData.advisingStatusBreakdown.map((item, index) => (
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
                                data={mockData.advisingStatusByYear}
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
                                  data={mockData.gradingStatusBreakdown}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={30}
                                  outerRadius={60}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {mockData.gradingStatusBreakdown.map((entry, index) => (
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
                            {mockData.gradingStatusBreakdown.map((item, index) => (
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
                                data={mockData.gradingStatusByYear}
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
                  <TabsContent value="alerts" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          Critical Alerts
                        </CardTitle>
                        <CardDescription>Sections requiring immediate attention</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 h-[650px] overflow-y-auto"> {/* Adjusted height for alignment */}
                        {mockData.criticalAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="flex items-center justify-between p-4 bg-red-50 rounded-lg border-l-4 border-l-red-500 hover:bg-red-100 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className={`w-3 h-3 rounded-full ${alert.color === "red" ? "bg-red-500" : "bg-orange-500"}`}
                              />
                              <div>
                                <p className="font-semibold text-base">
                                  {alert.type} - {alert.section}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {alert.program} • {alert.completion}% completion
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant={alert.priority === "High" ? "destructive" : "secondary"}
                              className="text-sm px-3 py-1"
                            >
                              {alert.priority}
                            </Badge>
                          </div>
                        ))}

                        {/* Removed Recommendations Section */}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right Sidebar - 1 column */}
              <div className="lg:col-span-1 space-y-6">
                {/* Top Programs */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Programs</CardTitle>
                    <CardDescription>Ranked by completion rates</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 h-[310px]"> {/* Adjusted height, removed overflow */}
                    {mockData.topPrograms.map((program) => (
                      <div key={program.rank} className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                          {program.rank}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{program.program}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={program.completion} className="flex-1 h-2" />
                            <span className="text-sm font-medium">{program.completion}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
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
                    {mockData.recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            activity.type === "advising"
                              ? "bg-green-100"
                              : activity.type === "grading"
                                ? "bg-blue-100"
                                : activity.type === "update"
                                  ? "bg-purple-100"
                                  : "bg-gray-100"
                          }`}
                        >
                          <activity.icon
                            className={`w-4 h-4 ${
                              activity.type === "advising"
                                ? "text-green-600"
                                : activity.type === "grading"
                                  ? "text-blue-600"
                                  : activity.type === "update"
                                    ? "text-purple-600"
                                    : "text-gray-600"
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{activity.user}</p>
                          <p className="text-sm text-muted-foreground">{activity.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                        </div>
                      </div>
                    ))}
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