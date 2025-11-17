import { useEffect, useState } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/App-sidebar"
import Header from "@/components/layout/Header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, BookOpen, BarChart as BarChartIcon, Calendar, GraduationCap, UserCog, Loader2 } from "lucide-react"
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/config/api"

const statColorStyles = {
  blue: { bg: "bg-blue-50 dark:bg-emerald-900/30", icon: "text-blue-600 dark:text-blue-400" },
  green: { bg: "bg-green-50 dark:bg-emerald-900/30", icon: "text-green-600 dark:text-green-400" },
  purple: { bg: "bg-purple-50 dark:bg-emerald-900/30", icon: "text-purple-600 dark:text-purple-400" },
  orange: { bg: "bg-orange-50 dark:bg-emerald-900/30", icon: "text-orange-600 dark:text-orange-400" },
}

const roleColorMap = {
  Faculty: "#3b82f6",
  "Program Chair": "#10b981",
  Student: "#ef4444",
  Dean: "#f59e0b",
}

const defaultSummary = {
  totalUsers: 0,
  activePrograms: 0,
  semestersLabel: "—",
  yearLevelsLabel: "—",
}

const AdminDashboard = () => {
  const { user } = useAuth()
  const [summary, setSummary] = useState(defaultSummary)
  const [academicYear, setAcademicYear] = useState(null)
  const [userDistribution, setUserDistribution] = useState([])
  const [programEnrollment, setProgramEnrollment] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const formatNumber = (value) => {
    if (value === null || value === undefined) return "0"
    return typeof value === "number" ? value.toLocaleString() : value
  }

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    const controller = new AbortController()

    const fetchDashboardData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ admin_id: user.id })
        const response = await fetch(`${API_BASE_URL}/users/get_dashboard_data.php?${params.toString()}`, {
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
        setSummary({ ...defaultSummary, ...(data.summary || {}) })
        setAcademicYear(data.academic_year || null)
        setUserDistribution(Array.isArray(data.user_distribution) ? data.user_distribution : [])
        setProgramEnrollment(Array.isArray(data.program_enrollment) ? data.program_enrollment : [])
      } catch (err) {
        if (err.name === "AbortError") return
        console.error("Error fetching admin dashboard data:", err)
        setError(err.message || "Failed to load dashboard information.")
        setSummary(defaultSummary)
        setAcademicYear(null)
        setUserDistribution([])
        setProgramEnrollment([])
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchDashboardData()
    return () => controller.abort()
  }, [user?.id])

  const statCardsData = [
    { label: "Total Users", value: formatNumber(summary.totalUsers), description: "Active users", icon: Users, colorKey: "blue" },
    { label: "Active Programs", value: formatNumber(summary.activePrograms), description: "Academic programs", icon: BookOpen, colorKey: "green" },
    { label: "Semesters", value: summary.semestersLabel || "—", description: "Current semesters", icon: Calendar, colorKey: "purple" },
    { label: "Year Levels", value: summary.yearLevelsLabel || "—", description: "Configured levels", icon: GraduationCap, colorKey: "orange" },
  ]

  const userDistributionConfig = userDistribution.reduce((acc, item) => {
    acc[item.key || item.name] = { label: item.name, color: item.color || roleColorMap[item.name] || "#94a3b8" }
    return acc
  }, {})

  const distributionData =
    userDistribution.length > 0
      ? userDistribution.map((item) => ({
          name: item.name,
          value: item.value ?? 0,
          color: item.color || roleColorMap[item.name] || "#94a3b8",
        }))
      : Object.keys(roleColorMap).map((name) => ({ name, value: 0, color: roleColorMap[name] }))

  const programData =
    programEnrollment.length > 0
      ? programEnrollment
      : [
          { name: "No data", students: 0 },
        ]

  return (
    <SidebarProvider>
      <AppSidebar/>
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
       
        <div className="container mx-auto p-4 md:p-6 mt-4 dark:bg-gray-950">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Admin Dashboard</h1>
              <p className="text-muted-foreground mt-1">Overview of the system</p>
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

          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              {statCardsData.map((stat) => (
                <Card key={stat.label} className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">{stat.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
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
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-[#1b4b2a]" /> Current Academic Year
                </CardTitle>
                <CardDescription className="text-muted-foreground mt-1">
                  Active academic period information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {academicYear ? (
                  <div className="border rounded-md p-4 border-border bg-muted/30">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-base text-foreground line-clamp-2">
                        Academic Year {academicYear.name}
                      </h4>
                      <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ml-2 dark:bg-green-900 dark:text-green-200">
                        {academicYear.status || "Active"}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm mt-4">
                      <p className="text-muted-foreground p-3 border rounded-lg flex items-center justify-between bg-white dark:bg-gray-800">
                        <span className="font-medium text-foreground">Start Date:</span>
                        <span>{academicYear.start_date || "—"}</span>
                      </p>
                      <p className="text-muted-foreground p-3 border rounded-lg flex items-center justify-between bg-white dark:bg-gray-800">
                        <span className="font-medium text-foreground">End Date:</span>
                        <span>{academicYear.end_date || "—"}</span>
                      </p>
                      <p className="text-muted-foreground p-3 border rounded-lg flex items-center justify-between bg-white dark:bg-gray-800">
                        <span className="font-medium text-foreground">Students:</span>
                        <span className="text-purple-600 font-semibold">
                          {formatNumber(academicYear.students)}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No active academic year found.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                  <UserCog className="h-6 w-6 text-[#1b4b2a]" /> User Management
                </CardTitle>
                <CardDescription className="text-muted-foreground mt-1">Active users and staffing breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={Object.keys(userDistributionConfig).length ? userDistributionConfig : {
                    faculty: { label: "Faculty", color: "#3b82f6" },
                    programChair: { label: "Program Chair", color: "#10b981" },
                    student: { label: "Student", color: "#ef4444" },
                    dean: { label: "Dean", color: "#f59e0b" },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributionData}
                        cx="50%"
                        cy="40%"
                        innerRadius={70}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 border rounded-lg shadow-lg">
                                <p className="font-medium">{data.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatNumber(data.value)} users
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="flex justify-center gap-4 mt-4">
                  {distributionData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm">
                        {item.name}: {formatNumber(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm dark:bg-gray-950 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2"><BarChartIcon className="h-6 w-6 text-[#1b4b2a]" /> Academic Programs</CardTitle>
                <CardDescription className="text-muted-foreground mt-1">Student distribution across programs</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={programData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="students" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Students" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default AdminDashboard;