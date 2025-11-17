"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Header from "@/components/layout/header"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/App-sidebar"
import { UserCheck, Users, BookOpen, BarChart as BarChartIcon, Loader2 } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useAuth } from "@/hooks/useAuth"
import { useActive } from "@/contexts/ActiveContext"
import { API_BASE_URL } from "@/config/api"

const initialSummary = {
  totalFaculty: 0,
  totalStudents: 0,
  totalCourses: 0,
  totalSections: 0,
}

const statColorStyles = {
  blue: { bg: "bg-blue-50 dark:bg-emerald-900/30", icon: "text-blue-600 dark:text-blue-400" },
  green: { bg: "bg-green-50 dark:bg-emerald-900/30", icon: "text-green-600 dark:text-green-400" },
  purple: { bg: "bg-purple-50 dark:bg-emerald-900/30", icon: "text-purple-600 dark:text-purple-400" },
  orange: { bg: "bg-orange-50 dark:bg-emerald-900/30", icon: "text-orange-600 dark:text-orange-400" },
}

const defaultYearOptions = ["1st Year", "2nd Year", "3rd Year", "4th Year"]

export default function DashboardClient() {
  const { user } = useAuth()
  const { activeAcademicYear, activeSemester, loading: activeContextLoading } = useActive()

  const [selectedYear, setSelectedYear] = useState("1st Year")
  const [summary, setSummary] = useState(initialSummary)
  const [topFacultyWorkload, setTopFacultyWorkload] = useState([])
  const [facultyAssignment, setFacultyAssignment] = useState({ assigned: 0, notAssigned: 0 })
  const [sectionEnrollment, setSectionEnrollment] = useState({})
  const [curriculums, setCurriculums] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (activeContextLoading) return
    if (!user?.id || !activeAcademicYear?.id || !activeSemester?.id) {
      setIsLoading(false)
      return
    }

    const controller = new AbortController()

    const fetchDashboardData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          program_chair_id: user.id,
          academic_year_id: activeAcademicYear.id,
          semester_id: activeSemester.id,
        })

        const response = await fetch(`${API_BASE_URL}/program_chair/get_dashboard_data.php?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          let errorMessage = `Failed to load dashboard data (HTTP ${response.status})`
          try {
            const errorBody = await response.json()
            errorMessage = errorBody.message || errorMessage
          } catch (_) {
            // ignore non-JSON error bodies
          }
          throw new Error(errorMessage)
        }

        const payload = await response.json()
        if (!payload.success) {
          throw new Error(payload.message || "Failed to fetch dashboard data.")
        }

        const data = payload.data || {}
        setSummary({ ...initialSummary, ...(data.summary || {}) })
        setTopFacultyWorkload(Array.isArray(data.top_faculty_workload) ? data.top_faculty_workload : [])
        setFacultyAssignment({
          assigned: data.faculty_assignment?.assigned ?? 0,
          notAssigned: data.faculty_assignment?.notAssigned ?? 0,
        })
        setSectionEnrollment(data.section_enrollment || {})
        setCurriculums(Array.isArray(data.curriculums) ? data.curriculums : [])
      } catch (err) {
        if (err.name === "AbortError") return
        console.error("Error fetching program chair dashboard data:", err)
        setError(err.message || "Failed to load dashboard information.")
        setSummary(initialSummary)
        setTopFacultyWorkload([])
        setFacultyAssignment({ assigned: 0, notAssigned: 0 })
        setSectionEnrollment({})
        setCurriculums([])
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchDashboardData()
    return () => controller.abort()
  }, [user?.id, activeAcademicYear?.id, activeSemester?.id, activeContextLoading])

  const availableYears = useMemo(() => Object.keys(sectionEnrollment), [sectionEnrollment])

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  const formatNumber = (value) => (typeof value === "number" ? value.toLocaleString() : "0")

  const statCardsData = [
    { label: "Total Faculty With Assignments", value: formatNumber(summary.totalFaculty), colorKey: "blue", icon: UserCheck },
    { label: "Total Students", value: formatNumber(summary.totalStudents), colorKey: "green", icon: Users },
    { label: "Total Courses", value: formatNumber(summary.totalCourses), colorKey: "purple", icon: BookOpen },
    { label: "Total Sections", value: formatNumber(summary.totalSections), colorKey: "orange", icon: BookOpen },
  ]

  const facultyAssignmentData = [
    { name: "Assigned", count: facultyAssignment.assigned, color: "#10b981" },
    { name: "Not Assigned", count: facultyAssignment.notAssigned, color: "#ef4444" },
  ]

  const sectionEnrollmentData =
    sectionEnrollment[selectedYear] ||
    (availableYears.length > 0 ? [] : [{ section: "No data", students: 0 }])

  const yearOptions = availableYears.length > 0 ? availableYears : defaultYearOptions

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false}/>
        <div className="container mx-auto p-4 md:p-6 mt-4 dark:bg-gray-950">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Workload monitoring and section management</p>
            </div>

            {isLoading && (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading dashboard metrics...</span>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {statCardsData.map((stat) => (
                <Card key={stat.label} className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800 h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{stat.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">Curriculum related stats</p>
                      </div>
                      <div className={`p-3 rounded-lg ${statColorStyles[stat.colorKey]?.bg || ""}`}>
                        <stat.icon className={`w-6 h-6 ${statColorStyles[stat.colorKey]?.icon || ""}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="lg:col-span-4 h-fit bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50">Active Curriculums</CardTitle>
                <CardDescription className="text-muted-foreground mt-1">Current programs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[250px] overflow-y-auto">
                {curriculums.filter((c) => String(c.status).toLowerCase() === "active").length === 0 && (
                  <p className="text-sm text-muted-foreground">No curriculum data available.</p>
                )}
                {curriculums
                  .filter((curriculum) => String(curriculum.status).toLowerCase() === "active")
                  .map((curriculum) => (
                  <div key={curriculum.id} className="border rounded-md p-3 border-border bg-muted/30">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm text-foreground line-clamp-2">{curriculum.name}</h4>
                      <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ml-2 dark:bg-green-900 dark:text-green-200">
                        {curriculum.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <p className="text-muted-foreground">
                        <span className="font-medium">Year:</span> {curriculum.year || "—"}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-medium">Subjects:</span> {formatNumber(curriculum.subjects)}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-medium">Students:</span> {formatNumber(curriculum.students)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <Card className="lg:col-span-2 bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50"><BarChartIcon className="h-6 w-6 text-[#1b4b2a]" /> Top 5 Faculty Workload</CardTitle>
                <CardDescription className="text-muted-foreground mt-1">Faculty members with highest workload</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topFacultyWorkload}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="workload" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Workload" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2 bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50"><Users className="h-6 w-6 text-[#1b4b2a]" /> Faculty Assignment Status</CardTitle>
                <CardDescription className="text-muted-foreground mt-1">Assigned vs Not Assigned faculty</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    assigned: { label: "Assigned", color: "#10b981" },
                    notAssigned: { label: "Not Assigned", color: "#ef4444" },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={facultyAssignmentData}
                        cx="50%"
                        cy="40%"
                        innerRadius={70}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="count"
                      >
                        {facultyAssignmentData.map((entry, index) => (
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
                                  {data.count.toLocaleString()} faculty
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
                  {facultyAssignmentData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm">
                        {item.name}: {item.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-4 bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50"><BookOpen className="h-6 w-6 text-[#1b4b2a]" /> Section Student Enrollment</CardTitle>
                  <CardDescription className="text-muted-foreground mt-1">Number of students by section</CardDescription>
                </div>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="rounded border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={sectionEnrollmentData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="section" angle={-45} textAnchor="end" height={80} fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="students" fill="#10b981" radius={[4, 4, 0, 0]} name="Students" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </main>
    </SidebarProvider>
  )
}